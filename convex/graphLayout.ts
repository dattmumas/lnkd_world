import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifySyncSecret } from "./lib/auth";

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
    verifySyncSecret(args.secret);

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
