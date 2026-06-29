import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

// X username, no leading @, lowercase.
function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Admin: the full creators list (for /admin/creators). */
export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("creators").withIndex("by_order").collect();
  },
});

export const create = mutation({
  args: { handle: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const handle = normalizeHandle(args.handle);
    if (!handle) throw new Error("Handle is required.");
    const existing = await ctx.db.query("creators").withIndex("by_order").collect();
    return await ctx.db.insert("creators", {
      handle,
      note: args.note,
      order: existing.length,
      active: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("creators"),
    handle: v.string(),
    note: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, handle, ...rest } = args;
    await ctx.db.patch(id, { handle: normalizeHandle(handle), ...rest });
  },
});

export const remove = mutation({
  args: { id: v.id("creators") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

/** Remove a creator by handle (used by the Early feed's per-card remove button). */
export const removeByHandle = mutation({
  args: { handle: v.string() },
  returns: v.object({ removed: v.boolean() }),
  handler: async (ctx, { handle }) => {
    await requireAdmin(ctx);
    const h = normalizeHandle(handle);
    const all = await ctx.db.query("creators").withIndex("by_order").collect();
    const row = all.find((c) => c.handle === h);
    if (!row) return { removed: false };
    await ctx.db.delete(row._id);
    return { removed: true };
  },
});

/** Active handles for the feed refresh action (actions have no ctx.db). */
export const activeHandles = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const all = await ctx.db.query("creators").withIndex("by_order").collect();
    return all.filter((c) => c.active !== false).map((c) => c.handle);
  },
});
