import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the latest bonds dashboard snapshot.
 * Public query — dashboard data is not gated.
 */
export const latest = query({
  handler: async (ctx) => {
    const snapshot = await ctx.db
      .query("bondsSnapshots")
      .withIndex("by_createdAt")
      .order("desc")
      .first();

    if (!snapshot) return null;

    return {
      _id: snapshot._id,
      generatedAt: snapshot.generatedAt,
      version: snapshot.version,
      status: snapshot.status,
      data: snapshot.data, // Client will JSON.parse this
      createdAt: snapshot.createdAt,
    };
  },
});

/**
 * Get snapshot history (last N snapshots, metadata only — no data blob).
 */
export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const n = limit ?? 7;
    const snapshots = await ctx.db
      .query("bondsSnapshots")
      .withIndex("by_createdAt")
      .order("desc")
      .take(n);

    return snapshots.map((s) => ({
      _id: s._id,
      generatedAt: s.generatedAt,
      version: s.version,
      status: s.status,
      createdAt: s.createdAt,
    }));
  },
});

/**
 * Internal mutation to ingest a new snapshot (called from HTTP action).
 */
export const ingest = internalMutation({
  args: {
    generatedAt: v.string(),
    version: v.string(),
    status: v.string(),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    // Keep only last 30 snapshots to manage storage
    const old = await ctx.db
      .query("bondsSnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);

    if (old.length > 30) {
      const toDelete = old.slice(0, old.length - 30);
      for (const snap of toDelete) {
        await ctx.db.delete(snap._id);
      }
    }

    return await ctx.db.insert("bondsSnapshots", {
      generatedAt: args.generatedAt,
      version: args.version,
      status: args.status,
      data: args.data,
      createdAt: new Date().toISOString(),
    });
  },
});
