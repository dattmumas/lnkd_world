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
import type { XUser } from "./lib/xfeed";
import { gxUserInfo, gxFollowing, GX_PAGE_SIZE } from "./lib/getxapi";

/**
 * X "network discovery" — given 2+ seed handles, build a deduped web of the
 * accounts those seeds FOLLOW, ranked by how many seeds follow each (overlap).
 * Saved as a `networkRuns` snapshot and surfaced at /admin/network, where the
 * admin can add accounts to the Creators watchlist or follow them en masse
 * (convex/xFollow.ts).
 *
 * Reads go through getXAPI (convex/lib/getxapi.ts) — per-call billing with full
 * user objects in the following list, ~700× cheaper than the official X API.
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
  enriched: boolean; // kept for the UI; always true (getXAPI returns full objects)
}

// Compact follow record cached per seed (getXAPI returns these inline — no enrich).
interface CompactFollow {
  id: string;
  username: string;
  name: string;
  followers: number;
  description: string;
}
function compact(u: XUser): CompactFollow {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    followers: u.public_metrics?.followers_count ?? 0,
    description: u.description ?? "",
  };
}

// Cached seed entry (annotated explicitly at runQuery sites to break the same-file
// circular type inference between buildInternal/estimateBuild and cachedSeeds).
type CachedSeed = { seedId: string; followsJson: string; truncated: boolean };

const MAX_RUNS = 20; // keep the most recent N saved runs
const MIN_OVERLAP = 2; // the web is accounts followed by 2+ seeds (the actual connections)
const MAX_SHARED = 1000; // cap stored shared accounts (top by overlap)
const COST_PER_CALL = 0.001; // getXAPI per-call price
const CACHE_TTL_DAYS = 7; // reuse a seed's cached following list within this window
const SEED_CACHE_CAP = 100; // max cached seed lists kept (prune oldest)

/** The actual build: resolve seeds, get their following (cached or pulled), overlap. */
export const buildInternal = internalAction({
  args: { seeds: v.array(v.string()), forceRefresh: v.optional(v.boolean()) },
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx, { seeds: rawSeeds, forceRefresh }) => {
    const generatedAt = new Date().toISOString();
    const seeds = [...new Set(rawSeeds.map(normalizeHandle).filter(Boolean))];
    try {
      if (seeds.length < 2) {
        throw new Error("Provide at least 2 distinct seed handles.");
      }

      // Resolve each seed (getXAPI) for its id — used to exclude seeds from the web.
      const seedUsers = await Promise.all(seeds.map((h) => gxUserInfo(h)));
      const seedIds = new Set(seedUsers.map((u) => u.id));

      // Use cached following lists where fresh; only pull (and cache) what's missing.
      const cached: CachedSeed[] = forceRefresh
        ? []
        : await ctx.runQuery(internal.network.cachedSeeds, {
            seedIds: seedUsers.map((u) => u.id),
          });
      const cacheBySeed = new Map(cached.map((c) => [c.seedId, c]));

      // id -> { account, set of seed handles that follow it }. getXAPI's following
      // list carries full profiles, so we keep one account record per id directly.
      const web = new Map<string, { acc: CompactFollow; seeds: Set<string> }>();
      let truncated = false;
      for (let i = 0; i < seeds.length; i++) {
        const handle = seeds[i];
        const sid = seedUsers[i].id;
        const hit = cacheBySeed.get(sid);
        let follows: CompactFollow[];
        if (hit) {
          follows = JSON.parse(hit.followsJson) as CompactFollow[];
          if (hit.truncated) truncated = true;
        } else {
          const pulled = await gxFollowing(handle);
          follows = pulled.users.map(compact);
          if (pulled.truncated) truncated = true;
          await ctx.runMutation(internal.network.cacheSeed, {
            seedId: sid,
            handle,
            followsJson: JSON.stringify(follows),
            count: follows.length,
            truncated: pulled.truncated,
          });
        }
        for (const acc of follows) {
          if (seedIds.has(acc.id)) continue; // a seed following another seed — skip
          const entry = web.get(acc.id) ?? { acc, seeds: new Set<string>() };
          entry.seeds.add(handle);
          web.set(acc.id, entry);
        }
      }

      // The web is the INTERSECTION: accounts followed by 2+ seeds, top by overlap.
      const accounts: WebAccount[] = [...web.values()]
        .filter((e) => e.seeds.size >= MIN_OVERLAP)
        .map(({ acc, seeds: s }) => ({
          id: acc.id,
          username: acc.username,
          name: acc.name,
          description: acc.description,
          followers: acc.followers,
          overlap: s.size,
          seeds: [...s],
          enriched: true,
        }))
        .filter((a) => a.username) // drop items returned without a handle (protected/suspended)
        .sort((a, b) => b.overlap - a.overlap || b.followers - a.followers)
        .slice(0, MAX_SHARED);

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
  args: { seeds: v.array(v.string()), forceRefresh: v.optional(v.boolean()) },
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx, { seeds, forceRefresh }) => {
    const _admin: null = await ctx.runQuery(internal.network._assertAdmin, {});
    const result: { status: string; count: number } = await ctx.runAction(
      internal.network.buildInternal,
      { seeds, forceRefresh },
    );
    return { ok: true, status: result.status, count: result.count };
  },
});

