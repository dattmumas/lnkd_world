import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireSubscriber } from "./lib/auth";
import xTrends from "./feedPages/xTrends";

// Shown for "creators" before the first refresh or when the list is empty.
const CREATORS_PLACEHOLDER = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#f7f8fa}.wrap{max-width:680px;margin:0 auto;padding:48px 20px}p{color:#64748b}</style></head><body><div class="wrap"><h1 style="font-size:22px">Creators</h1><p>No creators yet. Add X accounts in <strong>/admin/creators</strong>, then hit “Refresh feed now.”</p></div></body></html>`;

// Shown for "early" before the first refresh or when no fresh posts exist.
const EARLY_PLACEHOLDER = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#f7f8fa}.wrap{max-width:680px;margin:0 auto;padding:48px 20px}p{color:#64748b}</style></head><body><div class="wrap"><h1 style="font-size:22px">Early Engagement</h1><p>No fresh posts from your watchlist in the last couple of hours. Add accounts in <strong>/admin/creators</strong>; this polls them every ~20 minutes.</p></div></body></html>`;

// Shown for "teardown" before the first refresh.
const TEARDOWN_PLACEHOLDER = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#f7f8fa}.wrap{max-width:680px;margin:0 auto;padding:48px 20px}p{color:#64748b}</style></head><body><div class="wrap"><h1 style="font-size:22px">Content Teardown</h1><p>No teardown yet. Add accounts to emulate in <strong>/admin/creators</strong>, then hit “Refresh.” Shows their top-performing posts plus the niche’s.</p></div></body></html>`;

// Shown for "science" before the first refresh.
const SCIENCE_PLACEHOLDER = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#f7f8fa}.wrap{max-width:680px;margin:0 auto;padding:48px 20px}p{color:#64748b}</style></head><body><div class="wrap"><h1 style="font-size:22px">Science News</h1><p>No briefing yet. Manage sources in <strong>/admin/sources</strong>, then hit “Refresh.” Combs your science sites for stories worth sharing.</p></div></body></html>`;

// Slug allowlist → title + static fallback HTML. Served only to logged-in users.
const PAGES: Record<string, { title: string; html: string }> = {
  "x-trends": { title: "Trending on X", html: xTrends },
  creators: { title: "Creators", html: CREATORS_PLACEHOLDER },
  early: { title: "Early Engagement", html: EARLY_PLACEHOLDER },
  teardown: { title: "Content Teardown", html: TEARDOWN_PLACEHOLDER },
  science: { title: "Science News", html: SCIENCE_PLACEHOLDER },
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

    // Serve the most recent *ok* snapshot — not just the newest row — so a failed
    // refresh (e.g. a transient getXAPI error) doesn't regress the page to the
    // static placeholder while good older snapshots still exist.
    let html: string | null = null;
    if (slug === "x-trends") {
      const recent = await ctx.db
        .query("xTrendsSnapshots")
        .withIndex("by_createdAt")
        .order("desc")
        .take(15);
      html = recent.find((s) => s.status === "ok")?.html ?? null;
    } else if (slug === "creators") {
      const recent = await ctx.db
        .query("creatorsSnapshots")
        .withIndex("by_createdAt")
        .order("desc")
        .take(15);
      html = recent.find((s) => s.status === "ok")?.html ?? null;
    } else if (slug === "early") {
      const recent = await ctx.db
        .query("earlySnapshots")
        .withIndex("by_createdAt")
        .order("desc")
        .take(15);
      html = recent.find((s) => s.status === "ok")?.html ?? null;
    } else if (slug === "teardown") {
      const recent = await ctx.db
        .query("teardownSnapshots")
        .withIndex("by_createdAt")
        .order("desc")
        .take(15);
      html = recent.find((s) => s.status === "ok")?.html ?? null;
    } else if (slug === "science") {
      const recent = await ctx.db
        .query("scienceSnapshots")
        .withIndex("by_createdAt")
        .order("desc")
        .take(15);
      html = recent.find((s) => s.status === "ok")?.html ?? null;
    }

    return { slug, title: page.title, html: html ?? page.html };
  },
});
