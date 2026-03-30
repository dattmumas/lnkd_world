import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, verifySyncSecret } from "./lib/auth";

export const list = query({
  handler: async (ctx) => {
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    return bookmarks.sort(
      (a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
    );
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("bookmarks").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    url: v.string(),
    description: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("bookmarks", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("bookmarks"),
    title: v.string(),
    slug: v.string(),
    url: v.string(),
    description: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("bookmarks") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const deleteBySlug = mutation({
  args: { secret: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    verifySyncSecret(args.secret);
    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { action: "deleted" as const };
    }
    return { action: "not_found" as const };
  },
});

export const setBacklinks = mutation({
  args: {
    secret: v.string(),
    slug: v.string(),
    backlinks: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    verifySyncSecret(args.secret);
    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { backlinks: args.backlinks });
    }
  },
});

export const upsertBySlug = mutation({
  args: {
    secret: v.string(),
    slug: v.string(),
    title: v.string(),
    url: v.string(),
    description: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
    wikilinksRaw: v.optional(v.array(v.string())),
    wikilinksResolved: v.optional(v.array(v.string())),
    wikilinksBroken: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    verifySyncSecret(args.secret);

    const { secret: _, ...fields } = args;
    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return { action: "updated" as const, id: existing._id };
    } else {
      const id = await ctx.db.insert("bookmarks", fields);
      return { action: "created" as const, id };
    }
  },
});
