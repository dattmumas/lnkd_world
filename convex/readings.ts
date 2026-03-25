import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .first();

  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized: admin required");
  }
  return user;
}

export const list = query({
  handler: async (ctx) => {
    const readings = await ctx.db
      .query("readings")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    return readings.sort(
      (a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
    );
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("readings").collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const reading = await ctx.db
      .query("readings")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!reading || !reading.published) return null;

    if (reading.gated) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return { ...reading, content: "" };
    }

    return reading;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    author: v.string(),
    type: v.string(),
    rating: v.optional(v.number()),
    content: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("readings", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("readings"),
    title: v.string(),
    slug: v.string(),
    author: v.string(),
    type: v.string(),
    rating: v.optional(v.number()),
    content: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("readings") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const deleteBySlug = mutation({
  args: { secret: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const syncSecret = process.env.SYNC_SECRET;
    if (!syncSecret || args.secret !== syncSecret) {
      throw new Error("Unauthorized: invalid sync secret");
    }
    const existing = await ctx.db
      .query("readings")
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
    const syncSecret = process.env.SYNC_SECRET;
    if (!syncSecret || args.secret !== syncSecret) {
      throw new Error("Unauthorized: invalid sync secret");
    }
    const existing = await ctx.db
      .query("readings")
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
    author: v.string(),
    type: v.string(),
    rating: v.optional(v.number()),
    content: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
    url: v.optional(v.string()),
    wikilinksRaw: v.optional(v.array(v.string())),
    wikilinksResolved: v.optional(v.array(v.string())),
    wikilinksBroken: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const syncSecret = process.env.SYNC_SECRET;
    if (!syncSecret || args.secret !== syncSecret) {
      throw new Error("Unauthorized: invalid sync secret");
    }

    const { secret: _, ...fields } = args;
    const existing = await ctx.db
      .query("readings")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return { action: "updated" as const, id: existing._id };
    } else {
      const id = await ctx.db.insert("readings", fields);
      return { action: "created" as const, id };
    }
  },
});
