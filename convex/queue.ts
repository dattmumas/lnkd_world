import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSubscriber } from "./lib/auth";
import { priority, MIN_VISIBLE_PRIORITY } from "./lib/queueScore";

/**
 * The unified engagement queue: cross-feed items (convex/feedItems.ts) served
 * priority-ordered, plus the action endpoint that records behavior and retires
 * items. Rendered by components/queue-feed.tsx.
 */

const WINDOW_MS = 7 * 24 * 3_600_000; // queued items older than this can't score
const READ_CAP = 500; // hard bound; real live-set is a few hundred by pruning
const PAGE = 60;

/**
 * Queued items, best-first. Priority decays with wall-clock time but Convex
 * queries only re-run on data changes, so the raw scoring fields ship with each
 * row and the client re-sorts on a timer with the same lib/queueScore functions.
 */
export const getQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireSubscriber(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("feedItems")
      .withIndex("by_status_publishedAt", (q) =>
        q.eq("status", "queued").gt("publishedAt", now - WINDOW_MS),
      )
      .order("desc")
      .take(READ_CAP);
    return rows
      .map((r) => ({
        id: r._id,
        kind: r.kind,
        primaryFeed: r.primaryFeed,
        sourceFeeds: r.sourceFeeds,
        title: r.title,
        text: r.text,
        link: r.link,
        imageUrl: r.imageUrl,
        source: r.source,
        authorUsername: r.authorUsername,
        authorName: r.authorName,
        authorAvatar: r.authorAvatar,
        authorFollowers: r.authorFollowers,
        authorVerified: r.authorVerified,
        authorNiche: r.authorNiche,
        replies: r.replies,
        reposts: r.reposts,
        likes: r.likes,
        views: r.views,
        draft: r.draft,
        draftKind: r.draftKind,
        angle: r.angle,
        baseScore: r.baseScore,
        halfLifeHours: r.halfLifeHours,
        affinityMult: r.affinityMult,
        scoreReason: r.scoreReason,
        publishedAt: r.publishedAt,
        priority: priority(r, now),
      }))
      .filter((r) => r.priority >= MIN_VISIBLE_PRIORITY)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, PAGE);
  },
});

/**
 * Record a queue action. `engaged`/`skipped` retire the item (and the upsert
 * path never resurrects non-queued rows, so the decision sticks across
 * refreshes). Every action also feeds the author/source affinity aggregates
 * that scale future items' scores (lib/queueScore.affinityMultiplier).
 */
export const act = mutation({
  args: {
    itemId: v.id("feedItems"),
    action: v.union(
      v.literal("open"),
      v.literal("copy_draft"),
      v.literal("engaged"),
      v.literal("skipped"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { itemId, action }) => {
    await requireSubscriber(ctx);
    const item = await ctx.db.get(itemId);
    if (!item) return null; // already pruned — nothing to record against

    const now = Date.now();
    await ctx.db.insert("itemActions", {
      itemId,
      externalId: item.externalId,
      action,
      kind: item.kind,
      primaryFeed: item.primaryFeed,
      authorUsername: item.authorUsername,
      source: item.source,
      createdAt: now,
    });

    if ((action === "engaged" || action === "skipped") && item.status === "queued") {
      await ctx.db.patch(itemId, { status: action });
    }

    // open/copy_draft both count as "opened" — interest short of engagement.
    const counter =
      action === "engaged" ? "engaged" : action === "skipped" ? "skipped" : "opened";
    const subjects: ["author" | "source", string][] = [];
    if (item.authorUsername) subjects.push(["author", item.authorUsername.toLowerCase()]);
    subjects.push(["source", item.source.toLowerCase()]);
    for (const [subjectType, subject] of subjects) {
      const row = await ctx.db
        .query("affinities")
        .withIndex("by_subject", (q) => q.eq("subjectType", subjectType).eq("subject", subject))
        .first();
      if (row) {
        await ctx.db.patch(row._id, { [counter]: row[counter] + 1, updatedAt: now });
      } else {
        await ctx.db.insert("affinities", {
          subjectType,
          subject,
          engaged: 0,
          skipped: 0,
          opened: 0,
          [counter]: 1,
          updatedAt: now,
        });
      }
    }
    return null;
  },
});

/**
 * Exponential forgetting on affinity counters (daily cron): ×0.977/day ≈ 30-day
 * half-life, so a burst of engagement months ago stops steering today's queue.
 * Rows that decay to nothing are dropped.
 */
export const decayAffinities = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db.query("affinities").take(2000);
    const decay = 0.977;
    for (const row of rows) {
      const engaged = row.engaged * decay;
      const skipped = row.skipped * decay;
      const opened = row.opened * decay;
      if (engaged + skipped + opened < 0.1) {
        await ctx.db.delete(row._id);
      } else {
        await ctx.db.patch(row._id, { engaged, skipped, opened });
      }
    }
    return rows.length;
  },
});
