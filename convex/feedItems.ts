import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import {
  priority,
  affinityMultiplier,
  EXPIRE_HALF_LIVES,
} from "./lib/queueScore";

/**
 * Normalized cross-feed queue items (see convex/schema.ts feedItems). Every feed
 * pipeline emits its picks here via upsertBatch after storing its HTML snapshot;
 * convex/queue.ts serves and acts on them. Emission is best-effort: pipelines
 * wrap the call in try/catch so a queue failure never breaks a feed refresh.
 */

const RETENTION_DAYS = 14;
const ACTION_RETENTION_DAYS = 90;

const itemPayload = v.object({
  kind: v.union(v.literal("x-post"), v.literal("article")),
  externalId: v.string(),
  feed: v.string(),
  title: v.optional(v.string()),
  text: v.string(),
  link: v.string(),
  imageUrl: v.optional(v.string()),
  source: v.string(),
  authorUsername: v.optional(v.string()),
  authorName: v.optional(v.string()),
  authorAvatar: v.optional(v.string()),
  authorFollowers: v.optional(v.number()),
  authorVerified: v.optional(v.boolean()),
  authorNiche: v.optional(v.string()),
  replies: v.optional(v.number()),
  reposts: v.optional(v.number()),
  likes: v.optional(v.number()),
  quotes: v.optional(v.number()),
  bookmarkCount: v.optional(v.number()),
  views: v.optional(v.number()),
  angle: v.optional(v.string()),
  baseScore: v.number(),
  halfLifeHours: v.number(),
  scoreReason: v.string(),
  publishedAt: v.number(), // 0 = unknown; anchored to first-seen below
});

export const upsertBatch = internalMutation({
  args: { items: v.array(itemPayload) },
  returns: v.object({ inserted: v.number(), merged: v.number() }),
  handler: async (ctx, { items }) => {
    const now = Date.now();
    let inserted = 0;
    let merged = 0;

    for (const it of items) {
      const { feed, ...fields } = it;
      const existing = await ctx.db
        .query("feedItems")
        .withIndex("by_externalId", (q) => q.eq("externalId", it.externalId))
        .first();

      // Acted-on / expired rows never resurface — the early cron re-emits the
      // same tweets every 20 min, and this is what makes Skip/Engaged stick.
      if (existing && existing.status !== "queued") continue;

      if (existing) {
        // Refresh metrics + membership; adopt the incoming scoring only if it
        // beats the current decayed priority (an early post later curated into
        // Trending upgrades instead of staying pinned to its stale scoring).
        const incomingMult = await lookupAffinityMult(ctx, it.authorUsername, it.source);
        const incomingWins =
          priority(
            { baseScore: it.baseScore, halfLifeHours: it.halfLifeHours, affinityMult: incomingMult, publishedAt: it.publishedAt || existing.publishedAt },
            now,
          ) > priority(existing, now);

        // Build the patch from MATERIAL changes only. The early feed re-emits
        // the same items every 5 minutes; unconditionally patching lastSeenAt
        // + unchanged metrics was pure write bandwidth (and re-ran every
        // getQueue subscription each cycle).
        const patch: Record<string, unknown> = {};
        if (!existing.sourceFeeds.includes(feed)) {
          patch.sourceFeeds = [...existing.sourceFeeds, feed];
        }
        for (const key of ["replies", "reposts", "likes", "quotes", "bookmarkCount", "views"] as const) {
          const incoming = it[key];
          if (incoming != null && incoming !== existing[key]) patch[key] = incoming;
        }
        if (!existing.imageUrl && it.imageUrl) patch.imageUrl = it.imageUrl;
        if (!existing.angle && it.angle) patch.angle = it.angle;
        if (incomingWins) {
          patch.primaryFeed = feed;
          patch.baseScore = it.baseScore;
          patch.halfLifeHours = it.halfLifeHours;
          patch.affinityMult = incomingMult;
          patch.scoreReason = it.scoreReason;
        }
        // Bump lastSeenAt only when something changed or it's gone stale —
        // it's informational, not worth a write per cycle.
        if (Object.keys(patch).length > 0 || now - existing.lastSeenAt > 3_600_000) {
          patch.lastSeenAt = now;
          await ctx.db.patch(existing._id, patch);
        }
        merged++;
        continue;
      }

      const affinityMult = await lookupAffinityMult(ctx, it.authorUsername, it.source);
      await ctx.db.insert("feedItems", {
        ...fields,
        sourceFeeds: [feed],
        primaryFeed: feed,
        affinityMult,
        scoreReason:
          affinityMult === 1
            ? it.scoreReason
            : `${it.scoreReason} · ${affinityMult > 1 ? "boosted" : "damped"} ${affinityMult.toFixed(2)}× by your history`,
        status: "queued",
        publishedAt: it.publishedAt || now,
        firstSeenAt: now,
        lastSeenAt: now,
      });
      inserted++;
    }
    return { inserted, merged };
  },
});

