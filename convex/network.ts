import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import {
  resolveUser,
  fetchFollowing,
  hydrateUsers,
  type XUser,
} from "./lib/xfeed";

/**
 * X "network discovery" — given 2+ seed handles, build a deduped web of the
 * accounts those seeds FOLLOW, ranked by how many seeds follow each (overlap).
 * Saved as a `networkRuns` snapshot and surfaced at /admin/network, where the
 * admin can add accounts to the Creators watchlist or follow them en masse
 * (convex/xFollow.ts).
 */

// X username, no leading @, lowercase (matches convex/creators.ts).
function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

// One account in a built web (serialized into networkRuns.accounts as JSON).
// Long-tail (overlap 1) rows stay lean — handle/name only, enriched=false — so we
// never pay the rich-object cost for accounts that aren't surfaced.
interface WebAccount {
  id: string;
  username: string;
  name: string;
  description: string;
  followers: number;
  overlap: number; // how many seeds follow this account
  seeds: string[]; // which seed handles follow it
  enriched: boolean; // whether bio/follower count were fetched
}

const MAX_RUNS = 20; // keep the most recent N saved runs
const MIN_OVERLAP = 2; // the web is accounts followed by 2+ seeds (the actual connections)
const ENRICH_MAX = 1000; // cap hydrated accounts (≤10 batch calls) to bound cost
const COST_PER_READ = 0.01; // empirical pay-per-use rate (~$0.009–0.01 per user object)

/** The actual build: resolve seeds, pull their following, compute the overlap web. */
export const buildInternal = internalAction({
  args: { seeds: v.array(v.string()) },
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx, { seeds: rawSeeds }) => {
    const generatedAt = new Date().toISOString();
    const seeds = [...new Set(rawSeeds.map(normalizeHandle).filter(Boolean))];
    try {
      if (seeds.length < 2) {
        throw new Error("Provide at least 2 distinct seed handles.");
      }

      // Resolve each seed to its user id (and collect ids to exclude from the web).
      const seedUsers = await Promise.all(seeds.map((h) => resolveUser(h)));
      const seedIds = new Set(seedUsers.map((u) => u.id));

      // Pull each seed's following list (MINIMAL fields — id/name/username only),
      // tagging every followed account with the seed handle(s) that follow it.
      const web = new Map<string, { user: XUser; seeds: Set<string> }>();
      let truncated = false;
      for (let i = 0; i < seeds.length; i++) {
        const handle = seeds[i];
        const { users, truncated: t } = await fetchFollowing(seedUsers[i].id);
        if (t) truncated = true;
        for (const u of users) {
          if (seedIds.has(u.id)) continue; // a seed following another seed — skip
          const entry = web.get(u.id) ?? { user: u, seeds: new Set<string>() };
          entry.seeds.add(handle);
          web.set(u.id, entry);
        }
      }

      // The web is the INTERSECTION: accounts followed by 2+ seeds. Single-seed
      // follows are the long tail and not what this tool is for — drop them.
      const shared = [...web.values()].filter((e) => e.seeds.size >= MIN_OVERLAP);

      // Enrich the shared accounts (capped) — bio + follower count for display.
      const enrichIds = shared
        .sort((a, b) => b.seeds.size - a.seeds.size)
        .slice(0, ENRICH_MAX)
        .map((e) => e.user.id);
      const hydrated =
        enrichIds.length > 0 ? await hydrateUsers(enrichIds) : new Map<string, XUser>();

      const accounts: WebAccount[] = shared
        .map(({ user, seeds: s }) => {
          const full = hydrated.get(user.id);
          return {
            id: user.id,
            username: full?.username ?? user.username,
            name: full?.name ?? user.name,
            description: full?.description ?? "",
            followers: full?.public_metrics?.followers_count ?? 0,
            overlap: s.size,
            seeds: [...s],
            enriched: !!full,
          };
        })
        .sort(
          (a, b) =>
            b.overlap - a.overlap ||
            Number(b.enriched) - Number(a.enriched) ||
            b.followers - a.followers,
        );

      const status = accounts.length > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.network.store, {
        seeds,
        status,
        count: accounts.length,
        accounts: JSON.stringify(accounts),
        truncated,
        generatedAt,
      });
      return { status, count: accounts.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.network.store, {
        seeds,
        status: "error",
        count: 0,
        accounts: "[]",
        generatedAt,
        error: message,
      });
      throw new Error(`Network build failed: ${message}`);
    }
  },
});

