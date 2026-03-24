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
    const syncSecret = process.env.SYNC_SECRET;
    if (!syncSecret || args.secret !== syncSecret) {
      throw new Error("Unauthorized: invalid sync secret");
    }

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
