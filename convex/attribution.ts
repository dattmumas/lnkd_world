import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

/**
 * Reply-target attribution (growth dashboard, Analytics tab): joins the daily
 * follower gains (convex/growth.ts → followerGains) against the engagement
 * queue's action log (itemActions.authorUsername, lowercased on both sides) to
 * answer the question aggregates can't: WHICH accounts convert when you reply.
 */

const LOOKBACK_MS = 7 * 86_400_000; // engagement window credited before a follow

/**
 * Direct conversions: followers gained since `sinceMs` whose username you had
 * engaged (replied to) in the 7 days before they followed.
 */
export const conversions = query({
  args: { sinceMs: v.number() }, // client passes a day-rounded cutoff
  handler: async (ctx, { sinceMs }) => {
    await requireAdmin(ctx);
    const gains = await ctx.db
      .query("followerGains")
      .withIndex("by_gainedAt", (q) => q.gt("gainedAt", sinceMs))
      .take(500);
    const engaged = await ctx.db
      .query("itemActions")
      .withIndex("by_action_createdAt", (q) =>
        q.eq("action", "engaged").gt("createdAt", sinceMs - LOOKBACK_MS),
      )
      .take(1000);
    const tracked = await ctx.db
      .query("ownReplies")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", sinceMs - LOOKBACK_MS))
      .take(1000);

    // Union of both engagement sources, keyed by username; tracked replies
    // also key by the exact replied-to user id (immune to username renames).
    const engagedByAuthor = new Map<
      string,
      { count: number; firstAt: number; lastAt: number }
    >();
    const add = (key: string | undefined, at: number) => {
      if (!key) return;
      const cur = engagedByAuthor.get(key) ?? { count: 0, firstAt: at, lastAt: at };
      engagedByAuthor.set(key, {
        count: cur.count + 1,
        firstAt: Math.min(cur.firstAt, at),
        lastAt: Math.max(cur.lastAt, at),
      });
    };
    for (const a of engaged) add(a.authorUsername, a.createdAt);
    for (const r of tracked) {
      add(r.repliedToUsername, r.createdAt);
      if (r.repliedToUserId) add(`id:${r.repliedToUserId}`, r.createdAt);
    }

    // Conversion = you engaged this account at least once BEFORE they followed.
    const rows = gains.flatMap((g) => {
      const byName = engagedByAuthor.get(g.username);
      const byId = engagedByAuthor.get(`id:${g.xUserId}`);
      const e =
        byName && byId
          ? {
              count: Math.max(byName.count, byId.count),
              firstAt: Math.min(byName.firstAt, byId.firstAt),
              lastAt: Math.max(byName.lastAt, byId.lastAt),
            }
          : (byName ?? byId);
      if (!e || e.firstAt > g.gainedAt) return [];
      return [
        {
          username: g.username,
          name: g.name,
          followers: g.followers,
          gainedAt: g.gainedAt,
          engagedCount: e.count,
          lastEngagedAt: e.lastAt,
        },
      ];
    });
    return {
      gains: gains.length,
      conversions: rows.length,
      rate: gains.length > 0 ? rows.length / gains.length : 0,
      rows: rows.sort((a, b) => b.gainedAt - a.gainedAt).slice(0, 50),
    };
  },
});

/**
 * Per-target scoreboard: every author you engaged in the window, how often,
 * and whether they follow you now (from the latest full follower snapshot).
 */
export const targets = query({
  args: { sinceMs: v.number() },
  handler: async (ctx, { sinceMs }) => {
    await requireAdmin(ctx);
    const engaged = await ctx.db
      .query("itemActions")
      .withIndex("by_action_createdAt", (q) =>
        q.eq("action", "engaged").gt("createdAt", sinceMs),
      )
      .take(1000);
    const tracked = await ctx.db
      .query("ownReplies")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", sinceMs))
      .take(1000);

    // Per-author counts from each source; a reply usually shows up in both
    // (queue click + tracked tweet), so take the max per author, not the sum.
    const clicksByAuthor = new Map<string, { count: number; lastAt: number }>();
    for (const a of engaged) {
      if (!a.authorUsername) continue;
      const cur = clicksByAuthor.get(a.authorUsername) ?? { count: 0, lastAt: 0 };
      clicksByAuthor.set(a.authorUsername, {
        count: cur.count + 1,
        lastAt: Math.max(cur.lastAt, a.createdAt),
      });
    }
    const trackedByAuthor = new Map<string, { count: number; lastAt: number }>();
    for (const r of tracked) {
      if (!r.repliedToUsername) continue;
      const cur = trackedByAuthor.get(r.repliedToUsername) ?? { count: 0, lastAt: 0 };
      trackedByAuthor.set(r.repliedToUsername, {
        count: cur.count + 1,
        lastAt: Math.max(cur.lastAt, r.createdAt),
      });
    }
    const byAuthor = new Map<string, { count: number; lastAt: number }>(clicksByAuthor);
    for (const [username, t] of trackedByAuthor) {
      const c = byAuthor.get(username);
      byAuthor.set(username, {
        count: Math.max(c?.count ?? 0, t.count),
        lastAt: Math.max(c?.lastAt ?? 0, t.lastAt),
      });
    }

    const snap = await ctx.db
      .query("followerSnapshots")
      .withIndex("by_fetchedAt")
      .order("desc")
      .first();
    const followerSet = new Set(
      snap
        ? (JSON.parse(snap.followsJson) as { username: string }[]).map((f) =>
            f.username.toLowerCase(),
          )
        : [],
    );

    // Pillar tags from the watchlist, where the author is on it.
    const creators = await ctx.db.query("creators").withIndex("by_order").collect();
    const pillarByHandle = new Map(creators.map((c) => [c.handle, c.pillar ?? "health"]));

    return [...byAuthor.entries()]
      .map(([username, e]) => ({
        username,
        engagedCount: e.count,
        lastEngagedAt: e.lastAt,
        followsNow: followerSet.has(username),
        onWatchlist: pillarByHandle.has(username),
        pillar: pillarByHandle.get(username) ?? null,
      }))
      .sort((a, b) => b.engagedCount - a.engagedCount)
      .slice(0, 100);
  },
});
