import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import { gxFollowing } from "./lib/getxapi";
import { reportCron } from "./lib/cronReport";

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

const pillarValidator = v.union(
  v.literal("health"),
  v.literal("finance"),
  v.literal("startup"),
);

export const create = mutation({
  args: {
    handle: v.string(),
    note: v.optional(v.string()),
    pillar: v.optional(pillarValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const handle = normalizeHandle(args.handle);
    if (!handle) throw new Error("Handle is required.");
    // An explicit re-add clears any tombstone left by a past deletion.
    const buried = await ctx.db
      .query("creatorTombstones")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();
    if (buried) await ctx.db.delete(buried._id);
    const existing = await ctx.db.query("creators").withIndex("by_order").collect();
    const id = await ctx.db.insert("creators", {
      handle,
      note: args.note,
      pillar: args.pillar ?? "health",
      order: existing.length,
      active: true,
    });
    await rebuildCache(ctx);
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("creators"),
    handle: v.string(),
    note: v.optional(v.string()),
    active: v.optional(v.boolean()),
    pillar: v.optional(pillarValidator),
    fastPoll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, handle, ...rest } = args;
    await ctx.db.patch(id, { handle: normalizeHandle(handle), ...rest });
    await rebuildCache(ctx);
  },
});

/** Bulk field updates for the admin table (only provided fields change). */
export const bulkSet = mutation({
  args: {
    ids: v.array(v.id("creators")),
    fastPoll: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
    pillar: v.optional(pillarValidator),
  },
  returns: v.number(),
  handler: async (ctx, { ids, fastPoll, active, pillar }) => {
    await requireAdmin(ctx);
    const patch: Record<string, unknown> = {};
    if (fastPoll !== undefined) patch.fastPoll = fastPoll;
    if (active !== undefined) patch.active = active;
    if (pillar !== undefined) patch.pillar = pillar;
    if (Object.keys(patch).length === 0) return 0;
    for (const id of ids.slice(0, 500)) await ctx.db.patch(id, patch);
    await rebuildCache(ctx);
    return Math.min(ids.length, 500);
  },
});

/** Internal twin of bulkSet, for CLI/maintenance operations. */
export const bulkSetInternal = internalMutation({
  args: {
    ids: v.array(v.id("creators")),
    fastPoll: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
  },
  returns: v.number(),
  handler: async (ctx, { ids, fastPoll, active }) => {
    const patch: Record<string, unknown> = {};
    if (fastPoll !== undefined) patch.fastPoll = fastPoll;
    if (active !== undefined) patch.active = active;
    if (Object.keys(patch).length === 0) return 0;
    for (const id of ids.slice(0, 500)) await ctx.db.patch(id, patch);
    await rebuildCache(ctx);
    return Math.min(ids.length, 500);
  },
});

/** Bulk delete with tombstones (the follow sync must not resurrect these). */
export const bulkRemove = mutation({
  args: { ids: v.array(v.id("creators")) },
  returns: v.number(),
  handler: async (ctx, { ids }) => {
    await requireAdmin(ctx);
    let removed = 0;
    for (const id of ids.slice(0, 200)) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      await tombstone(ctx, row.handle);
      await ctx.db.delete(id);
      removed++;
    }
    if (removed > 0) await rebuildCache(ctx);
    return removed;
  },
});

/**
 * Rebuild the materialized active-creator list. Called from every mutation
 * that touches creators — the 5-min early-feed poll reads this single doc
 * instead of .collect()ing the whole table (a ~4× bandwidth cut on the
 * hottest read path in the system).
 */
async function rebuildCache(ctx: MutationCtx): Promise<void> {
  const all = await ctx.db.query("creators").withIndex("by_order").collect();
  const json = JSON.stringify(
    all
      .filter((c) => c.active !== false)
      .map((c) => ({ handle: c.handle, pillar: c.pillar, fastPoll: c.fastPoll })),
  );
  const existing = await ctx.db.query("creatorsCache").first();
  if (existing) await ctx.db.patch(existing._id, { json, updatedAt: Date.now() });
  else await ctx.db.insert("creatorsCache", { json, updatedAt: Date.now() });
}

/** Maintenance: seed/rebuild the cache via CLI. */
export const rebuildCacheCli = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await rebuildCache(ctx);
    return null;
  },
});

