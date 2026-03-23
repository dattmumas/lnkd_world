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
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    return posts
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .map(({ content: _, ...rest }) => rest);
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("posts").collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!post || !post.published) return null;

    if (post.gated) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return { ...post, content: "" };
    }

    return post;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("posts", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("posts"),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    content: v.string(),
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
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const upsertBySlug = mutation({
  args: {
    secret: v.string(),
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const syncSecret = process.env.SYNC_SECRET;
    if (!syncSecret || args.secret !== syncSecret) {
      throw new Error("Unauthorized: invalid sync secret");
    }

    const { secret: _, ...fields } = args;
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return { action: "updated" as const, id: existing._id };
    } else {
      const id = await ctx.db.insert("posts", fields);
      return { action: "created" as const, id };
    }
  },
});
