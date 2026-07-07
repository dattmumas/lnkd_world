import {
  action,
  internalAction,
  internalMutation,
  query,
  type ActionCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { gxUserTweets } from "./lib/getxapi";
import { getTweets, officialCredsConfigured } from "./lib/xoauth";
import { reportCron } from "./lib/cronReport";
import { PILLARS } from "./lib/xvoice";

/**
 * Public-metrics tracking for posted xPosts (growth dashboard, Analytics tab).
 * A daily cron searches the tracked handle's recent tweets via getXAPI and
 * snapshots likes/replies/reposts/quotes/bookmarks/views for every pipeline
 * post that has a tweetId — one snapshot/post/day for the first 14 days, when
 * metrics still move. Read-only; one search call per run.
 */

const TRACK_DAYS = 14; // snapshot window after posting (metrics plateau after)
const KEEP_DAYS = 90; // time-series retention
const RESNAPSHOT_GAP_MS = 20 * 3_600_000; // skip if snapped within ~20h

const metricRow = v.object({
  postId: v.id("xPosts"),
  tweetId: v.string(),
  likes: v.number(),
  replies: v.number(),
  reposts: v.number(),
  quotes: v.number(),
  bookmarks: v.number(),
  views: v.number(),
  profileClicks: v.optional(v.number()), // official API non_public_metrics only
  urlClicks: v.optional(v.number()),
});

/** The cron job: pull the tracked handle's recent tweets, snapshot matches. */
export const pullInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), matched: v.number() }),
  handler: async (ctx) => {
    try {
      const result = await runPull(ctx);
      await reportCron(ctx, "x-metrics", true, result.status);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await reportCron(ctx, "x-metrics", false, message);
      throw e;
    }
  },
});

