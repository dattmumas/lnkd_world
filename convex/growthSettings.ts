import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

/**
 * Growth-system settings (single row): the active-hours window that gates fast
 * (5-min) watchlist polling and Telegram notifications (convex/earlyFeed.ts
 * tick). No row = legacy 20-min polling, no pushes.
 */

export interface GrowthSettings {
  activeStartHour: number;
  activeEndHour: number;
  tzOffsetMinutes: number;
  notifyEnabled?: boolean;
  notifyMinFollowers?: number;
}

/** Is `nowMs` inside the configured active window? Handles overnight spans. */
export function inActiveHours(s: GrowthSettings, nowMs: number): boolean {
  const local = new Date(nowMs + s.tzOffsetMinutes * 60_000);
  const hour = local.getUTCHours();
  if (s.activeStartHour === s.activeEndHour) return true; // degenerate = always
  if (s.activeStartHour < s.activeEndHour) {
    return hour >= s.activeStartHour && hour < s.activeEndHour;
  }
  return hour >= s.activeStartHour || hour < s.activeEndHour; // overnight
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("growthSettings").first();
  },
});

export const set = mutation({
  args: {
    activeStartHour: v.number(),
    activeEndHour: v.number(),
    tzOffsetMinutes: v.number(),
    notifyEnabled: v.optional(v.boolean()),
    notifyMinFollowers: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (
      args.activeStartHour < 0 ||
      args.activeStartHour > 23 ||
      args.activeEndHour < 0 ||
      args.activeEndHour > 23
    ) {
      throw new Error("Hours must be 0-23.");
    }
    const existing = await ctx.db.query("growthSettings").first();
    const row = { ...args, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("growthSettings", row);
    return null;
  },
});

export const getInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("growthSettings").first();
  },
});
