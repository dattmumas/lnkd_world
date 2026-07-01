import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

/** Admin-managed RSS sources for the Science News feed (convex/scienceFeed.ts). */

// Curated default set for On Label's space (health / longevity / biotech). All
// verified to return valid RSS. Mix of biotech/pharma business, top journals,
// longevity-specific, and general health science.
const DEFAULTS: { name: string; url: string }[] = [
  { name: "STAT News", url: "https://www.statnews.com/feed/" },
  { name: "Fierce Biotech", url: "https://www.fiercebiotech.com/rss/xml" },
  { name: "Fierce Pharma", url: "https://www.fiercepharma.com/rss/xml" },
  { name: "BioPharma Dive", url: "https://www.biopharmadive.com/feeds/news/" },
  { name: "GEN — Genetic Engineering News", url: "https://www.genengnews.com/feed/" },
  { name: "Nature", url: "https://www.nature.com/nature.rss" },
  { name: "Nature Medicine", url: "https://www.nature.com/nm.rss" },
  { name: "Nature Biotechnology", url: "https://www.nature.com/nbt.rss" },
  { name: "Fight Aging!", url: "https://www.fightaging.org/feed/" },
  { name: "Lifespan.io", url: "https://www.lifespan.io/feed/" },
  { name: "Science Daily — Health", url: "https://www.sciencedaily.com/rss/health_medicine.xml" },
  { name: "EurekAlert! — Medicine", url: "https://www.eurekalert.org/rss/health_medicine.xml" },
  { name: "Medical Xpress", url: "https://medicalxpress.com/rss-feed/" },
  { name: "Nature Reviews Drug Discovery", url: "https://www.nature.com/nrd.rss" },
  { name: "Nature Aging", url: "https://www.nature.com/nataging.rss" },
  { name: "Science Daily — Top Health", url: "https://www.sciencedaily.com/rss/top/health.xml" },
  { name: "KFF Health News", url: "https://kffhealthnews.org/feed/" },
  { name: "ScienceAlert", url: "https://www.sciencealert.com/feed" },
  { name: "Neuroscience News", url: "https://neurosciencenews.com/feed/" },
  { name: "New Atlas — Health", url: "https://newatlas.com/health-wellbeing/index.rss" },
  { name: "Ars Technica — Science", url: "https://feeds.arstechnica.com/arstechnica/science" },
  { name: "SciTechDaily", url: "https://scitechdaily.com/feed/" },
  { name: "Quanta Magazine", url: "https://api.quantamagazine.org/feed/" },
];

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("newsSources").withIndex("by_order").collect();
  },
});

export const create = mutation({
  args: { name: v.string(), url: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    const url = args.url.trim();
    if (!url) throw new Error("Feed URL is required.");
    const existing = await ctx.db.query("newsSources").withIndex("by_order").collect();
    return await ctx.db.insert("newsSources", {
      name: name || url,
      url,
      order: existing.length,
      active: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("newsSources"),
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
  args: { id: v.id("newsSources") },
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
    const existing = await ctx.db.query("newsSources").withIndex("by_order").collect();
    const have = new Set(existing.map((s) => s.url));
    let order = existing.length;
    let added = 0;
    for (const s of DEFAULTS) {
      if (have.has(s.url)) continue;
      await ctx.db.insert("newsSources", { ...s, order: order++, active: true });
      added++;
    }
    return { added };
  },
});

import { internalMutation } from "./_generated/server";
/** Maintenance: load any missing default sources via the CLI (idempotent). */
export const seedDefaultsCli = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("newsSources").withIndex("by_order").collect();
    const have = new Set(existing.map((s) => s.url));
    let order = existing.length;
    let added = 0;
    for (const s of DEFAULTS) {
      if (have.has(s.url)) continue;
      await ctx.db.insert("newsSources", { ...s, order: order++, active: true });
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
    const all = await ctx.db.query("newsSources").withIndex("by_order").collect();
    return all
      .filter((s) => s.active !== false)
      .map((s) => ({ name: s.name, url: s.url }));
  },
});
