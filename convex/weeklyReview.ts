import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import { gxUserTweets } from "./lib/getxapi";
import { reportCron } from "./lib/cronReport";
import { REVIEW_SYSTEM, PILLARS } from "./lib/xvoice";

/**
 * The Sunday growth review (growth dashboard, Analytics tab): Claude reads the
 * week's numbers — follower curve, posts published, pillar averages, reply
 * volume — and writes a short markdown report with concrete suggestions. If the
 * Anthropic key is unset or the call fails, a stats-only fallback is stored so
 * the tab always has something to show.
 */

const KEEP_REVIEWS = 26; // half a year of Sundays

/** Internal: the week's raw inputs, as one JSON-ready object. */
export const statsInternal = internalQuery({
  args: { nowMs: v.number() },
  handler: async (ctx, { nowMs }) => {
    const weekAgo = nowMs - 7 * 86_400_000;
    const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

    const counts = await ctx.db
      .query("followerCounts")
      .withIndex("by_fetchedAt")
      .order("desc")
      .take(20);
    // One point per day (manual snapshots duplicate days) — keep the latest.
    const byDay = new Map<string, number>();
    for (const r of counts.reverse()) {
      byDay.set(r.fetchedAt.slice(0, 10), r.count);
    }
    const followerSeries = [...byDay.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-8);

    const posted = await ctx.db
      .query("xPosts")
      .withIndex("by_status_postedAt", (q) =>
        q.eq("status", "posted").gt("postedAt", weekAgo),
      )
      .take(100);
    const posts = posted.map((p) => ({
      pillar: p.pillar,
      kind: p.kind,
      firstLine: p.body.split("\n")[0].slice(0, 120),
      likes: p.latestLikes ?? null,
      replies: p.latestReplies ?? null,
      reposts: p.latestReposts ?? null,
      views: p.latestViews ?? null,
    }));

    const pillarAverages = [];
    for (const pillar of PILLARS) {
      const rows = await ctx.db
        .query("xPosts")
        .withIndex("by_pillar_status", (q) =>
          q.eq("pillar", pillar).eq("status", "posted"),
        )
        .take(100);
      const withM = rows.filter((p) => p.latestViews != null);
      const n = withM.length;
      pillarAverages.push({
        pillar,
        postedTotal: rows.length,
        avgLikes: n ? Math.round(withM.reduce((s, p) => s + (p.latestLikes ?? 0), 0) / n) : null,
        avgViews: n ? Math.round(withM.reduce((s, p) => s + (p.latestViews ?? 0), 0) / n) : null,
      });
    }

    const actions = await ctx.db
      .query("itemActions")
      .withIndex("by_action_createdAt", (q) =>
        q.eq("action", "engaged").gt("createdAt", weekAgo),
      )
      .take(1000);
    const trackedReplies = await ctx.db
      .query("ownReplies")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", weekAgo))
      .take(1000);
    // Per day: max(queue clicks, tracked replies) — ownReplies is ground truth
    // (includes off-system replies) but lags up to an hour behind clicks.
    const clicksPerDay: Record<string, number> = {};
    for (const a of actions) {
      const key = dayKey(a.createdAt);
      clicksPerDay[key] = (clicksPerDay[key] ?? 0) + 1;
    }
    const trackedPerDay: Record<string, number> = {};
    for (const r of trackedReplies) {
      const key = dayKey(r.createdAt);
      trackedPerDay[key] = (trackedPerDay[key] ?? 0) + 1;
    }
    const repliesPerDay: Record<string, number> = { ...clicksPerDay };
    for (const [key, n] of Object.entries(trackedPerDay)) {
      repliesPerDay[key] = Math.max(repliesPerDay[key] ?? 0, n);
    }

    // The actual replies, not just counts — what was said, to whom, what it earned.
    const repliesDetail = trackedReplies.slice(0, 30).map((r) => ({
      to: r.repliedToUsername ?? null,
      text: r.text.replace(/^@\w+\s*/, "").slice(0, 140),
      likes: r.likes ?? 0,
      views: r.views ?? null,
    }));

    // Who actually followed this week (names + sizes — signal about what's working).
    const gains = await ctx.db
      .query("followerGains")
      .withIndex("by_gainedAt", (q) => q.gt("gainedAt", weekAgo))
      .take(200);
    const gainedFollowers = gains
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 25)
      .map((g) => ({ username: g.username, name: g.name, followers: g.followers }));

    return {
      followerSeries,
      pipelinePosts: posts,
      pillarAverages,
      repliesPerDay,
      repliesDetail,
      gainedFollowers,
    };
  },
});

