import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { escapeHtml, sendTelegram } from "./telegram";

/**
 * Record a cron run's outcome (convex/cronHealth.ts) and Telegram-alert on
 * failure (throttled to once per cron per 12h by the record mutation). Never
 * throws — health reporting must not change a job's own success/failure.
 */
export async function reportCron(
  ctx: Pick<ActionCtx, "runMutation">,
  name: string,
  ok: boolean,
  detail?: string, // error message when !ok, meta when ok
): Promise<void> {
  try {
    const { shouldAlert }: { shouldAlert: boolean } = await ctx.runMutation(
      internal.cronHealth.record,
      {
        name,
        ok,
        error: ok ? undefined : detail,
        meta: ok ? detail : undefined,
      },
    );
    if (shouldAlert) {
      await sendTelegram(
        `⚠️ <b>${escapeHtml(name)}</b> failed\n${escapeHtml((detail ?? "unknown error").slice(0, 300))}`,
      );
    }
  } catch (e) {
    console.error(
      `cronHealth report failed (${name}): ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