async function runPull(
  ctx: ActionCtx,
): Promise<{ status: string; matched: number }> {
    const handle: string | null = await ctx.runQuery(
      internal.growth.handleInternal,
      {},
    );
    if (!handle) return { status: "no-config", matched: 0 };

    const now = Date.now();
    const tracked: { id: Id<"xPosts">; tweetId: string }[] = await ctx.runQuery(
      internal.xPosts.recentPostedInternal,
      { sinceMs: now - TRACK_DAYS * 86_400_000 },
    );
    if (tracked.length === 0) return { status: "nothing-tracked", matched: 0 };

    const byTweetId = new Map(tracked.map((p) => [p.tweetId, p.id]));

    type Row = {
      postId: Id<"xPosts">;
      tweetId: string;
      likes: number;
      replies: number;
      reposts: number;
      quotes: number;
      bookmarks: number;
      views: number;
      profileClicks?: number;
      urlClicks?: number;
    };
    let rows: Row[] = [];
    let viaOfficial = false;

    // Preferred: the official API (user context) — the only source of
    // non_public_metrics (impressions, PROFILE CLICKS, link clicks).
    if (officialCredsConfigured()) {
      try {
        const metrics = await getTweets(tracked.map((p) => p.tweetId));
        rows = metrics.flatMap((m) => {
          const postId = byTweetId.get(m.id);
          if (!postId) return [];
          return [
            {
              postId,
              tweetId: m.id,
              likes: m.public.likes,
              replies: m.public.replies,
              reposts: m.public.reposts,
              quotes: m.public.quotes,
              bookmarks: m.public.bookmarks,
              views: m.nonPublic?.impressions || m.public.views,
              profileClicks: m.nonPublic?.profileClicks,
              urlClicks: m.nonPublic?.urlClicks,
            },
          ];
        });
        viaOfficial = true;
      } catch (e) {
        console.error(
          `Official metrics pull failed, falling back to getXAPI: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    // Fallback: getXAPI timeline read (public metrics only; NOT search —
    // search omits small accounts entirely).
    if (!viaOfficial) {
      const { tweets } = await gxUserTweets(handle, {
        maxAgeMs: TRACK_DAYS * 86_400_000,
        maxTweets: 120,
      });
      console.log(`xMetrics fallback @${handle}: timeline=${tweets.length}`);
      rows = tweets.flatMap((t) => {
        const postId = byTweetId.get(t.id);
        if (!postId) return [];
        const m = t.public_metrics;
        return [
          {
            postId,
            tweetId: t.id,
            likes: m.like_count,
            replies: m.reply_count,
            reposts: m.retweet_count,
            quotes: m.quote_count ?? 0,
            bookmarks: m.bookmark_count ?? 0,
            views: m.impression_count ?? 0,
          },
        ];
      });
    }
    if (rows.length > 0) {
      await ctx.runMutation(internal.xMetrics.snapshotBatch, { rows });
    }
    await ctx.runMutation(internal.xMetrics.pruneInternal, {});
    return { status: viaOfficial ? "ok-official" : "ok", matched: rows.length };
}

/**
 * Insert snapshots (skipping posts already snapped within ~20h so a manual pull
 * plus the cron on the same day doesn't double-log) and always refresh the
 * denormalized latest* metrics on the xPosts row.
 */
export const snapshotBatch = internalMutation({
  args: { rows: v.array(metricRow) },
  returns: v.null(),
  handler: async (ctx, { rows }) => {
    const now = Date.now();
    for (const row of rows) {
      const { postId, tweetId, ...m } = row;
      const last = await ctx.db
        .query("xPostMetrics")
        .withIndex("by_post_fetchedAt", (q) => q.eq("postId", postId))
        .order("desc")
        .first();
      if (!last || now - last.fetchedAt > RESNAPSHOT_GAP_MS) {
        await ctx.db.insert("xPostMetrics", {
          postId,
          tweetId,
          fetchedAt: now,
          ...m,
        });
      }
      await ctx.db.patch(postId, {
        latestLikes: m.likes,
        latestReplies: m.replies,
        latestReposts: m.reposts,
        latestQuotes: m.quotes,
        latestBookmarks: m.bookmarks,
        latestViews: m.views,
        // Only overwrite click metrics when the official API supplied them —
        // a gxSearch fallback run must not blank previously captured values.
        ...(m.profileClicks != null ? { latestProfileClicks: m.profileClicks } : {}),
        ...(m.urlClicks != null ? { latestUrlClicks: m.urlClicks } : {}),
      });
    }
    return null;
  },
});

export const pruneInternal = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
    const old = await ctx.db
      .query("xPostMetrics")
      .withIndex("by_fetchedAt", (q) => q.lt("fetchedAt", cutoff))
      .take(500);
    for (const r of old) await ctx.db.delete(r._id);
    return old.length;
  },
});

/** Diagnostics: exercise the signed GET /2/tweets path with one tweet id. */
export const probeOfficial = internalAction({
  args: { tweetId: v.string() },
  handler: async (_ctx, { tweetId }) => {
    return await getTweets([tweetId]);
  },
});

/** Admin: "Pull metrics now" button. */
export const pull = action({
  args: {},
  returns: v.object({ status: v.string(), matched: v.number() }),
  handler: async (ctx) => {
    await ctx.runQuery(internal.growth._assertAdmin, {});
    const result: { status: string; matched: number } = await ctx.runAction(
      internal.xMetrics.pullInternal,
      {},
    );
    return result;
  },
});

/** Admin: one post's metric time series (sparkline). */
export const series = query({
  args: { postId: v.id("xPosts") },
  handler: async (ctx, { postId }) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("xPostMetrics")
      .withIndex("by_post_fetchedAt", (q) => q.eq("postId", postId))
      .order("asc")
      .take(100);
  },
});

/** Admin: average performance per pillar, from the denormalized latest metrics. */
export const pillarStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const out = [];
    for (const pillar of PILLARS) {
      const posted = await ctx.db
        .query("xPosts")
        .withIndex("by_pillar_status", (q) =>
          q.eq("pillar", pillar).eq("status", "posted"),
        )
        .take(100);
      const withMetrics = posted.filter((p) => p.latestViews != null);
      const n = withMetrics.length;
      const avg = (pick: (p: (typeof posted)[number]) => number) =>
        n === 0 ? 0 : Math.round(withMetrics.reduce((s, p) => s + pick(p), 0) / n);
      out.push({
        pillar,
        posts: posted.length,
        withMetrics: n,
        avgLikes: avg((p) => p.latestLikes ?? 0),
        avgReplies: avg((p) => p.latestReplies ?? 0),
        avgReposts: avg((p) => p.latestReposts ?? 0),
        avgViews: avg((p) => p.latestViews ?? 0),
        avgProfileClicks: avg((p) => p.latestProfileClicks ?? 0),
      });
    }
    return out;
  },
});

/**
 * Admin: daily engaged-reply counts (from the queue's action log) paired with
 * daily follower deltas — does the reply grind move the follower curve?
 * `sinceMs` comes from the client rounded to a day so the subscription is stable.
 */
export const replyRoi = query({
  args: { sinceMs: v.number() },
  handler: async (ctx, { sinceMs }) => {
    await requireAdmin(ctx);
    const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

    const actions = await ctx.db
      .query("itemActions")
      .withIndex("by_action_createdAt", (q) =>
        q.eq("action", "engaged").gt("createdAt", sinceMs),
      )
      .take(1000);
    const clicksByDay = new Map<string, number>();
    for (const a of actions) {
      const key = dayKey(a.createdAt);
      clicksByDay.set(key, (clicksByDay.get(key) ?? 0) + 1);
    }
    // Ground truth from X (on- and off-system replies); max vs queue clicks
    // per day covers the tracking lag and pre-tracking history.
    const tracked = await ctx.db
      .query("ownReplies")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", sinceMs))
      .take(1000);
    const engagedByDay = new Map<string, number>(clicksByDay);
    const trackedByDay = new Map<string, number>();
    for (const r of tracked) {
      const key = dayKey(r.createdAt);
      trackedByDay.set(key, (trackedByDay.get(key) ?? 0) + 1);
    }
    for (const [key, n] of trackedByDay) {
      engagedByDay.set(key, Math.max(engagedByDay.get(key) ?? 0, n));
    }

    const counts = await ctx.db
      .query("followerCounts")
      .withIndex("by_fetchedAt")
      .order("desc")
      .take(60);
    const series = counts.reverse();
    const deltaByDay = new Map<string, number>();
    for (let i = 1; i < series.length; i++) {
      const at = Date.parse(series[i].fetchedAt);
      if (at < sinceMs) continue;
      deltaByDay.set(dayKey(at), series[i].count - series[i - 1].count);
    }

    const days = [...new Set([...engagedByDay.keys(), ...deltaByDay.keys()])].sort();
    return days.map((day) => ({
      day,
      engaged: engagedByDay.get(day) ?? 0,
      followerDelta: deltaByDay.get(day) ?? null,
    }));
  },
});

/**
 * Admin: replies sent since the client's local midnight (daily target).
 * ownReplies is ground truth (every reply posted on X, tracked hourly) but
 * lags up to an hour; queue "engaged" clicks are instant but only on-system.
 * The max of the two is the honest count.
 */
export const engagedToday = query({
  args: { sinceMs: v.number() },
  returns: v.number(),
  handler: async (ctx, { sinceMs }) => {
    await requireAdmin(ctx);
    const actions = await ctx.db
      .query("itemActions")
      .withIndex("by_action_createdAt", (q) =>
        q.eq("action", "engaged").gt("createdAt", sinceMs),
      )
      .take(500);
    const tracked = await ctx.db
      .query("ownReplies")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", sinceMs))
      .take(500);
    return Math.max(actions.length, tracked.length);
  },
});
