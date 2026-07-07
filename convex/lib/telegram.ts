/**
 * Telegram push notifications (bot API) — the "tap on the shoulder" channel for
 * hot reply opportunities (convex/earlyFeed.ts) and cron-failure alerts
 * (convex/cronHealth.ts callers).
 *
 * Env (Convex): telegram_bot_token, telegram_chat_id. Optional public_site_url
 * for dashboard deep links. Everything no-ops gracefully when unset, and
 * sendTelegram never throws — a notification must never sink a feed refresh.
 */

export function telegramConfigured(): boolean {
  return !!(process.env.telegram_bot_token && process.env.telegram_chat_id);
}

/** Escape for Telegram parse_mode: "HTML" (only &, <, > are significant). */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function siteUrl(): string | null {
  return process.env.public_site_url?.replace(/\/$/, "") ?? null;
}

/** Send an HTML-formatted message. Returns false (and logs) on any failure. */
export async function sendTelegram(html: string): Promise<boolean> {
  const token = process.env.telegram_bot_token;
  const chatId = process.env.telegram_chat_id;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html.slice(0, 4000), // hard cap is 4096
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
    });
    if (!res.ok) {
      console.error(
        `Telegram ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error(
      `Telegram send failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return false;
  }
}