/**
 * Recent x-posts across all feeds — the deal radar classifies watchlist posts
 * (VC firms announce their deals here) without any extra API spend.
 */
export const recentXPosts = internalQuery({
  args: { sinceMs: v.number() },
  returns: v.array(
    v.object({
      externalId: v.string(),
      text: v.string(),
      link: v.string(),
      source: v.string(),
      publishedAt: v.number(),
    }),
  ),
  handler: async (ctx, { sinceMs }) => {
    const rows = await ctx.db
      .query("feedItems")
      .withIndex("by_publishedAt", (q) => q.gt("publishedAt", sinceMs))
      .take(300);
    return rows
      .filter((r) => r.kind === "x-post")
      .map((r) => ({
        externalId: r.externalId,
        text: r.text,
        link: r.link,
        source: r.source,
        publishedAt: r.publishedAt,
      }));
  },
});

/** Affinity multiplier for an item: author history first, else source history. */
async function lookupAffinityMult(
  ctx: MutationCtx,
  authorUsername: string | undefined,
  source: string,
): Promise<number> {
  const subjects: ["author" | "source", string][] = [];
  if (authorUsername) subjects.push(["author", authorUsername.toLowerCase()]);
  subjects.push(["source", source.toLowerCase()]);
  for (const [subjectType, subject] of subjects) {
    const row = await ctx.db
      .query("affinities")
      .withIndex("by_subject", (q) => q.eq("subjectType", subjectType).eq("subject", subject))
      .first();
    if (row) return affinityMultiplier(row);
  }
  return 1;
}

/**
 * Daily retention (crons.ts): delete items past 14 days (any status — affinity
 * lives in aggregates, rows are disposable), expire queued items decayed past
 * ~8 half-lives (<0.4% of base), and drop action events past 90 days.
 */
export const prune = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), expired: v.number(), actionsDeleted: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();

    const old = await ctx.db
      .query("feedItems")
      .withIndex("by_publishedAt", (q) =>
        q.lt("publishedAt", now - RETENTION_DAYS * 24 * 3_600_000),
      )
      .take(500);
    for (const row of old) await ctx.db.delete(row._id);

    const queued = await ctx.db
      .query("feedItems")
      .withIndex("by_status_publishedAt", (q) => q.eq("status", "queued"))
      .take(500);
    let expired = 0;
    for (const row of queued) {
      const ageHours = (now - row.publishedAt) / 3_600_000;
      if (ageHours > EXPIRE_HALF_LIVES * row.halfLifeHours) {
        await ctx.db.patch(row._id, { status: "expired" });
        expired++;
      }
    }

    const oldActions = await ctx.db
      .query("itemActions")
      .withIndex("by_createdAt", (q) =>
        q.lt("createdAt", now - ACTION_RETENTION_DAYS * 24 * 3_600_000),
      )
      .take(1000);
    for (const row of oldActions) await ctx.db.delete(row._id);

    // Early-feed emission markers age out with the items they guard.
    const oldSeen = await ctx.db
      .query("earlySeen")
      .withIndex("by_createdAt", (q) =>
        q.lt("createdAt", now - RETENTION_DAYS * 24 * 3_600_000),
      )
      .take(1000);
    for (const row of oldSeen) await ctx.db.delete(row._id);

    return { deleted: old.length, expired, actionsDeleted: oldActions.length };
  },
});
