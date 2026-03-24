import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const store = mutation({
  args: {
    secret: v.string(),
    layoutHash: v.string(),
    nodes: v.array(
      v.object({
        slug: v.string(),
        x: v.number(),
        y: v.number(),
      })
    ),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const syncSecret = process.env.SYNC_SECRET;
    if (!syncSecret || args.secret !== syncSecret) {
      throw new Error("Unauthorized: invalid sync secret");
    }

    const { secret: _, ...fields } = args;

    // Delete old layouts
    const existing = await ctx.db.query("graphLayout").collect();
    for (const old of existing) {
      await ctx.db.delete(old._id);
    }

    // Store new layout
    return await ctx.db.insert("graphLayout", fields);
  },
});