/** Store a run, pruning to the last MAX_RUNS. */
export const store = internalMutation({
  args: {
    seeds: v.array(v.string()),
    status: v.string(),
    count: v.number(),
    accounts: v.string(),
    truncated: v.optional(v.boolean()),
    generatedAt: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("networkRuns")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    if (old.length >= MAX_RUNS) {
      for (const r of old.slice(0, old.length - MAX_RUNS + 1)) {
        await ctx.db.delete(r._id);
      }
    }
    return await ctx.db.insert("networkRuns", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});

/** Admin gate for actions (no ctx.db) — same pattern as xTrends._assertAdmin. */
export const _assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

/** Admin entry point: kick off a build for the given seed handles. */
export const build = action({
  args: { seeds: v.array(v.string()) },
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx, { seeds }) => {
    const _admin: null = await ctx.runQuery(internal.network._assertAdmin, {});
    const result: { status: string; count: number } = await ctx.runAction(
      internal.network.buildInternal,
      { seeds },
    );
    return { ok: true, status: result.status, count: result.count };
  },
});

/**
 * Cheap pre-flight (~2 user reads): resolve the seeds and report how many
 * accounts a build will pull and the rough cost, so the UI can confirm BEFORE
 * spending. The bulk pull is what costs money, so always estimate first.
 */
export const estimateBuild = action({
  args: { seeds: v.array(v.string()) },
  returns: v.object({
    seeds: v.array(v.object({ handle: v.string(), following: v.number() })),
    totalFollowing: v.number(),
    estDollars: v.number(),
  }),
  handler: async (ctx, { seeds: rawSeeds }) => {
    await ctx.runQuery(internal.network._assertAdmin, {});
    const seeds = [...new Set(rawSeeds.map(normalizeHandle).filter(Boolean))];
    if (seeds.length < 2) throw new Error("Provide at least 2 distinct seed handles.");
    const users = await Promise.all(seeds.map((h) => resolveUser(h)));
    const list = users.map((u, i) => ({
      handle: seeds[i],
      following: u.public_metrics?.following_count ?? 0,
    }));
    const totalFollowing = list.reduce((s, x) => s + x.following, 0);
    return {
      seeds: list,
      totalFollowing,
      estDollars: Math.round(totalFollowing * COST_PER_READ * 100) / 100,
    };
  },
});

/** Admin: run list (metadata only — omits the large accounts blob). */
export const listRuns = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const runs = await ctx.db
      .query("networkRuns")
      .withIndex("by_createdAt")
      .order("desc")
      .take(MAX_RUNS);
    return runs.map((r) => ({
      _id: r._id,
      seeds: r.seeds,
      status: r.status,
      count: r.count,
      truncated: r.truncated ?? false,
      error: r.error,
      generatedAt: r.generatedAt,
    }));
  },
});

/** Admin: full run incl. the accounts JSON (client parses it). */
export const getRun = query({
  args: { id: v.id("networkRuns") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(id);
  },
});

/** Admin: add discovered handles to the Creators watchlist (deduped). */
export const addToWatchlist = mutation({
  args: { handles: v.array(v.string()), note: v.optional(v.string()) },
  returns: v.object({ added: v.number(), skipped: v.number() }),
  handler: async (ctx, { handles, note }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("creators").withIndex("by_order").collect();
    const have = new Set(existing.map((c) => c.handle));
    let order = existing.length;
    let added = 0;
    let skipped = 0;
    for (const raw of handles) {
      const handle = normalizeHandle(raw);
      if (!handle || have.has(handle)) {
        skipped++;
        continue;
      }
      await ctx.db.insert("creators", {
        handle,
        note: note ?? "via network discovery",
        order: order++,
        active: true,
      });
      have.add(handle);
      added++;
    }
    return { added, skipped };
  },
});

/** Record follow outcomes (called by the use-node follow action). */
export const recordFollows = internalMutation({
  args: {
    results: v.array(
      v.object({
        targetId: v.string(),
        username: v.optional(v.string()),
        status: v.string(),
        detail: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { results }) => {
    const followedAt = new Date().toISOString();
    for (const r of results) {
      await ctx.db.insert("xFollows", { ...r, followedAt });
    }
  },
});

/** Today's follow count (daily cap) + all previously-followed target ids (dedup). */
export const followStats = internalQuery({
  args: {},
  returns: v.object({ todayCount: v.number(), followedIds: v.array(v.string()) }),
  handler: async (ctx) => {
    const startOfDay = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
    const all = await ctx.db.query("xFollows").withIndex("by_followedAt").collect();
    const todayCount = all.filter(
      (r) => r.status === "followed" && r.followedAt >= startOfDay,
    ).length;
    const followedIds = [
      ...new Set(all.filter((r) => r.status === "followed").map((r) => r.targetId)),
    ];
    return { todayCount, followedIds };
  },
});
