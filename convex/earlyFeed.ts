import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin, requireSubscriber } from "./lib/auth";
import { query } from "./_generated/server";
import { renderHtml, type RankedPost, type XUser } from "./lib/xfeed";
import { gxSearch } from "./lib/getxapi";

/**
 * "Early Engagement" — the newest posts from your Creators watchlist, refreshed
 * frequently (cron) and sorted newest-first, so you can reply early (the most
 * reliable organic-reach lever on X). Served by feed.getPage for slug "early".
 *
 * Lean by design: short window, no engagement ranking, no AI replies — just fresh
 * posts you can jump on. Reuses the Creators list (convex/creators.ts).
 */

const WINDOW_MIN = 120; // surface posts from the last 2 hours
const MAX_AGE_MS = WINDOW_MIN * 60 * 1000;
const HANDLES_PER_QUERY = 15; // keep the `from:` query under the length limit
const TOP_N = 40;

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
        await ctx.runMutation(internal.earlyFeed.store, {
          generatedAt,
          html: "",
          status: "empty",
          count: 0,
        });
        return { status: "empty", count: 0 };
      }

      const byId = new Map<string, RankedPost>();
      const userById = new Map<string, XUser>();
      const groups = chunk(handles, HANDLES_PER_QUERY);
      let groupFailures = 0;
      for (const group of groups) {
        const q = `(${group.map((h) => `from:${h}`).join(" OR ")}) -is:retweet -is:reply lang:en`;
        let tweets, users;
        try {
          ({ tweets, users } = await gxSearch(q, {
            product: "Latest", // chronological — we want the freshest posts
            maxAgeMs: MAX_AGE_MS,
            maxTweets: 60,
          }));
        } catch (err) {
          groupFailures++;
          console.error(
            `Early query failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
        for (const u of users) userById.set(u.id, u);
        for (const t of tweets) {
          if (byId.has(t.id)) continue;
          // score = recency; render order is newest-first.
          byId.set(t.id, {
            tweet: t,
            user: userById.get(t.author_id),
            W: 0,
            score: Date.parse(t.created_at) || 0,
          });
        }
      }
      if (groups.length > 0 && groupFailures === groups.length) {
        throw new Error(`All ${groups.length} getXAPI search queries failed.`);
      }

      const picked = [...byId.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_N);

      const html = renderHtml([{ niche: "", posts: picked }], {
        title: "Early Engagement",
        subtitle: `newest posts from your list · last ${WINDOW_MIN}m · reply early`,
        generatedAt,
        nowMs,
      });
      // Structured cards for the interactive native /feed/early view.
      const cards = picked
        .map((p) => {
          const u = p.user;
          const m = p.tweet.public_metrics;
          return {
            tweetId: p.tweet.id,
            text: p.tweet.text,
            createdAt: p.tweet.created_at,
            username: u?.username ?? "",
            name: u?.name ?? "",
            avatar: u?.profile_image_url ?? "",
            followers: u?.public_metrics?.followers_count ?? 0,
            verified: !!u?.verified,
            permalink: u
              ? `https://x.com/${u.username}/status/${p.tweet.id}`
              : `https://x.com/i/status/${p.tweet.id}`,
            replies: m.reply_count,
            reposts: m.retweet_count,
            likes: m.like_count,
            views: m.impression_count ?? 0,
          };
        })
        .filter((c) => c.username);
      const status = picked.length > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.earlyFeed.store, {
        generatedAt,
        html,
        posts: JSON.stringify(cards),
        status,
        count: picked.length,
      });
      return { status, count: picked.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.earlyFeed.store, {
        generatedAt,
        html: "",
        status: "error",
        count: 0,
        error: message,
      });
      throw new Error(`Early feed refresh failed: ${message}`);
    }
  },
});

/** Store a snapshot, pruning to the last 14. */
export const store = internalMutation({
  args: {
    generatedAt: v.string(),
    html: v.string(),
    posts: v.optional(v.string()),
    status: v.string(),
    count: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Keep the last 3 snapshots, but never prune the most recent "ok" one —
    // getPage/getLatest serve the latest ok, so a run of failed refreshes must not delete it.
    const all = await ctx.db
      .query("earlySnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    const latestOkId = [...all].reverse().find((s) => s.status === "ok")?._id;
    for (const snap of all
      .slice(0, Math.max(0, all.length - 3))
      .filter((s) => s._id !== latestOkId)) {
      await ctx.db.delete(snap._id);
    }
    return await ctx.db.insert("earlySnapshots", {
      generatedAt: args.generatedAt,
      html: args.html,
      posts: args.posts,
      status: args.status,
      count: args.count,
      error: args.error,
      createdAt: new Date().toISOString(),
    });
  },
});

/** Subscriber: latest structured cards for the native /feed/early view. */
export const getLatest = query({
  handler: async (ctx) => {
    await requireSubscriber(ctx);
    const recent = await ctx.db
      .query("earlySnapshots")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "ok"))
      .order("desc")
      .take(3);
    const snap = recent.find((s) => s.posts);
    return {
      posts: snap?.posts ?? "[]",
      generatedAt: snap?.generatedAt ?? null,
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

/** Admin-only manual refresh (the cron handles frequent runs). */
export const refresh = action({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const _admin: null = await ctx.runQuery(internal.earlyFeed._assertAdmin, {});
    const result: { status: string; count: number } = await ctx.runAction(
      internal.earlyFeed.refreshInternal,
      {},
    );
    return { ok: true, status: result.status, count: result.count };
  },
});
