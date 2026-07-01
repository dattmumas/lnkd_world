import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

/** Admin-managed general-business RSS sources for the Business column. */

const DEFAULTS: { name: string; url: string }[] = [
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { name: "Fortune", url: "https://fortune.com/feed/" },
  { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" },
  { name: "WSJ Markets", url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml" },
  { name: "WSJ Business", url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml" },
  { name: "NYT Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml" },
  { name: "CNBC Business", url: "https://www.cnbc.com/id/10001147/device/rss/rss.html" },
  { name: "Guardian Business", url: "https://www.theguardian.com/uk/business/rss" },
  { name: "CNBC Top News", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { name: "CNBC Finance", url: "https://www.cnbc.com/id/10000664/device/rss/rss.html" },
  { name: "NYT Economy", url: "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml" },
  { name: "NYT DealBook", url: "https://rss.nytimes.com/services/xml/rss/nyt/DealBook.xml" },
  { name: "BBC Economy", url: "https://feeds.bbci.co.uk/news/business/economy/rss.xml" },
  { name: "Guardian Economics", url: "https://www.theguardian.com/business/economics/rss" },
  { name: "NPR Business", url: "https://feeds.npr.org/1006/rss.xml" },
  { name: "Axios", url: "https://api.axios.com/feed/" },
  { name: "Quartz", url: "https://qz.com/rss" },
  { name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
];

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("bizSources").withIndex("by_order").collect();
  },
});

export const create = mutation({
  args: { name: v.string(), url: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    const url = args.url.trim();
    if (!url) throw new Error("Feed URL is required.");
    const existing = await ctx.db.query("bizSources").withIndex("by_order").collect();
    return await ctx.db.insert("bizSources", {
      name: name || url,
      url,
      order: existing.length,
      active: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("bizSources"),
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
  args: { id: v.id("bizSources") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const seedDefaults = mutation({
  args: {},
  returns: v.object({ added: v.number() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("bizSources").withIndex("by_order").collect();
    const have = new Set(existing.map((s) => s.url));
    let order = existing.length;
    let added = 0;
    for (const s of DEFAULTS) {
      if (have.has(s.url)) continue;
      await ctx.db.insert("bizSources", { ...s, order: order++, active: true });
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
    const existing = await ctx.db.query("bizSources").withIndex("by_order").collect();
    const have = new Set(existing.map((s) => s.url));
    let order = existing.length;
    let added = 0;
    for (const s of DEFAULTS) {
      if (have.has(s.url)) continue;
      await ctx.db.insert("bizSources", { ...s, order: order++, active: true });
      added++;
    }
    return added;
  },
});

export const activeSources = internalQuery({
  args: {},
  returns: v.array(v.object({ name: v.string(), url: v.string() })),
  handler: async (ctx) => {
    const all = await ctx.db.query("bizSources").withIndex("by_order").collect();
    return all
      .filter((s) => s.active !== false)
      .map((s) => ({ name: s.name, url: s.url }));
  },
});
