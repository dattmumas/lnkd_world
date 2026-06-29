import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
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
      const status = picked.length > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.earlyFeed.store, {
        generatedAt,
        html,
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
    status: v.string(),
    count: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("earlySnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    if (old.length > 14) {
      for (const snap of old.slice(0, old.length - 14)) {
        await ctx.db.delete(snap._id);
      }
    }
    return await ctx.db.insert("earlySnapshots", {
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
