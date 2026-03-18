import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const ADMIN_EMAIL = "mattdumas3@gmail.com";

export const currentUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();

    return user;
  },
});

export const ensureUser = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();

    if (existing) return existing._id;

    const role = identity.email === ADMIN_EMAIL ? "admin" : "subscriber";
    return await ctx.db.insert("users", {
      email: identity.email,
      name: identity.name,
      role,
    });
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});
