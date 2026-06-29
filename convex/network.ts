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
import { resolveUser, fetchFollowing, type XUser } from "./lib/xfeed";

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
interface WebAccount {
  id: string;
  username: string;
  name: string;
  description: string;
  followers: number;
  overlap: number; // how many seeds follow this account
  seeds: string[]; // which seed handles follow it
}

const MAX_RUNS = 20; // keep the most recent N saved runs

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

      // Pull each seed's following list, tagging every followed account with the
      // seed handle(s) that follow it.
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

      const accounts: WebAccount[] = [...web.values()]
        .map(({ user, seeds: s }) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          description: user.description ?? "",
          followers: user.public_metrics?.followers_count ?? 0,
          overlap: s.size,
          seeds: [...s],
        }))
        .sort((a, b) => b.overlap - a.overlap || b.followers - a.followers);

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
