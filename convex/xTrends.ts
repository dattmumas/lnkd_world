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
  scorePost,
  renderHtml,
  suggestReply,
  curateTopPosts,
  type RankedPost,
} from "./lib/xfeed";
import { gxSearch } from "./lib/getxapi";

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
// High-recall queries (topic AND a broad business/science signal) cast a wide net
// across On Label's space; the author-aware curator provides the precision.
const QUERIES: { niche: string; q: string }[] = [
  {
    niche: "Longevity & aging",
    q: '(longevity OR healthspan OR "anti-aging" OR senolytics OR rapamycin OR geroscience OR aging OR "longevity biotech") (startup OR funding OR raised OR biotech OR clinical OR FDA OR trial OR company OR research OR data OR study OR founder OR investor OR therapy) -is:retweet -is:reply lang:en',
  },
  {
    niche: "Biotech & pharma",
    q: '(biotech OR pharma OR "drug development" OR therapeutics OR oncology OR "digital health" OR healthtech OR diagnostics OR "life sciences") (raised OR funding OR Series OR FDA OR approval OR trial OR data OR readout OR acquire OR IPO OR launch OR pipeline OR deal) -is:retweet -is:reply lang:en',
  },
  {
    niche: "Metabolic & GLP-1",
    q: '(GLP-1 OR "metabolic health" OR obesity OR Ozempic OR Zepbound OR semaglutide OR tirzepatide OR diabetes) (study OR data OR trial OR market OR company OR FDA OR sales OR launch OR approval OR research) -is:retweet -is:reply lang:en',
  },
  {
    niche: "Founders & funding",
    q: '(longevity OR biotech OR healthspan OR "health tech" OR "life sciences") (founder OR raising OR "raised" OR fund OR funding OR building OR startup OR "Series A" OR seed OR launch) -is:retweet -is:reply lang:en',
  },
];

const MIN_W = 80; // candidate floor — broad pool; Opus curation does the quality cut
const WINDOW_HOURS = 24; // candidate window — wider net; the curator does the focusing
const MAX_AGE_MS = WINDOW_HOURS * 3600 * 1000;
const CANDIDATE_CAP_PER_NICHE = 15; // top candidates per niche before curation
const MAX_CANDIDATES = 50; // total candidates handed to the curation model
const FINAL_COUNT = 10; // curated posts surfaced per refresh

/** The actual refresh: search X, rank, render, store. Called by cron + admin trigger. */
export const refreshInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const generatedAt = new Date().toISOString();
    const nowMs = Date.now();
    try {
      // Posts already surfaced before — excluded so refreshes don't repeat.
      const seen = new Set<string>(
        await ctx.runQuery(internal.xTrends.seenIds, {}),
      );

      // 1) Gather a broad candidate pool across niches (velocity-ranked, deduped).
      const byId = new Map<string, RankedPost>();
      let queryFailures = 0;
      for (const { q } of QUERIES) {
        let tweets, users;
        try {
          ({ tweets, users } = await gxSearch(q, {
            product: "Top", // engagement-sorted — best candidates for trending
            maxAgeMs: MAX_AGE_MS,
            maxTweets: 60,
          }));
        } catch (err) {
          // One flaky niche query shouldn't sink the whole feed — skip it.
          queryFailures++;
          console.error(
            `xTrends query failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
        const userById = new Map(users.map((u) => [u.id, u]));
        const ranked = tweets
          .map((t) => {
            const { W, score } = scorePost(t, nowMs);
            return { tweet: t, user: userById.get(t.author_id), W, score };
          })
          .filter(
            (p) =>
              p.W >= MIN_W &&
              !seen.has(p.tweet.id) &&
              nowMs - Date.parse(p.tweet.created_at) <= MAX_AGE_MS,
          )
          .sort((a, b) => b.score - a.score)
          .slice(0, CANDIDATE_CAP_PER_NICHE);
        for (const p of ranked) if (!byId.has(p.tweet.id)) byId.set(p.tweet.id, p);
      }
      // Only abort if every query failed — otherwise build from what we got.
      if (queryFailures === QUERIES.length) {
        throw new Error(`All ${QUERIES.length} getXAPI search queries failed.`);
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
        subtitle: `curated for On Label · the business of health & longevity · last ${WINDOW_HOURS}h`,
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
      if (selected.length > 0) {
        await ctx.runMutation(internal.xTrends.recordSeen, {
          ids: selected.map((p) => p.tweet.id),
        });
      }
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

/** Maintenance: clear the surfaced-posts set (resets the dedup pool). */
export const clearSeen = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db.query("seenXPosts").collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return rows.length;
  },
});

/** Tweet IDs already surfaced (for excluding repeats on refresh). */
export const seenIds = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const rows = await ctx.db.query("seenXPosts").collect();
    return rows.map((r) => r.tweetId);
  },
});

/** Record surfaced tweet IDs and prune entries older than 14 days. */
export const recordSeen = internalMutation({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    for (const tweetId of ids) {
      await ctx.db.insert("seenXPosts", { tweetId, createdAt });
    }
    const cutoff = new Date(now - 14 * 24 * 3600 * 1000).toISOString();
    const old = await ctx.db
      .query("seenXPosts")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(1000);
    for (const r of old) await ctx.db.delete(r._id);
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
