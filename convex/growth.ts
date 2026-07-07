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
import { reportCron } from "./lib/cronReport";
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
const KEEP_COUNTS = 400; // compact chart rows — ~13 months of daily history

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
    try {
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
      await reportCron(ctx, "growth-snapshot", true, `count=${followers.length}`);
      return { status: "ok", count: followers.length };
    } catch (e) {
      await reportCron(
        ctx,
        "growth-snapshot",
        false,
        e instanceof Error ? e.message : String(e),
      );
      throw e;
    }
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
    const prev = await ctx.db
      .query("followerSnapshots")
      .withIndex("by_fetchedAt")
      .order("desc")
      .first();
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
    const fetchedAt = new Date().toISOString();
    await ctx.db.insert("followerSnapshots", { ...args, fetchedAt });

    // Persist gained followers for attribution (convex/attribution.ts). A
    // truncated pull on either side produces phantom gains — skip those.
    if (prev && !prev.truncated && !args.truncated) {
      const now = Date.now();
      const prevIds = new Set(
        (JSON.parse(prev.followsJson) as Follower[]).map((f) => f.id),
      );
      const gained = (JSON.parse(args.followsJson) as Follower[])
        .filter((f) => !prevIds.has(f.id))
        .slice(0, 200);
      for (const g of gained) {
        await ctx.db.insert("followerGains", {
          xUserId: g.id,
          username: g.username.toLowerCase(),
          name: g.name,
          followers: g.followers,
          gainedAt: now,
          day: new Date(now).toISOString().slice(0, 10),
        });
      }
      const staleGains = await ctx.db
        .query("followerGains")
        .withIndex("by_gainedAt", (q) => q.lt("gainedAt", now - 180 * 86_400_000))
        .take(200);
      for (const r of staleGains) await ctx.db.delete(r._id);
    }
    // Compact count row for the growth chart — outlives the heavy snapshots.
    await ctx.db.insert("followerCounts", {
      handle: args.handle,
      count: args.count,
      fetchedAt,
    });
    const oldCounts = await ctx.db
      .query("followerCounts")
      .withIndex("by_fetchedAt")
      .order("asc")
      .take(600);
    if (oldCounts.length > KEEP_COUNTS) {
      for (const r of oldCounts.slice(0, oldCounts.length - KEEP_COUNTS)) {
        await ctx.db.delete(r._id);
      }
    }
  },
});

/** One-time: seed followerCounts from the existing heavy snapshots. */
export const backfillCounts = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const snaps = await ctx.db
      .query("followerSnapshots")
      .withIndex("by_fetchedAt")
      .order("asc")
      .take(200);
    const existing = await ctx.db
      .query("followerCounts")
      .withIndex("by_fetchedAt")
      .order("asc")
      .take(600);
    const have = new Set(existing.map((r) => r.fetchedAt));
    let added = 0;
    for (const s of snaps) {
      if (have.has(s.fetchedAt)) continue;
      await ctx.db.insert("followerCounts", {
        handle: s.handle,
        count: s.count,
        fetchedAt: s.fetchedAt,
      });
      added++;
    }
    return added;
  },
});

/** Admin: follower-count series for the chart, oldest-first, plus deltas. */
export const series = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("followerCounts")
      .withIndex("by_fetchedAt")
      .order("desc")
      .take(90);
    if (rows.length === 0) return null;
    const points = rows
      .reverse()
      .map((r) => ({ fetchedAt: r.fetchedAt, count: r.count }));
    const latest = points[points.length - 1];
    const latestMs = Date.parse(latest.fetchedAt);
    // Closest point at least N days older than the latest.
    const at = (days: number) => {
      const cutoff = latestMs - days * 86_400_000;
      for (let i = points.length - 2; i >= 0; i--) {
        if (Date.parse(points[i].fetchedAt) <= cutoff) return points[i].count;
      }
      return null;
    };
    const dayAgo = at(1);
    const weekAgo = at(7);
    return {
      points,
      count: latest.count,
      deltaDay: dayAgo != null ? latest.count - dayAgo : null,
      deltaWeek: weekAgo != null ? latest.count - weekAgo : null,
    };
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
    let lost: Follower[] = [];
    let prevCount: number | null = null;
    if (snaps[1]) {
      const prevList = JSON.parse(snaps[1].followsJson) as Follower[];
      const prevIds = new Set(prevList.map((f) => f.id));
      const curIds = new Set(curList.map((f) => f.id));
      gained = curList.filter((f) => !prevIds.has(f.id));
      lost = prevList.filter((f) => !curIds.has(f.id));
      prevCount = snaps[1].count;
    }
    const sample = (list: Follower[]) =>
      list
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 50)
        .map((f) => ({ username: f.username, name: f.name, followers: f.followers }));
    return {
      handle: cur.handle,
      count: cur.count,
      truncated: cur.truncated,
      fetchedAt: cur.fetchedAt,
      prevCount,
      gainedCount: gained.length,
      lostCount: lost.length,
      // samples, biggest accounts first
      gained: sample(gained),
      lost: sample(lost),
    };
  },
});
