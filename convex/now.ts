import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, verifySyncSecret } from "./lib/auth";

export const get = query({
  handler: async (ctx) => {
    const docs = await ctx.db.query("now").collect();
    return docs[0] ?? null;
  },
});

export const update = mutation({
  args: {
    content: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("now").collect();
    if (existing[0]) {
      await ctx.db.patch(existing[0]._id, args);
    } else {
      await ctx.db.insert("now", args);
    }
  },
});

export const upsert = mutation({
  args: {
    secret: v.string(),
    content: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    verifySyncSecret(args.secret);

    const { secret: _, ...fields } = args;
    const existing = await ctx.db.query("now").collect();

    if (existing[0]) {
      await ctx.db.patch(existing[0]._id, fields);
      return { action: "updated" as const, id: existing[0]._id };
    } else {
      const id = await ctx.db.insert("now", fields);
      return { action: "created" as const, id };
    }
  },
});
