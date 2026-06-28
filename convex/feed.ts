import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireSubscriber } from "./lib/auth";
import contentiousNews from "./feedPages/contentiousNews";
import xTrends from "./feedPages/xTrends";
import replyRadar from "./feedPages/replyRadar";

// Slug allowlist → cleaned artifact HTML. Served only to logged-in users.
const PAGES: Record<string, { title: string; html: string }> = {
  "contentious-news": {
    title: "Contentious Health & Longevity News",
    html: contentiousNews,
  },
  "x-trends": { title: "Trending on X", html: xTrends },
  "reply-radar": { title: "Reply Radar", html: replyRadar },
};

/**
 * Returns one feed page's HTML, gated at the data layer by `requireSubscriber`.
 * This works with the app's client-side auth (the Convex client carries the
 * token), unlike a Next.js server route that depends on an httpOnly cookie.
 */
export const getPage = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireSubscriber(ctx);
    const page = PAGES[slug];
    if (!page) return null;
    return { slug, title: page.title, html: page.html };
  },
});
