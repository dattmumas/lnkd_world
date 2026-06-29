import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

/** Admin-managed RSS sources for the Science News feed (convex/scienceFeed.ts). */

// A sensible default set for On Label's space (health / longevity / biotech).
const DEFAULTS: { name: string; url: string }[] = [
  { name: "STAT News", url: "https://www.statnews.com/feed/" },
  { name: "Science Daily — Health", url: "https://www.sciencedaily.com/rss/health_medicine.xml" },
  { name: "Nature", url: "https://www.nature.com/nature.rss" },
  { name: "Eurekalert — Medicine", url: "https://www.eurekalert.org/rss/health_medicine.xml" },
  { name: "Medical Xpress", url: "https://medicalxpress.com/rss-feed/" },
  { name: "Fierce Biotech", url: "https://www.fiercebiotech.com/rss/xml" },
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

/** Seed the default sources (only if the list is currently empty). */
export const seedDefaults = mutation({
  args: {},
  returns: v.object({ added: v.number() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("newsSources").withIndex("by_order").collect();
    if (existing.length > 0) return { added: 0 };
    let order = 0;
    for (const s of DEFAULTS) {
      await ctx.db.insert("newsSources", { ...s, order: order++, active: true });
    }
    return { added: DEFAULTS.length };
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
