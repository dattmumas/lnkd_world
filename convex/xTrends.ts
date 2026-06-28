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
  suggestReply,
  curateTopPosts,
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

const MIN_W = 100; // candidate floor — broad pool; Opus curation does the quality cut
const WINDOW_HOURS = 6; // only consider posts from the last N hours (fresh/early)
const MAX_AGE_MS = WINDOW_HOURS * 3600 * 1000;
const CANDIDATE_CAP_PER_NICHE = 12; // top candidates per niche before curation
const MAX_CANDIDATES = 36; // total candidates handed to the curation model
const FINAL_COUNT = 10; // curated posts surfaced per refresh

/** The actual refresh: search X, rank, render, store. Called by cron + admin trigger. */
export const refreshInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const generatedAt = new Date().toISOString();
    const nowMs = Date.now();
    try {
      const startTime = new Date(nowMs - MAX_AGE_MS).toISOString();

      // 1) Gather a broad candidate pool across niches (velocity-ranked, deduped).
      const byId = new Map<string, RankedPost>();
      for (const { q } of QUERIES) {
        const { tweets, users } = await searchRecent(q, startTime);
        const userById = new Map(users.map((u) => [u.id, u]));
        const ranked = tweets
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
          .slice(0, CANDIDATE_CAP_PER_NICHE);
        for (const p of ranked) if (!byId.has(p.tweet.id)) byId.set(p.tweet.id, p);
      }
      const pool = [...byId.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CANDIDATES);

      // 2) Opus 4.8 curates the pool down to the top N most relevant to On Label.
      const selected = await curateTopPosts(pool, FINAL_COUNT);

      // 3) AI-suggested reply per selected post (parallel; degrades to no reply).
      await Promise.all(
        selected.map(async (p) => {
          const reply = await suggestReply(p.tweet.text);
          if (reply) p.reply = reply;
        }),
      );

      // 4) Render the curated list (single ranked group, no niche headers).
      const html = renderHtml([{ niche: "", posts: selected }], {
        title: "Trending on X",
        subtitle: `curated for On Label · early engagement, posts from the past ${WINDOW_HOURS}h`,
        generatedAt,
        nowMs,
      });
      const status = selected.length > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.xTrends.store, {
        generatedAt,
        html,
        status,
        count: selected.length,
      });
      return { status, count: selected.length };
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
