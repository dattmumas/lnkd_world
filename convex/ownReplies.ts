import {
  action,
  internalAction,
  internalMutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import { gxUserTweets } from "./lib/getxapi";
import { reportCron } from "./lib/cronReport";

/**
 * Own-reply tracking (hourly cron): pull every reply the tracked account posts
 * on X — whether it went through the dashboard or not — so the daily reply
 * counts, reply ROI, and attribution reflect reality, not just queue clicks.
 * Replies to self (thread parts) are excluded. The replied-to account comes
 * from the reply text's leading @mention (X's parent-author convention) plus
 * the raw inReplyToUserId for exact joins against followerGains.
 */

const WINDOW_HOURS = 26; // overlap across runs; dedup by tweetId
const KEEP_DAYS = 90;

const replyRow = v.object({
  tweetId: v.string(),
  repliedToUsername: v.optional(v.string()),
  repliedToUserId: v.optional(v.string()),
  inReplyToTweetId: v.optional(v.string()),
  text: v.string(),
  likes: v.optional(v.number()),
  views: v.optional(v.number()),
  createdAt: v.number(),
});

interface ReplyRow {
  tweetId: string;
  repliedToUsername?: string;
  repliedToUserId?: string;
  inReplyToTweetId?: string;
  text: string;
  likes?: number;
  views?: number;
  createdAt: number;
}

export const trackInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), found: v.number() }),
  handler: async (ctx): Promise<{ status: string; found: number }> => {
    try {
      const handle: string | null = await ctx.runQuery(
        internal.growth.handleInternal,
        {},
      );
      if (!handle) return { status: "no-config", found: 0 };

      // Timeline read, not search — X's search index omits small accounts
      // entirely (lib/getxapi.ts gxUserTweets).
      const { tweets } = await gxUserTweets(handle, {
        includeReplies: true,
        maxAgeMs: WINDOW_HOURS * 3_600_000,
        maxTweets: 100,
      });
      const replies = tweets.filter((t) => t.is_reply);

      const rows: ReplyRow[] = replies.flatMap((t) => {
        const mention = t.text.match(/^@(\w{1,15})/);
        const repliedToUsername = mention?.[1]?.toLowerCase();
        // Replies to self are thread parts, not engagement.
        if (repliedToUsername === handle.toLowerCase()) return [];
        return [
          {
            tweetId: t.id,
            repliedToUsername,
            repliedToUserId: t.in_reply_to_user_id,
            inReplyToTweetId: t.in_reply_to_tweet_id,
            text: t.text.slice(0, 500),
            likes: t.public_metrics.like_count,
            views: t.public_metrics.impression_count || undefined,
            createdAt: Date.parse(t.created_at) || Date.now(),
          },
        ];
      });

      console.log(
        `ownReplies @${handle}: timeline=${tweets.length} replies=${replies.length} keptAfterSelfFilter=${rows.length}`,
      );
      if (rows.length > 0) {
        await ctx.runMutation(internal.ownReplies.recordBatch, { rows });
      }
      await ctx.runMutation(internal.ownReplies.pruneInternal, {});
      await reportCron(
        ctx,
        "own-replies",
        true,
        `timeline=${tweets.length} replies=${rows.length}`,
      );
      return { status: "ok", found: rows.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await reportCron(ctx, "own-replies", false, message);
      throw e;
    }
  },
});

/** Insert unseen replies; refresh metrics on ones still in the window. */
export const recordBatch = internalMutation({
  args: { rows: v.array(replyRow) },
  returns: v.null(),
  handler: async (ctx, { rows }) => {
    const now = Date.now();
    for (const row of rows) {
      const existing = await ctx.db
        .query("ownReplies")
        .withIndex("by_tweetId", (q) => q.eq("tweetId", row.tweetId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { likes: row.likes, views: row.views });
      } else {
        await ctx.db.insert("ownReplies", { ...row, firstSeenAt: now });
      }
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
      .query("ownReplies")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(200);
    for (const r of old) await ctx.db.delete(r._id);
    return old.length;
  },
});

/** Admin: recent tracked replies, newest first (Analytics tab). Likes/views
 * refresh while a reply is inside the 26h tracking window, then freeze. */
export const list = query({
  args: { sinceMs: v.number() }, // client passes a day-rounded cutoff
  handler: async (ctx, { sinceMs }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("ownReplies")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", sinceMs))
      .order("desc")
      .take(200);
    return rows.map((r) => ({
      tweetId: r.tweetId,
      repliedToUsername: r.repliedToUsername ?? null,
      text: r.text,
      likes: r.likes ?? 0,
      views: r.views ?? null,
      createdAt: r.createdAt,
      link: `https://x.com/i/status/${r.tweetId}`,
    }));
  },
});

/** Admin: manual "Track replies now" trigger. */
export const track = action({
  args: {},
  returns: v.object({ status: v.string(), found: v.number() }),
  handler: async (ctx) => {
    await ctx.runQuery(internal.growth._assertAdmin, {});
    const result: { status: string; found: number } = await ctx.runAction(
      internal.ownReplies.trackInternal,
      {},
    );
    return result;
  },
});
