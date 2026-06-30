import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

/** Admin-managed business X accounts whose posts feed the Business column. */

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

const DEFAULTS: { handle: string; note?: string }[] = [
  { handle: "business", note: "Bloomberg" },
  { handle: "markets", note: "Bloomberg Markets" },
  { handle: "WSJ" },
  { handle: "CNBC" },
  { handle: "ReutersBiz", note: "Reuters Business" },
  { handle: "FinancialTimes" },
  { handle: "YahooFinance" },
  { handle: "TheEconomist" },
  { handle: "Forbes" },
  { handle: "FortuneMagazine" },
];

export const listAll = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("bizAccounts").withIndex("by_order").collect();
  },
});

export const create = mutation({
  args: { handle: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const handle = normalizeHandle(args.handle);
    if (!handle) throw new Error("Handle is required.");
    const existing = await ctx.db.query("bizAccounts").withIndex("by_order").collect();
    return await ctx.db.insert("bizAccounts", {
      handle,
      note: args.note,
      order: existing.length,
      active: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("bizAccounts"),
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
  args: { id: v.id("bizAccounts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const seedDefaults = mutation({
  args: {},
  returns: v.object({ added: v.number() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("bizAccounts").withIndex("by_order").collect();
    const have = new Set(existing.map((c) => c.handle));
    let order = existing.length;
    let added = 0;
    for (const d of DEFAULTS) {
      const handle = normalizeHandle(d.handle);
      if (have.has(handle)) continue;
      await ctx.db.insert("bizAccounts", { handle, note: d.note, order: order++, active: true });
      added++;
    }
    return { added };
  },
});

/** Maintenance: load default accounts via the CLI (idempotent). */
export const seedDefaultsCli = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("bizAccounts").withIndex("by_order").collect();
    const have = new Set(existing.map((c) => c.handle));
    let order = existing.length;
    let added = 0;
    for (const d of DEFAULTS) {
      const handle = normalizeHandle(d.handle);
      if (have.has(handle)) continue;
      await ctx.db.insert("bizAccounts", { handle, note: d.note, order: order++, active: true });
      added++;
    }
    return added;
  },
});

export const activeHandles = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const all = await ctx.db.query("bizAccounts").withIndex("by_order").collect();
    return all.filter((c) => c.active !== false).map((c) => c.handle);
  },
});
