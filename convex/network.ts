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
import { gxUserInfo, gxFollowing, gxFollowers, GX_PAGE_SIZE } from "./lib/getxapi";

/**
 * X "network discovery" — given 2+ seed handles, build a deduped web of the
 * accounts those seeds FOLLOW, ranked by how many seeds follow each (overlap).
 * Saved as a `networkRuns` snapshot and surfaced at /admin/network, where the
 * admin can add accounts to the Creators watchlist for engagement.
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

/**
 * The actual build: resolve seeds, get each one's connections (cached or pulled),
 * intersect. `mode` picks the axis:
 *  - "following": accounts the seeds follow (who they respect).
 *  - "followers": accounts that follow the seeds (the audience) — the warm-audience
 *    play. With `excludeHandle`, accounts already following you are removed, leaving
 *    "follows ≥2 niche voices but not you".
 */
export const buildInternal = internalAction({
  args: {
    seeds: v.array(v.string()),
    mode: v.optional(v.string()),
    excludeHandle: v.optional(v.string()),
    forceRefresh: v.optional(v.boolean()),
  },
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx, { seeds: rawSeeds, mode: rawMode, excludeHandle: rawExclude, forceRefresh }) => {
    const generatedAt = new Date().toISOString();
    const mode = rawMode === "followers" ? "followers" : "following";
    const seeds = [...new Set(rawSeeds.map(normalizeHandle).filter(Boolean))];
    const excludeHandle = rawExclude ? normalizeHandle(rawExclude) : "";
    try {
      if (seeds.length < 2) {
        throw new Error("Provide at least 2 distinct seed handles.");
      }

      // Cache-or-pull a handle's connections of `kind`, keyed by (seedId, kind).
      const getConn = async (
        handle: string,
        sid: string,
        kind: "following" | "followers",
      ): Promise<{ follows: CompactFollow[]; truncated: boolean }> => {
        if (!forceRefresh) {
          const rows: CachedSeed[] = await ctx.runQuery(internal.network.cachedSeeds, {
            seedIds: [sid],
            kind,
          });
          if (rows[0]) {
            return {
              follows: JSON.parse(rows[0].followsJson) as CompactFollow[],
              truncated: rows[0].truncated,
            };
          }
        }
        const pulled = kind === "followers" ? await gxFollowers(handle) : await gxFollowing(handle);
        const follows = pulled.users.map(compact);
        await ctx.runMutation(internal.network.cacheSeed, {
          seedId: sid,
          handle,
          kind,
          followsJson: JSON.stringify(follows),
          count: follows.length,
          truncated: pulled.truncated,
        });
        return { follows, truncated: pulled.truncated };
      };

      // Resolve each seed (getXAPI) for its id — used to exclude seeds from the web.
      const seedUsers = await Promise.all(seeds.map((h) => gxUserInfo(h)));
      const seedIds = new Set(seedUsers.map((u) => u.id));

      // "but not me": exclude accounts that already follow you (your followers).
      const excludeIds = new Set<string>();
      if (excludeHandle) {
        const me = await gxUserInfo(excludeHandle);
        excludeIds.add(me.id);
        const { follows } = await getConn(excludeHandle, me.id, "followers");
        for (const f of follows) excludeIds.add(f.id);
      }

      // id -> { account, set of seed handles connected to it }. getXAPI's lists carry
      // full profiles, so we keep one account record per id directly.
      const web = new Map<string, { acc: CompactFollow; seeds: Set<string> }>();
      let truncated = false;
      for (let i = 0; i < seeds.length; i++) {
        const { follows, truncated: t } = await getConn(seeds[i], seedUsers[i].id, mode);
        if (t) truncated = true;
        for (const acc of follows) {
          if (seedIds.has(acc.id) || excludeIds.has(acc.id)) continue;
          const entry = web.get(acc.id) ?? { acc, seeds: new Set<string>() };
          entry.seeds.add(seeds[i]);
          web.set(acc.id, entry);
        }
      }

      // The web is the INTERSECTION: accounts connected to 2+ seeds, top by overlap.
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
        mode,
        excludeHandle: excludeHandle || undefined,
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
    mode: v.optional(v.string()),
    excludeHandle: v.optional(v.string()),
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
  args: {
    seeds: v.array(v.string()),
    mode: v.optional(v.string()),
    excludeHandle: v.optional(v.string()),
    forceRefresh: v.optional(v.boolean()),
  },
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx, { seeds, mode, excludeHandle, forceRefresh }) => {
    const _admin: null = await ctx.runQuery(internal.network._assertAdmin, {});
    const result: { status: string; count: number } = await ctx.runAction(
      internal.network.buildInternal,
      { seeds, mode, excludeHandle, forceRefresh },
    );
    return { ok: true, status: result.status, count: result.count };
  },
});