// Deletions leave a tombstone so the daily follow sync can't resurrect the
// account. An explicit re-add (create) clears it.
async function tombstone(ctx: MutationCtx, handle: string): Promise<void> {
  const existing = await ctx.db
    .query("creatorTombstones")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .first();
  if (!existing) {
    await ctx.db.insert("creatorTombstones", { handle, createdAt: Date.now() });
  }
}

export const remove = mutation({
  args: { id: v.id("creators") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (row) await tombstone(ctx, row.handle);
    await ctx.db.delete(args.id);
    await rebuildCache(ctx);
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

/** Internal: bulk-add handles not already on the list (follow sync). */
export const addMissingInternal = internalMutation({
  args: {
    handles: v.array(v.object({ handle: v.string(), note: v.optional(v.string()) })),
  },
  returns: v.number(),
  handler: async (ctx, { handles }) => {
    const existing = await ctx.db.query("creators").withIndex("by_order").collect();
    const have = new Set(existing.map((c) => c.handle));
    const tombstones = await ctx.db.query("creatorTombstones").take(1000);
    const buried = new Set(tombstones.map((t) => t.handle));
    let order = existing.length;
    let added = 0;
    for (const h of handles.slice(0, 300)) {
      const handle = normalizeHandle(h.handle);
      if (!handle || have.has(handle) || buried.has(handle)) continue;
      have.add(handle);
      await ctx.db.insert("creators", {
        handle,
        note: h.note,
        pillar: "health",
        order: order++,
        active: true,
      });
      added++;
    }
    if (added > 0) await rebuildCache(ctx);
    return added;
  },
});

/**
 * Follow sync (daily cron + manual button): every account the tracked handle
 * follows joins the creators watchlist. Additive only — unfollowing on X never
 * removes a creator, and deactivated creators stay deactivated (the dedup is
 * by handle, whatever the active flag). New adds default to the health pillar;
 * retag finance/startup accounts in /admin/creators.
 */
export const syncFollowsInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), added: v.number(), following: v.number() }),
  handler: async (ctx): Promise<{ status: string; added: number; following: number }> => {
    try {
      const handle: string | null = await ctx.runQuery(
        internal.growth.handleInternal,
        {},
      );
      if (!handle) return { status: "no-config", added: 0, following: 0 };
      const { users } = await gxFollowing(handle);
      const added: number = await ctx.runMutation(
        internal.creators.addMissingInternal,
        {
          handles: users
            .filter((u) => u.username)
            .map((u) => ({ handle: u.username, note: "via follow sync" })),
        },
      );
      await reportCron(ctx, "follow-sync", true, `added=${added} following=${users.length}`);
      return { status: "ok", added, following: users.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await reportCron(ctx, "follow-sync", false, message);
      throw e;
    }
  },
});

/** Admin: "Sync from my follows" button. */
export const syncFollows = action({
  args: {},
  returns: v.object({ status: v.string(), added: v.number(), following: v.number() }),
  handler: async (ctx) => {
    await ctx.runQuery(internal.growth._assertAdmin, {});
    const result: { status: string; added: number; following: number } =
      await ctx.runAction(internal.creators.syncFollowsInternal, {});
    return result;
  },
});

/** Active creators with pillar + fast-poll tags — the early feed polls
 * fast-poll accounts every cycle and the rest on the hourly sweep.
 * Served from the materialized cache (single-doc read on a 5-min hot path);
 * falls back to a full scan until the first mutation builds the cache. */
export const activeCreators = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      handle: v.string(),
      pillar: v.optional(
        v.union(v.literal("health"), v.literal("finance"), v.literal("startup")),
      ),
      fastPoll: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx) => {
    const cache = await ctx.db.query("creatorsCache").first();
    if (cache) {
      return JSON.parse(cache.json) as {
        handle: string;
        pillar?: "health" | "finance" | "startup";
        fastPoll?: boolean;
      }[];
    }
    const all = await ctx.db.query("creators").withIndex("by_order").collect();
    return all
      .filter((c) => c.active !== false)
      .map((c) => ({ handle: c.handle, pillar: c.pillar, fastPoll: c.fastPoll }));
  },
});