/** Freshly-cached seed following lists (within the TTL) for the given seed ids. */
export const cachedSeeds = internalQuery({
  args: { seedIds: v.array(v.string()) },
  returns: v.array(
    v.object({
      seedId: v.string(),
      followsJson: v.string(),
      truncated: v.boolean(),
    }),
  ),
  handler: async (ctx, { seedIds }) => {
    const cutoff = new Date(
      Date.now() - CACHE_TTL_DAYS * 24 * 3600 * 1000,
    ).toISOString();
    const out: { seedId: string; followsJson: string; truncated: boolean }[] = [];
    for (const seedId of seedIds) {
      const row = await ctx.db
        .query("seedFollows")
        .withIndex("by_seedId", (q) => q.eq("seedId", seedId))
        .first();
      if (row && row.fetchedAt >= cutoff) {
        out.push({ seedId, followsJson: row.followsJson, truncated: row.truncated });
      }
    }
    return out;
  },
});

/** Upsert a seed's cached following list, pruning the cache to SEED_CACHE_CAP. */
export const cacheSeed = internalMutation({
  args: {
    seedId: v.string(),
    handle: v.string(),
    followsJson: v.string(),
    count: v.number(),
    truncated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("seedFollows")
      .withIndex("by_seedId", (q) => q.eq("seedId", args.seedId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("seedFollows", {
      ...args,
      fetchedAt: new Date().toISOString(),
    });
    const all = await ctx.db
      .query("seedFollows")
      .withIndex("by_fetchedAt")
      .order("asc")
      .take(SEED_CACHE_CAP + 50);
    if (all.length > SEED_CACHE_CAP) {
      for (const r of all.slice(0, all.length - SEED_CACHE_CAP)) {
        await ctx.db.delete(r._id);
      }
    }
  },
});

/**
 * Cheap pre-flight (one getXAPI user/info per seed): report each seed's following
 * count, which seeds are cached, and the rough cost in getXAPI calls, so the UI
 * can confirm before pulling. getXAPI bills per call (~70 follows/call), so the
 * cost is the number of paginated following calls for the uncached seeds.
 */
export const estimateBuild = action({
  args: { seeds: v.array(v.string()), forceRefresh: v.optional(v.boolean()) },
  returns: v.object({
    seeds: v.array(
      v.object({
        handle: v.string(),
        following: v.number(),
        cached: v.boolean(),
      }),
    ),
    billableFollowing: v.number(),
    estCalls: v.number(),
    estDollars: v.number(),
  }),
  handler: async (ctx, { seeds: rawSeeds, forceRefresh }) => {
    await ctx.runQuery(internal.network._assertAdmin, {});
    const seeds = [...new Set(rawSeeds.map(normalizeHandle).filter(Boolean))];
    if (seeds.length < 2) throw new Error("Provide at least 2 distinct seed handles.");
    const users = await Promise.all(seeds.map((h) => gxUserInfo(h)));
    const cached: CachedSeed[] = forceRefresh
      ? []
      : await ctx.runQuery(internal.network.cachedSeeds, {
          seedIds: users.map((u) => u.id),
        });
    const cachedIds = new Set(cached.map((c) => c.seedId));
    const list = users.map((u, i) => ({
      handle: seeds[i],
      following: u.public_metrics?.following_count ?? 0,
      cached: cachedIds.has(u.id), // cached seeds are reused for free
    }));
    const billableFollowing = list
      .filter((x) => !x.cached)
      .reduce((s, x) => s + x.following, 0);
    // 1 resolve call/seed + ceil(following/70) following calls for each uncached seed.
    const estCalls =
      users.length +
      list
        .filter((x) => !x.cached)
        .reduce((s, x) => s + Math.max(1, Math.ceil(x.following / GX_PAGE_SIZE)), 0);
    return {
      seeds: list,
      billableFollowing,
      estCalls,
      estDollars: Math.round(estCalls * COST_PER_CALL * 1000) / 1000,
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