/** Freshly-cached connection lists (within the TTL) for the given seed ids + kind. */
export const cachedSeeds = internalQuery({
  args: { seedIds: v.array(v.string()), kind: v.string() },
  returns: v.array(
    v.object({
      seedId: v.string(),
      followsJson: v.string(),
      truncated: v.boolean(),
    }),
  ),
  handler: async (ctx, { seedIds, kind }) => {
    const cutoff = new Date(
      Date.now() - CACHE_TTL_DAYS * 24 * 3600 * 1000,
    ).toISOString();
    const out: { seedId: string; followsJson: string; truncated: boolean }[] = [];
    for (const seedId of seedIds) {
      const rows = await ctx.db
        .query("seedFollows")
        .withIndex("by_seedId", (q) => q.eq("seedId", seedId))
        .collect();
      const row = rows.find((r) => (r.kind ?? "following") === kind);
      if (row && row.fetchedAt >= cutoff) {
        out.push({ seedId, followsJson: row.followsJson, truncated: row.truncated });
      }
    }
    return out;
  },
});

/** Upsert a seed's cached connection list (per kind), pruning to SEED_CACHE_CAP. */
export const cacheSeed = internalMutation({
  args: {
    seedId: v.string(),
    handle: v.string(),
    kind: v.string(),
    followsJson: v.string(),
    count: v.number(),
    truncated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("seedFollows")
      .withIndex("by_seedId", (q) => q.eq("seedId", args.seedId))
      .collect();
    for (const r of rows) {
      if ((r.kind ?? "following") === args.kind) await ctx.db.delete(r._id);
    }
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
  args: {
    seeds: v.array(v.string()),
    mode: v.optional(v.string()),
    excludeHandle: v.optional(v.string()),
    forceRefresh: v.optional(v.boolean()),
  },
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
  handler: async (ctx, { seeds: rawSeeds, mode: rawMode, excludeHandle: rawExclude, forceRefresh }) => {
    await ctx.runQuery(internal.network._assertAdmin, {});
    const mode = rawMode === "followers" ? "followers" : "following";
    const seeds = [...new Set(rawSeeds.map(normalizeHandle).filter(Boolean))];
    const excludeHandle = rawExclude ? normalizeHandle(rawExclude) : "";
    if (seeds.length < 2) throw new Error("Provide at least 2 distinct seed handles.");
    const users = await Promise.all(seeds.map((h) => gxUserInfo(h)));
    const cached: CachedSeed[] = forceRefresh
      ? []
      : await ctx.runQuery(internal.network.cachedSeeds, {
          seedIds: users.map((u) => u.id),
          kind: mode,
        });
    const cachedIds = new Set(cached.map((c) => c.seedId));
    // The relevant size per seed depends on the axis (who they follow vs who follows them).
    const sizeOf = (u: (typeof users)[number]) =>
      mode === "followers"
        ? (u.public_metrics?.followers_count ?? 0)
        : (u.public_metrics?.following_count ?? 0);
    const list = users.map((u, i) => ({
      handle: seeds[i],
      following: sizeOf(u),
      cached: cachedIds.has(u.id), // cached seeds are reused for free
    }));
    const billableFollowing = list
      .filter((x) => !x.cached)
      .reduce((s, x) => s + x.following, 0);
    const pages = (n: number) => Math.max(1, Math.ceil(n / GX_PAGE_SIZE));
    // resolve call/seed + connection-pull calls for each uncached seed.
    let estCalls =
      users.length +
      list.filter((x) => !x.cached).reduce((s, x) => s + pages(x.following), 0);
    // "but not me": resolve the exclude account + pull its followers (cached -> free).
    if (excludeHandle) {
      const me = await gxUserInfo(excludeHandle);
      const meCached: CachedSeed[] = forceRefresh
        ? []
        : await ctx.runQuery(internal.network.cachedSeeds, {
            seedIds: [me.id],
            kind: "followers",
          });
      estCalls +=
        1 + (meCached.length ? 0 : pages(me.public_metrics?.followers_count ?? 0));
    }
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
      mode: r.mode ?? "following",
      excludeHandle: r.excludeHandle,
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
