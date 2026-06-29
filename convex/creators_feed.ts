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
} from "./lib/xfeed";
import { gxSearch } from "./lib/getxapi";

/**
 * Curated "Creators" feed — recent posts from the admin's list of X handles
 * (convex/creators.ts), ranked by engagement over the last 24h. Served by
 * feed.getPage for slug "creators".
 */

const WINDOW_HOURS = 48; // curated creators post infrequently; 24h is too sparse
const MAX_AGE_MS = WINDOW_HOURS * 3600 * 1000;
const HANDLES_PER_QUERY = 15; // keep the `from:` query under the ~512-char limit
const PER_CREATOR_CAP = 3; // max posts per creator, for variety
const TOP_N = 20;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
      if (handles.length === 0) {
        await ctx.runMutation(internal.creators_feed.store, {
          generatedAt,
          html: "",
          status: "empty",
          count: 0,
        });
        return { status: "empty", count: 0 };
      }

      const byId = new Map<string, RankedPost>();
      const userById = new Map<string, XUser>();

      for (const group of chunk(handles, HANDLES_PER_QUERY)) {
        const q = `(${group.map((h) => `from:${h}`).join(" OR ")}) -is:retweet -is:reply lang:en`;
        const { tweets, users } = await gxSearch(q, {
          product: "Latest", // chronological — recent posts from these handles
          maxAgeMs: MAX_AGE_MS,
          maxTweets: 80,
        });
        for (const u of users) userById.set(u.id, u);
        for (const t of tweets) {
          if (byId.has(t.id)) continue;
          const W = weightedEngagement(t.public_metrics);
          byId.set(t.id, { tweet: t, user: userById.get(t.author_id), W, score: W });
        }
      }

      // Rank by engagement, cap per creator for variety, take top N.
      const perCreator = new Map<string, number>();
      const picked: RankedPost[] = [];
      for (const p of [...byId.values()].sort((a, b) => b.score - a.score)) {
        const n = perCreator.get(p.tweet.author_id) ?? 0;
        if (n >= PER_CREATOR_CAP) continue;
        perCreator.set(p.tweet.author_id, n + 1);
        picked.push(p);
        if (picked.length >= TOP_N) break;
      }

      const html = renderHtml([{ niche: "", posts: picked }], {
        title: "Creators",
        subtitle: `top recent posts from your list · last ${WINDOW_HOURS}h`,
        generatedAt,
        nowMs,
      });
      const status = picked.length > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.creators_feed.store, {
        generatedAt,
        html,
        status,
        count: picked.length,
      });
      return { status, count: picked.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.creators_feed.store, {
        generatedAt,
        html: "",
        status: "error",
        count: 0,
        error: message,
      });
      throw new Error(`Creators feed refresh failed: ${message}`);
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
      .query("creatorsSnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    if (old.length > 14) {
      for (const snap of old.slice(0, old.length - 14)) {
        await ctx.db.delete(snap._id);
      }
    }
    return await ctx.db.insert("creatorsSnapshots", {
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

/** Admin-only manual refresh (cron handles the daily run). */
export const refresh = action({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const _admin: null = await ctx.runQuery(internal.creators_feed._assertAdmin, {});
    const result: { status: string; count: number } = await ctx.runAction(
      internal.creators_feed.refreshInternal,
      {},
    );
    return { ok: true, status: result.status, count: result.count };
  },
});
