import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { postTweet, verifyCredentials } from "./lib/xoauth";
import { reportCron } from "./lib/cronReport";

/**
 * Auto-posting for the content pipeline (convex/xPosts.ts): a frequent cron
 * fires scheduled posts through the official X API (OAuth 1.0a user context,
 * lib/xoauth.ts) unless the post opted out (autoPost === false). Threads chain
 * via reply IDs. Publishing your own scheduled content is explicitly allowed
 * by X's automation rules — replies remain human-only, in the queue.
 */

const BATCH = 5; // posts per cron run — a backlog drains over a few minutes

/** Internal: scheduled + due + auto + not errored. */
export const dueInternal = internalQuery({
  args: { nowMs: v.number() },
  handler: async (ctx, { nowMs }) => {
    const due = await ctx.db
      .query("xPosts")
      .withIndex("by_status_scheduledAt", (q) =>
        q.eq("status", "scheduled").lte("scheduledAt", nowMs),
      )
      .take(50);
    return due
      .filter((p) => p.autoPost !== false && !p.postError)
      .slice(0, BATCH);
  },
});

export const recordPosted = internalMutation({
  args: { id: v.id("xPosts"), tweetId: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, tweetId }) => {
    await ctx.db.patch(id, {
      status: "posted",
      postedAt: Date.now(),
      tweetId,
      tweetUrl: `https://x.com/i/status/${tweetId}`,
      postError: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const recordError = internalMutation({
  args: { id: v.id("xPosts"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, error }) => {
    await ctx.db.patch(id, {
      postError: error.slice(0, 500),
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Admin: clear a failed post's error so the cron retries (or edit first). */
export const retry = mutation({
  args: { id: v.id("xPosts") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, { postError: undefined, updatedAt: Date.now() });
    return null;
  },
});

/** Internal: record thread progress so a failed thread resumes, not re-posts. */
export const recordThreadPart = internalMutation({
  args: { id: v.id("xPosts"), tweetId: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, tweetId }) => {
    const post = await ctx.db.get(id);
    if (!post) return null;
    await ctx.db.patch(id, {
      postedThreadIds: [...(post.postedThreadIds ?? []), tweetId],
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Post one pipeline item (single or chained thread), resuming from any
// previously posted parts (postedThreadIds). Each tweet id is recorded
// immediately after posting; the only unguarded window is a crash between
// post and record, where a retry gets X's 403 duplicate-content rejection and
// stays errored for the human. Returns the root tweet id.
async function publish(
  ctx: { runMutation: ActionCtx["runMutation"] },
  post: Doc<"xPosts">,
): Promise<string> {
  const done = post.postedThreadIds ?? [];
  let rootId: string;
  if (done.length > 0) {
    rootId = done[0];
  } else {
    rootId = await postTweet(post.body);
    await ctx.runMutation(internal.xPoster.recordThreadPart, {
      id: post._id,
      tweetId: rootId,
    });
  }
  const parts = post.threadParts ?? [];
  let prev = done.length > 0 ? done[done.length - 1] : rootId;
  // done = [root, part1, part2, ...] — parts already posted: done.length - 1.
  for (const part of parts.slice(Math.max(done.length - 1, 0))) {
    prev = await postTweet(part, prev);
    await ctx.runMutation(internal.xPoster.recordThreadPart, {
      id: post._id,
      tweetId: prev,
    });
  }
  return rootId;
}

/** The cron job: fire everything due. One failure doesn't block the rest. */
export const fireInternal = internalAction({
  args: {},
  returns: v.object({ posted: v.number(), failed: v.number() }),
  handler: async (ctx) => {
    const due: Doc<"xPosts">[] = await ctx.runQuery(
      internal.xPoster.dueInternal,
      { nowMs: Date.now() },
    );
    let posted = 0;
    let failed = 0;
    for (const post of due) {
      try {
        const tweetId = await publish(ctx, post);
        await ctx.runMutation(internal.xPoster.recordPosted, {
          id: post._id,
          tweetId,
        });
        posted++;
      } catch (e) {
        await ctx.runMutation(internal.xPoster.recordError, {
          id: post._id,
          error: e instanceof Error ? e.message : String(e),
        });
        failed++;
      }
    }
    // Per-post failures surface on the cards; the cron itself succeeded.
    await reportCron(ctx, "x-poster", true, `posted=${posted} failed=${failed}`);
    return { posted, failed };
  },
});

/** Internal: load one post for postNow (actions can't touch ctx.db). */
export const getInternal = internalQuery({
  args: { id: v.id("xPosts") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/** Admin: post one item right now via the API, whatever its schedule. */
export const postNow = action({
  args: { id: v.id("xPosts") },
  returns: v.object({ tweetId: v.string() }),
  handler: async (ctx, { id }) => {
    await ctx.runQuery(internal.growth._assertAdmin, {});
    const post: Doc<"xPosts"> | null = await ctx.runQuery(
      internal.xPoster.getInternal,
      { id },
    );
    if (!post) throw new Error("Post not found.");
    if (post.status === "posted") throw new Error("Already posted.");
    const tweetId = await publish(ctx, post);
    await ctx.runMutation(internal.xPoster.recordPosted, { id, tweetId });
    return { tweetId };
  },
});

/** Diagnostics: read-only credential check (GET /2/users/me). */
export const verifyInternal = internalAction({
  args: {},
  returns: v.object({ id: v.string(), username: v.string() }),
  handler: async () => {
    return await verifyCredentials();
  },
});
