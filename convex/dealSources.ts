import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

/** Admin-managed RSS sources for the Consumer Deal Radar (convex/dealsFeed.ts). */

// Verified live 2026-07-04. Deliberately excluded: FinSMEs (Cloudflare-blocked
// server-side) and StrictlyVC (feed is a stale 2019 archive since the
// TechCrunch acquisition). AlleyWatch matters most — its daily funding roundup
// carries many deals per item in <content:encoded>.
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
