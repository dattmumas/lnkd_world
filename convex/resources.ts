import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireSubscriber } from "./lib/auth";

export const list = query({
  handler: async (ctx) => {
    await requireSubscriber(ctx);
    return await ctx.db
      .query("resources")
      .filter((q) => q.eq(q.field("published"), true))
      .collect();
  },
});

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("resources").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    content: v.string(),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("resources", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("resources"),
    title: v.string(),
    description: v.string(),
    content: v.string(),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("resources") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
