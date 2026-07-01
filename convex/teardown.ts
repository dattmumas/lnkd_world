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
  weightedEngagement,
  renderHtml,
  type RankedPost,
  type XUser,
  type FeedGroup,
} from "./lib/xfeed";
import { gxSearch } from "./lib/getxapi";

/**
 * "Content Teardown" — the top-performing recent posts from your emulation list
 * (the Creators watchlist) and from the niche at large, ranked by engagement, so
 * you can study what actually earns follows. Served by feed.getPage as "teardown".
 */

const WINDOW_DAYS = 30;
const MAX_AGE_MS = WINDOW_DAYS * 24 * 3600 * 1000;
const HANDLES_PER_QUERY = 15;
const LIST_TOP_N = 18;
const NICHE_TOP_N = 12;

// Broad niche query — what's winning in On Label's space (health / longevity / biotech).
const NICHE_QUERY =
  '(longevity OR healthspan OR biotech OR peptides OR "metabolic health" OR GLP-1 OR "health tech" OR "life sciences") -is:retweet -is:reply lang:en';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function rank(
  byId: Map<string, RankedPost>,
  tweets: { id: string; text: string; created_at: string; author_id: string; public_metrics: { reply_count: number; retweet_count: number; like_count: number; quote_count?: number; bookmark_count?: number; impression_count?: number } }[],
  users: XUser[],
) {
  const userById = new Map(users.map((u) => [u.id, u]));
  for (const t of tweets) {
    if (byId.has(t.id)) continue;
    const W = weightedEngagement(t.public_metrics);
    byId.set(t.id, { tweet: t, user: userById.get(t.author_id), W, score: W });
  }
}

export const refreshInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const generatedAt = new Date().toISOString();
    const nowMs = Date.now();
    try {
      const handles: string[] = await ctx.runQuery(
        internal.creators.activeHandles,
        {},
      );

      // Group 1 — top posts from your emulation list.
      const listById = new Map<string, RankedPost>();
      let failures = 0;
      let queries = 0;
      for (const group of chunk(handles, HANDLES_PER_QUERY)) {
        queries++;
        const q = `(${group.map((h) => `from:${h}`).join(" OR ")}) -is:retweet -is:reply lang:en`;
        try {
          const { tweets, users } = await gxSearch(q, {
            product: "Top",
            maxAgeMs: MAX_AGE_MS,
            maxTweets: 80,
          });
          rank(listById, tweets, users);
        } catch (err) {
          failures++;
          console.error(
            `Teardown list query failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // Group 2 — top posts in the niche at large.
      const nicheById = new Map<string, RankedPost>();
      queries++;
      try {
        const { tweets, users } = await gxSearch(NICHE_QUERY, {
          product: "Top",
          maxAgeMs: MAX_AGE_MS,
          maxTweets: 80,
        });
        rank(nicheById, tweets, users);
      } catch (err) {
        failures++;
        console.error(
          `Teardown niche query failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (failures === queries) {
        throw new Error(`All ${queries} getXAPI search queries failed.`);
      }

      const listPosts = [...listById.values()]
        .sort((a, b) => b.W - a.W)
        .slice(0, LIST_TOP_N);
      const nichePosts = [...nicheById.values()]
        .filter((p) => !listById.has(p.tweet.id))
        .sort((a, b) => b.W - a.W)
        .slice(0, NICHE_TOP_N);

      const groups: FeedGroup[] = [];
      if (listPosts.length) groups.push({ niche: "Top from your list", posts: listPosts });
      if (nichePosts.length) groups.push({ niche: "Top in the niche", posts: nichePosts });

      const html = renderHtml(groups, {
        title: "Content Teardown",
        subtitle: `top-performing posts · last ${WINDOW_DAYS}d · study what earns follows`,
        generatedAt,
        nowMs,
      });
      const count = listPosts.length + nichePosts.length;
      const status = count > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.teardown.store, {
        generatedAt,
        html,
        status,
        count,
      });
      return { status, count };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.teardown.store, {
        generatedAt,
        html: "",
        status: "error",
        count: 0,
        error: message,
      });
      throw new Error(`Teardown refresh failed: ${message}`);
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
    // Keep the last 3 snapshots, but never prune the most recent "ok" one —
    // getPage serves the latest ok, so a run of failed refreshes must not delete it.
    const all = await ctx.db
      .query("teardownSnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    const latestOkId = [...all].reverse().find((s) => s.status === "ok")?._id;
    for (const snap of all
      .slice(0, Math.max(0, all.length - 3))
      .filter((s) => s._id !== latestOkId)) {
      await ctx.db.delete(snap._id);
    }
    return await ctx.db.insert("teardownSnapshots", {
      generatedAt: args.generatedAt,
      html: args.html,
      status: args.status,
      count: args.count,
      error: args.error,
      createdAt: new Date().toISOString(),
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

/** Admin-only manual refresh (the cron handles the daily run). */
export const refresh = action({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const _admin: null = await ctx.runQuery(internal.teardown._assertAdmin, {});
    const result: { status: string; count: number } = await ctx.runAction(
      internal.teardown.refreshInternal,
      {},
    );
    return { ok: true, status: result.status, count: result.count };
  },
});
