import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { reportCron } from "./lib/cronReport";

/**
 * beehiiv → pipeline: a daily cron pulls the newsletter's latest posts and
 * seeds each unseen recent one as a thread idea in the content pipeline
 * (xPosts, status "idea") with title/subtitle/URL as source material for the
 * composer's Claude drafting. Every fetched id is marked seen — including old
 * ones on the first run — so the archive never backfills.
 *
 * Env (Convex): beehiiv_api_key, beehiiv_publication_id. No-ops until set.
 */

const RECENT_DAYS = 14; // only seed ideas for posts published in this window
const FETCH_LIMIT = 10;

interface BeehiivPost {
  id?: string;
  title?: string;
  subtitle?: string;
  preview_text?: string;
  web_url?: string;
  publish_date?: number; // unix seconds
  status?: string;
}

export const pullInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), created: v.number() }),
  handler: async (ctx) => {
    const key = process.env.beehiiv_api_key;
    const pubId = process.env.beehiiv_publication_id;
    if (!key || !pubId) return { status: "no-config", created: 0 };

    try {
      const url =
        `https://api.beehiiv.com/v2/publications/${encodeURIComponent(pubId)}/posts` +
        `?limit=${FETCH_LIMIT}&order_by=publish_date&direction=desc&status=confirmed`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        throw new Error(
          `beehiiv ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as { data?: BeehiivPost[] };
      const posts = (json.data ?? []).filter((p) => p.id && p.title);

      const cutoff = Date.now() - RECENT_DAYS * 86_400_000;
      let created = 0;
      for (const p of posts) {
        const publishedMs = (p.publish_date ?? 0) * 1000;
        const wasCreated: boolean = await ctx.runMutation(
          internal.beehiiv.captureIdea,
          {
            postId: p.id as string,
            title: (p.title as string).slice(0, 200),
            subtitle: (p.subtitle || p.preview_text || "").slice(0, 1000),
            url: p.web_url ?? "",
            // Old posts are marked seen but never seeded as ideas.
            seedIdea: publishedMs > cutoff,
          },
        );
        if (wasCreated) created++;
      }
      await reportCron(ctx, "beehiiv", true, `created=${created}`);
      return { status: "ok", created };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await reportCron(ctx, "beehiiv", false, message);
      throw e;
    }
  },
});

/** Dedup-check, mark seen, and (for recent posts) create the thread idea. */
export const captureIdea = internalMutation({
  args: {
    postId: v.string(),
    title: v.string(),
    subtitle: v.string(),
    url: v.string(),
    seedIdea: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, { postId, title, subtitle, url, seedIdea }) => {
    const seen = await ctx.db
      .query("beehiivSeen")
      .withIndex("by_postId", (q) => q.eq("postId", postId))
      .first();
    if (seen) return false;
    await ctx.db.insert("beehiivSeen", { postId, createdAt: Date.now() });
    if (!seedIdea) return false;

    await ctx.db.insert("xPosts", {
      pillar: "health", // On Label is the health/longevity pillar
      status: "idea",
      kind: "thread", // newsletters repurpose best as threads
      body: title,
      sourceText: [subtitle, url].filter(Boolean).join("\n\n"),
      sourceUrl: url || undefined,
      source: `newsletter:${postId}`,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/** Admin: manual pull button. */
export const pull = action({
  args: {},
  returns: v.object({ status: v.string(), created: v.number() }),
  handler: async (ctx) => {
    await ctx.runQuery(internal.growth._assertAdmin, {});
    const result: { status: string; created: number } = await ctx.runAction(
      internal.beehiiv.pullInternal,
      {},
    );
    return result;
  },
});
