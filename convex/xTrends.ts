import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import {
  searchRecent,
  scorePost,
  renderHtml,
  type FeedGroup,
  type RankedPost,
} from "./lib/xfeed";

/**
 * "Trending on X" — pulls real posts from the X API (recent search) and ranks
 * them by an EARLY-trending score (weighted-engagement velocity), rendered into
 * the HTML stored in `xTrendsSnapshots` and served by `feed.getPage`.
 *
 * Ranking is research-grounded (see convex/lib/xfeed.ts): X's open-sourced weights
 * (replies ≫ reposts ≫ likes) normalized by post age (velocity). Sources: X
 * recommendation-algorithm; NYU Cybersecurity for Democracy on early virality.
 */

// Niche search queries (recent search; freshness window applied via start_time).
const QUERIES: { niche: string; q: string }[] = [
  {
    niche: "Longevity",
    q: '(longevity OR healthspan OR rapamycin OR "anti-aging" OR senolytics OR epigenetic OR NAD) -is:retweet -is:reply lang:en',
  },
  {
    niche: "Health",
    q: '("metabolic health" OR GLP-1 OR "zone 2" OR VO2max OR creatine OR "blood sugar" OR "deep sleep") -is:retweet -is:reply lang:en',
  },
  {
    niche: "Health & longevity startups",
    q: '((startup OR founder OR raised OR "seed round" OR "Series A") (health OR biotech OR longevity OR wellness OR diagnostics)) -is:retweet -is:reply lang:en',
  },
];

const TOP_N = 6; // posts kept per niche
const MIN_W = 175; // weighted-engagement floor — real traction, not noise (tunable)
const WINDOW_HOURS = 6; // only consider posts from the last N hours (fresh/early)
const MAX_AGE_MS = WINDOW_HOURS * 3600 * 1000;

/** The actual refresh: search X, rank, render, store. Called by cron + admin trigger. */
export const refreshInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const generatedAt = new Date().toISOString();
    const nowMs = Date.now();
    try {
      const startTime = new Date(nowMs - MAX_AGE_MS).toISOString();
      const groups: FeedGroup[] = [];
      let total = 0;
      for (const { niche, q } of QUERIES) {
        const { tweets, users } = await searchRecent(q, startTime);
        const userById = new Map(users.map((u) => [u.id, u]));
        const ranked: RankedPost[] = tweets
          .map((t) => {
            const { W, score } = scorePost(t, nowMs);
            return { tweet: t, user: userById.get(t.author_id), W, score };
          })
          .filter(
            (p) =>
              p.W >= MIN_W &&
              nowMs - Date.parse(p.tweet.created_at) <= MAX_AGE_MS,
          )
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_N);
        groups.push({ niche, posts: ranked });
        total += ranked.length;
      }
      const html = renderHtml(groups, {
        title: "Trending on X",
        subtitle: `early engagement velocity (replies ≫ reposts ≫ likes), posts from the past ${WINDOW_HOURS}h`,
        generatedAt,
        nowMs,
      });
      const status = total > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.xTrends.store, {
        generatedAt,
        html,
        status,
        count: total,
      });
      return { status, count: total };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.xTrends.store, {
        generatedAt,
        html: "",
        status: "error",
        count: 0,
        error: message,
      });
      throw new Error(`X trends refresh failed: ${message}`);
    }
  },
});

/** Store a snapshot, pruning to the last 14. */
export const store = internalMutation({
  args: {
    generatedAt: v.string(),
    html: v.string(),
    status: v.string(),
    count: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("xTrendsSnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    if (old.length > 14) {
      for (const snap of old.slice(0, old.length - 14)) {
        await ctx.db.delete(snap._id);
      }
    }
    return await ctx.db.insert("xTrendsSnapshots", {
      generatedAt: args.generatedAt,
      html: args.html,
      status: args.status,
      count: args.count,
      error: args.error,
      createdAt: new Date().toISOString(),
    });
  },
});

/** Admin gate for the manual trigger (actions have no db, so check runs as a query). */
export const _assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

/** Admin-only manual refresh (the cron handles the daily run automatically). */
export const refresh = action({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const _admin: null = await ctx.runQuery(internal.xTrends._assertAdmin, {});
    // Explicit annotation breaks same-file runAction return-type circularity.
    const result: { status: string; count: number } = await ctx.runAction(
      internal.xTrends.refreshInternal,
      {},
    );
    return { ok: true, status: result.status, count: result.count };
  },
});
