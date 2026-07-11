import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

/** Admin-managed RSS sources for the Consumer Deal Radar (convex/dealsFeed.ts). */

// Verified live 2026-07-04; expansion batch verified 2026-07-10. Deliberately
// excluded: FinSMEs + MobiHealthNews (Cloudflare-blocked server-side — FinSMEs
// arrives via the Google News proxy feed instead), StrictlyVC (stale archive),
// Fierce Healthcare (unparseable pubDate format). AlleyWatch matters most —
// its daily funding roundup carries many deals per item in <content:encoded>.
// The Google News query feeds are the volume workhorses (~70-95 items each,
// aggregating hundreds of outlets); the regex prefilter keeps non-deal items
// away from extraction, so broad feeds cost bandwidth only.
const DEFAULTS: { name: string; url: string }[] = [
  { name: "TechCrunch Venture", url: "https://techcrunch.com/category/venture/feed/" },
  { name: "Crunchbase News", url: "https://news.crunchbase.com/feed/" },
  { name: "Crunchbase Venture", url: "https://news.crunchbase.com/sections/venture/feed/" },
  { name: "AlleyWatch", url: "https://www.alleywatch.com/feed/" },
  { name: "PR Newswire VC", url: "https://www.prnewswire.com/rss/financial-services-latest-news/venture-capital-list.rss" },
  { name: "Sifted", url: "https://sifted.eu/feed" },
  { name: "GeekWire", url: "https://www.geekwire.com/feed/" },
  { name: "VentureBeat", url: "https://venturebeat.com/feed/" },
  { name: "Axios", url: "https://api.axios.com/feed/" },
  // Google News query feeds (aggregate outlets we can't reach directly)
  { name: "GNews FinSMEs", url: "https://news.google.com/rss/search?q=site:finsmes.com&hl=en-US&gl=US&ceid=US:en" },
  { name: "GNews Funding", url: "https://news.google.com/rss/search?q=%22raises%22+%22Series%22+million+funding&hl=en-US&gl=US&ceid=US:en" },
  { name: "GNews Seed", url: "https://news.google.com/rss/search?q=%22raises%22+%22seed+round%22&hl=en-US&gl=US&ceid=US:en" },
  { name: "GNews Consumer Health", url: "https://news.google.com/rss/search?q=%22raises%22+(%22consumer+health%22+OR+wellness+OR+supplement)&hl=en-US&gl=US&ceid=US:en" },
  // Direct feeds
  { name: "TechFundingNews", url: "https://techfundingnews.com/feed/" },
  { name: "EU-Startups", url: "https://www.eu-startups.com/feed/" },
  { name: "Tech.eu", url: "https://tech.eu/feed/" },
  { name: "Silicon Canals", url: "https://siliconcanals.com/feed/" },
  { name: "BetaKit", url: "https://betakit.com/feed/" },
  { name: "MedCity News", url: "https://medcitynews.com/feed/" },
  { name: "BevNET", url: "https://www.bevnet.com/feed/" },
  { name: "AgFunderNews", url: "https://agfundernews.com/feed" },
  { name: "Fortune Term Sheet", url: "https://fortune.com/feed/fortune-feeds/?id=3230629" },
  { name: "PE Hub", url: "https://www.pehub.com/feed/" },
  { name: "HIT Consultant", url: "https://hitconsultant.net/feed/" },
  { name: "Modern Retail", url: "https://www.modernretail.co/feed/" },
  { name: "Glossy", url: "https://www.glossy.co/feed/" },
  { name: "Food Dive", url: "https://www.fooddive.com/feeds/news/" },
];

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("dealSources").withIndex("by_order").collect();
  },
});

export const create = mutation({
  args: { name: v.string(), url: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    const url = args.url.trim();
    if (!url) throw new Error("Feed URL is required.");
    const existing = await ctx.db.query("dealSources").withIndex("by_order").collect();
    return await ctx.db.insert("dealSources", {
      name: name || url,
      url,
      order: existing.length,
      active: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("dealSources"),
    name: v.string(),
    url: v.string(),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});

export const remove = mutation({
  args: { id: v.id("dealSources") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

/** Add any default sources not already present (by URL). Safe to re-run. */
export const seedDefaults = mutation({
  args: {},
  returns: v.object({ added: v.number() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("dealSources").withIndex("by_order").collect();
    const have = new Set(existing.map((s) => s.url));
    let order = existing.length;
    let added = 0;
    for (const s of DEFAULTS) {
      if (have.has(s.url)) continue;
      await ctx.db.insert("dealSources", { ...s, order: order++, active: true });
      added++;
    }
    return { added };
  },
});

/** Maintenance: load any missing default sources via the CLI (idempotent). */
export const seedDefaultsCli = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("dealSources").withIndex("by_order").collect();
    const have = new Set(existing.map((s) => s.url));
    let order = existing.length;
    let added = 0;
    for (const s of DEFAULTS) {
      if (have.has(s.url)) continue;
      await ctx.db.insert("dealSources", { ...s, order: order++, active: true });
      added++;
    }
    return added;
  },
});

/** Active sources for the refresh action (actions have no ctx.db). */
export const activeSources = internalQuery({
  args: {},
  returns: v.array(v.object({ name: v.string(), url: v.string() })),
  handler: async (ctx) => {
    const all = await ctx.db.query("dealSources").withIndex("by_order").collect();
    return all
      .filter((s) => s.active !== false)
      .map((s) => ({ name: s.name, url: s.url }));
  },
});
