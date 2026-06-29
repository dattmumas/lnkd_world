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
import { gxFollowers } from "./lib/getxapi";
import type { XUser } from "./lib/xfeed";

/**
 * Growth tracking — a daily snapshot of the tracked account's followers, diffed
 * day-over-day so spikes tie to specific content. The handle is configurable in
 * /admin/growth. Followers are pulled via getXAPI (capped, like the network tool).
 */

interface Follower {
  id: string;
  username: string;
  name: string;
  followers: number;
}
function compact(u: XUser): Follower {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    followers: u.public_metrics?.followers_count ?? 0,
  };
}

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

const KEEP_SNAPSHOTS = 60;

/** Admin: the tracked handle (or null). */
export const getConfig = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db.query("growthConfig").first();
    return row?.handle ?? null;
  },
});

/** Admin: set the tracked handle. */
export const setHandle = mutation({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    await requireAdmin(ctx);
    const h = normalizeHandle(handle);
    if (!h) throw new Error("Handle is required.");
    const existing = await ctx.db.query("growthConfig").first();
    const updatedAt = new Date().toISOString();
    if (existing) await ctx.db.patch(existing._id, { handle: h, updatedAt });
    else await ctx.db.insert("growthConfig", { handle: h, updatedAt });
  },
});

/** Internal: the tracked handle for the action (no admin gate). */
export const handleInternal = internalQuery({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const row = await ctx.db.query("growthConfig").first();
    return row?.handle ?? null;
  },
});

/** The snapshot job: pull the tracked account's followers, store, prune. */
export const snapshotInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const handle: string | null = await ctx.runQuery(
      internal.growth.handleInternal,
      {},
    );
    if (!handle) return { status: "no-config", count: 0 };
    const { users, truncated } = await gxFollowers(handle);
    const followers = users.map(compact);
    await ctx.runMutation(internal.growth.store, {
      handle,
      followsJson: JSON.stringify(followers),
      count: followers.length,
      truncated,
    });
    return { status: "ok", count: followers.length };
  },
});

export const store = internalMutation({
  args: {
    handle: v.string(),
    followsJson: v.string(),
    count: v.number(),
    truncated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("followerSnapshots")
      .withIndex("by_fetchedAt")
      .order("asc")
      .take(200);
    if (old.length >= KEEP_SNAPSHOTS) {
      for (const r of old.slice(0, old.length - KEEP_SNAPSHOTS + 1)) {
        await ctx.db.delete(r._id);
      }
    }
    await ctx.db.insert("followerSnapshots", {
      ...args,
      fetchedAt: new Date().toISOString(),
    });
  },
});

export const _assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

/** Admin-only manual snapshot (the cron handles the daily run). */
export const snapshot = action({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const _admin: null = await ctx.runQuery(internal.growth._assertAdmin, {});
    const result: { status: string; count: number } = await ctx.runAction(
      internal.growth.snapshotInternal,
      {},
    );
    return { ok: true, status: result.status, count: result.count };
  },
});

/** Admin: latest count, change vs the previous snapshot, and who joined/left. */
export const latest = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const snaps = await ctx.db
      .query("followerSnapshots")
      .withIndex("by_fetchedAt")
      .order("desc")
      .take(2);
    if (snaps.length === 0) return null;
    const cur = snaps[0];
    const curList = JSON.parse(cur.followsJson) as Follower[];
    let gained: Follower[] = [];
    let lostCount = 0;
    let prevCount: number | null = null;
    if (snaps[1]) {
      const prevList = JSON.parse(snaps[1].followsJson) as Follower[];
      const prevIds = new Set(prevList.map((f) => f.id));
      const curIds = new Set(curList.map((f) => f.id));
      gained = curList.filter((f) => !prevIds.has(f.id));
      lostCount = prevList.filter((f) => !curIds.has(f.id)).length;
      prevCount = snaps[1].count;
    }
    return {
      handle: cur.handle,
      count: cur.count,
      truncated: cur.truncated,
      fetchedAt: cur.fetchedAt,
      prevCount,
      gainedCount: gained.length,
      lostCount,
      // sample of who joined, biggest accounts first
      gained: gained
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 50)
        .map((f) => ({ username: f.username, name: f.name, followers: f.followers })),
    };
  },
});
