import { internalAction, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { sendTelegram, telegramConfigured } from "./lib/telegram";

/**
 * Cron health: one row per cron name, upserted on every run by the tail/catch
 * of each major internalAction. Powers the Overview health strip and decides —
 * atomically, with a 12h throttle — when a failure should Telegram-alert.
 */

const ALERT_THROTTLE_MS = 12 * 3_600_000;

export const record = internalMutation({
  args: {
    name: v.string(),
    ok: v.boolean(),
    error: v.optional(v.string()),
    meta: v.optional(v.string()),
  },
  returns: v.object({ shouldAlert: v.boolean() }),
  handler: async (ctx, { name, ok, error, meta }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("cronHealth")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();

    const shouldAlert =
      !ok &&
      (!existing?.lastAlertAt || now - existing.lastAlertAt > ALERT_THROTTLE_MS);

    const patch = {
      lastRunAt: now,
      ok,
      meta,
      ...(ok
        ? { lastOkAt: now }
        : {
            lastError: error?.slice(0, 500),
            lastErrorAt: now,
            ...(shouldAlert ? { lastAlertAt: now } : {}),
          }),
    };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("cronHealth", { name, ...patch });
    return { shouldAlert };
  },
});

/** Diagnostics: send a test Telegram message through the deployed lib. */
export const testTelegram = internalAction({
  args: {},
  returns: v.object({ configured: v.boolean(), sent: v.boolean() }),
  handler: async () => {
    if (!telegramConfigured()) return { configured: false, sent: false };
    const sent = await sendTelegram(
      "✅ <b>LNKD growth system connected.</b>\nHot reply opportunities and cron alerts will land here.",
    );
    return { configured: true, sent };
  },
});

/** Admin: all cron health rows for the Overview strip. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("cronHealth").take(50);
  },
});
