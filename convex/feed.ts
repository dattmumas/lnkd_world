import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireSubscriber } from "./lib/auth";
import contentiousNews from "./feedPages/contentiousNews";
import xTrends from "./feedPages/xTrends";
import replyRadar from "./feedPages/replyRadar";

// Shown for "creators" before the first refresh or when the list is empty.
const CREATORS_PLACEHOLDER = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#f7f8fa}.wrap{max-width:680px;margin:0 auto;padding:48px 20px}p{color:#64748b}</style></head><body><div class="wrap"><h1 style="font-size:22px">Creators</h1><p>No creators yet. Add X accounts in <strong>/admin/creators</strong>, then hit “Refresh feed now.”</p></div></body></html>`;

// Slug allowlist → title + static fallback HTML. Served only to logged-in users.
const PAGES: Record<string, { title: string; html: string }> = {
  "contentious-news": {
    title: "Contentious Health & Longevity News",
    html: contentiousNews,
  },
  "x-trends": { title: "Trending on X", html: xTrends },
  "reply-radar": { title: "Reply Radar", html: replyRadar },
  creators: { title: "Creators", html: CREATORS_PLACEHOLDER },
};

/**
 * Returns one feed page's HTML, gated at the data layer by `requireSubscriber`.
 * For live feeds (x-trends, creators) it serves the latest "ok" snapshot, falling
 * back to the static PAGES html before the first refresh or on error.
 */
export const getPage = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireSubscriber(ctx);
    const page = PAGES[slug];
    if (!page) return null;

    let snapshot = null;
    if (slug === "x-trends") {
      snapshot = await ctx.db
        .query("xTrendsSnapshots")
        .withIndex("by_createdAt")
        .order("desc")
        .first();
    } else if (slug === "creators") {
      snapshot = await ctx.db
        .query("creatorsSnapshots")
        .withIndex("by_createdAt")
        .order("desc")
        .first();
    }
    if (snapshot && snapshot.status === "ok") {
      return { slug, title: page.title, html: snapshot.html };
    }

    return { slug, title: page.title, html: page.html };
  },
});