export const store = internalMutation({
  args: { weekOf: v.string(), markdown: v.string(), statsJson: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("weeklyReviews", { ...args, createdAt: Date.now() });
    const old = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    if (old.length > KEEP_REVIEWS) {
      for (const r of old.slice(0, old.length - KEEP_REVIEWS)) {
        await ctx.db.delete(r._id);
      }
    }
    return null;
  },
});

/** The cron job: assemble stats, have Claude write the review, store it. */
export const generateInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string() }),
  handler: async (ctx) => {
    const nowMs = Date.now();
    // Explicit annotation breaks same-module type circularity (statsInternal
    // lives in this file).
    const stats: {
      followerSeries: { day: string; count: number }[];
      pipelinePosts: unknown[];
      pillarAverages: unknown[];
      repliesPerDay: Record<string, number>;
      repliesDetail: unknown[];
      gainedFollowers: unknown[];
    } = await ctx.runQuery(internal.weeklyReview.statsInternal, { nowMs });

    // What ACTUALLY went out on X this week — the account's real timeline, not
    // just the pipeline (posts made directly on X count too).
    let postsOnX: {
      firstLine: string;
      likes: number;
      replies: number;
      reposts: number;
      views: number;
      postedAt: string;
    }[] = [];
    const handle: string | null = await ctx.runQuery(
      internal.growth.handleInternal,
      {},
    );
    if (handle) {
      try {
        // Timeline read, not search — search omits small accounts entirely.
        const { tweets } = await gxUserTweets(handle, {
          maxAgeMs: 7 * 86_400_000,
          maxTweets: 50,
        });
        console.log(`weeklyReview postsOnX @${handle}: ${tweets.length} posts this week`);
        postsOnX = tweets.map((t) => ({
          firstLine: t.text.split("\n")[0].slice(0, 140),
          likes: t.public_metrics.like_count,
          replies: t.public_metrics.reply_count,
          reposts: t.public_metrics.retweet_count,
          views: t.public_metrics.impression_count ?? 0,
          postedAt: t.created_at.slice(0, 10),
        }));
      } catch (e) {
        console.error(
          `Review own-posts pull failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    const fullStats = { ...stats, postsOnX };
    const statsJson = JSON.stringify(fullStats);
    const weekOf = new Date(nowMs).toISOString().slice(0, 10);

    // Stats-only fallback so the tab never breaks when the model is unavailable.
    const delta =
      stats.followerSeries.length >= 2
        ? stats.followerSeries[stats.followerSeries.length - 1].count -
          stats.followerSeries[0].count
        : null;
    const replyTotal = Object.values(stats.repliesPerDay).reduce(
      (s, n) => s + n,
      0,
    );
    let markdown = `## Week of ${weekOf}\n\n- Followers: ${delta != null ? (delta >= 0 ? "+" : "") + delta : "n/a"} this week\n- Posts on X: ${postsOnX.length}\n- Replies sent: ${replyTotal}\n\n*Automated summary — Claude review unavailable this week.*`;
    let status = "fallback";

    const key = process.env.anthropic_api_key;
    if (key) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-opus-4-8",
            max_tokens: 2000,
            thinking: { type: "adaptive" },
            system: REVIEW_SYSTEM,
            messages: [
              {
                role: "user",
                content: `Week ending ${weekOf}. Stats:\n${statsJson}`,
              },
            ],
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            content?: { type: string; text?: string }[];
          };
          const text = (json.content ?? [])
            .filter((b) => b.type === "text")
            .map((b) => b.text ?? "")
            .join("")
            .trim();
          if (text) {
            markdown = text;
            status = "ok";
          }
        } else {
          console.error(
            `Anthropic review ${res.status}: ${(await res.text()).slice(0, 300)}`,
          );
        }
      } catch (e) {
        console.error(
          `Anthropic review failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    await ctx.runMutation(internal.weeklyReview.store, {
      weekOf,
      markdown,
      statsJson,
    });
    await reportCron(ctx, "weekly-review", true, status);
    return { status };
  },
});

/** Admin: "Generate review now" button. */
export const generate = action({
  args: {},
  returns: v.object({ status: v.string() }),
  handler: async (ctx) => {
    await ctx.runQuery(internal.growth._assertAdmin, {});
    const result: { status: string } = await ctx.runAction(
      internal.weeklyReview.generateInternal,
      {},
    );
    return result;
  },
});

/** Admin: newest review. */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("weeklyReviews")
      .withIndex("by_createdAt")
      .order("desc")
      .first();
  },
});

/** Admin: review history (newest first). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_createdAt")
      .order("desc")
      .take(12);
    return rows.map((r) => ({
      _id: r._id,
      weekOf: r.weekOf,
      markdown: r.markdown,
      createdAt: r.createdAt,
    }));
  },
});
