import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import { sendTelegram, telegramConfigured } from "./lib/telegram";
import { reportCron } from "./lib/cronReport";

/**
 * The weekly "WHO RAISED" block for On Label: a ledger-styled, email-safe HTML
 * table of the week's consumer deals, rendered from the Deal Radar every
 * Sunday (before the weekly review). Delivery into Beehiiv is the manual hop —
 * a copy button on the Deals tab, or Claude pushing it into the Weekly Signal
 * template's HTML-snippet block via the Beehiiv MCP. Everything upstream of
 * that hop is automatic.
 */

const WEEK_MS = 7 * 86_400_000;
const MAX_ROWS = 12;
// Email height budget: only the top entries get the full treatment
// (description + founders); the rest collapse to one-line ledger rows.
const FEATURED_ROWS = 4;
// Core beat first, then the consumer-adjacent rest.
const CATEGORY_RANK: Record<string, number> = {
  "consumer-health": 0,
  wellness: 0,
  cpg: 0,
  "consumer-fintech": 1,
  marketplace: 1,
  "consumer-other": 1,
};

// Ledger tokens, inlined for email clients (no stylesheet survives sending).
const PAPER = "#F7F4EE";
const INK = "#141210";
const VERMILION = "#C7331D";
const TAN = "#EDE7DA";
const FADE = "#55503F";
const MONO = "'Space Mono','Courier New',monospace";

interface BlockDeal {
  company: string;
  round: string;
  amountUsd: number | null;
  amountNote?: string;
  leadInvestor?: string;
  category: string;
  companyDesc?: string;
  summary: string;
  founders?: { name: string; xHandle?: string }[];
  hqCountry?: string;
  sourceUrl: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtAmount(amountUsd: number | null, amountNote?: string): string {
  if (amountNote) return amountNote;
  if (!amountUsd) return "UNDISCLOSED";
  if (amountUsd >= 1_000_000_000) return `$${(amountUsd / 1_000_000_000).toFixed(1)}B`;
  if (amountUsd >= 1_000_000) return `$${Math.round(amountUsd / 1_000_000)}M`;
  return `$${Math.round(amountUsd / 1000)}K`;
}

function fmtRound(round: string): string {
  return round === "unknown" ? "" : round.replace("-", " ").toUpperCase();
}

function weekRange(nowMs: number): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const from = new Date(nowMs - WEEK_MS).toLocaleDateString("en-US", opts);
  const to = new Date(nowMs).toLocaleDateString("en-US", opts);
  return `${from} – ${to}`.toUpperCase();
}

/** Render the block. Table layout + inline styles only — this travels by email. */
export function renderBlock(deals: BlockDeal[], nowMs: number): string {
  const featured = deals.slice(0, FEATURED_ROWS);
  const rest = deals.slice(FEATURED_ROWS);

  const featuredRows = featured
    .map((d, i) => {
      const founders = (d.founders ?? [])
        .map((f) =>
          f.xHandle
            ? `<a href="https://x.com/${esc(f.xHandle)}" style="color:${VERMILION};text-decoration:none;">${esc(f.name)}</a>`
            : esc(f.name),
        )
        .join(", ");
      const meta = [
        fmtRound(d.round),
        d.leadInvestor ? `LED BY ${esc(d.leadInvestor.toUpperCase())}` : "",
        d.hqCountry ? esc(d.hqCountry.toUpperCase()) : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<tr>
<td style="padding:10px 18px 9px;border-top:${i === 0 ? "none" : `1px dashed ${INK}`};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${MONO};font-size:14px;font-weight:700;color:${INK};"><a href="${esc(d.sourceUrl)}" style="color:${INK};text-decoration:none;">${esc(d.company.toUpperCase())}</a></td>
<td align="right" style="font-family:${MONO};font-size:14px;font-weight:700;color:${VERMILION};white-space:nowrap;">${esc(fmtAmount(d.amountUsd, d.amountNote))}</td>
</tr></table>
${meta ? `<div style="font-family:${MONO};font-size:10px;color:${FADE};letter-spacing:0.5px;margin-top:1px;">${meta}</div>` : ""}
<div style="font-family:Georgia,serif;font-size:13px;line-height:1.4;color:${INK};margin-top:3px;">${esc(d.companyDesc ?? d.summary)}</div>
${founders ? `<div style="font-family:${MONO};font-size:11px;color:${FADE};margin-top:2px;">FOUNDERS: ${founders}</div>` : ""}
</td>
</tr>`;
    })
    .join("\n");

  // The rest of the tape: one line per deal — company · round/lead ····· amount.
  const restRows = rest
    .map((d) => {
      const meta = [fmtRound(d.round), d.leadInvestor ? esc(d.leadInvestor.toUpperCase()) : ""]
        .filter(Boolean)
        .join(" · ");
      return `<tr>
<td style="padding:5px 18px;border-top:1px dashed ${TAN};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${MONO};font-size:12px;font-weight:700;color:${INK};white-space:nowrap;"><a href="${esc(d.sourceUrl)}" style="color:${INK};text-decoration:none;">${esc(d.company.toUpperCase())}</a></td>
<td style="font-family:${MONO};font-size:10px;color:${FADE};padding-left:10px;">${meta}</td>
<td align="right" style="font-family:${MONO};font-size:12px;font-weight:700;color:${VERMILION};white-space:nowrap;padding-left:10px;">${esc(fmtAmount(d.amountUsd, d.amountNote))}</td>
</tr></table>
</td>
</tr>`;
    })
    .join("\n");

  const rows =
    featuredRows +
    (rest.length > 0
      ? `\n<tr><td style="padding:6px 18px 3px;border-top:1px dashed ${INK};font-family:${MONO};font-size:9px;font-weight:700;color:${FADE};letter-spacing:1px;">THE REST OF THE TAPE</td></tr>\n${restRows}`
      : "");

  return `<!-- WHO RAISED · generated ${new Date(nowMs).toISOString().slice(0, 10)} by the Deal Radar -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};border:2px solid ${INK};margin:8px 0;">
<tr><td style="background:${TAN};padding:10px 18px;border-bottom:2px solid ${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${MONO};font-size:12px;font-weight:700;color:${INK};letter-spacing:1px;">WHO RAISED <span style="color:${VERMILION};">■</span></td>
<td align="right" style="font-family:${MONO};font-size:10px;color:${FADE};letter-spacing:0.5px;">${weekRange(nowMs)} · ${deals.length} ENTR${deals.length === 1 ? "Y" : "IES"}</td>
</tr></table>
</td></tr>
${rows || `<tr><td style="padding:16px 18px;font-family:${MONO};font-size:12px;color:${FADE};">A QUIET WEEK — NO CONSUMER ROUNDS CLEARED THE FILTER.</td></tr>`}
<tr><td style="border-top:2px solid ${INK};padding:8px 18px;">
<a href="https://lnkd.world/deals" style="font-family:${MONO};font-size:11px;font-weight:700;color:${VERMILION};text-decoration:none;letter-spacing:0.5px;">THE FULL LEDGER → LNKD.WORLD/DEALS</a>
</td></tr>
</table>`;
}

/** Internal: the week's consumer deals, core beat first, biggest checks first. */
export const weekDealsInternal = internalQuery({
  args: { nowMs: v.number() },
  handler: async (ctx, { nowMs }): Promise<BlockDeal[]> => {
    const rows = await ctx.db
      .query("deals")
      .withIndex("by_isConsumer_firstSeenAt", (q) =>
        q.eq("isConsumer", true).gt("firstSeenAt", nowMs - WEEK_MS),
      )
      .collect();
    return rows
      .filter((d) => (d.announcedAt ?? d.firstSeenAt) > nowMs - WEEK_MS)
      .filter((d) => d.status !== "dismissed" && d.confidence >= 0.6)
      .sort(
        (a, b) =>
          (CATEGORY_RANK[a.category] ?? 2) - (CATEGORY_RANK[b.category] ?? 2) ||
          (b.amountUsd ?? 0) - (a.amountUsd ?? 0),
      )
      .slice(0, MAX_ROWS)
      .map((d) => ({
        company: d.company,
        round: d.round,
        amountUsd: d.amountUsd,
        amountNote: d.amountNote,
        leadInvestor: d.leadInvestor,
        category: d.category,
        companyDesc: d.companyDesc,
        summary: d.summary,
        founders: d.founders,
        hqCountry: d.hqCountry,
        sourceUrl: d.sources[0]?.url ?? "https://lnkd.world/deals",
      }));
  },
});

export const store = internalMutation({
  args: { html: v.string(), dealCount: v.number(), generatedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("dealsBlocks", args);
    // Keep the last 8 weeks; this table is a working buffer, not an archive.
    const old = await ctx.db
      .query("dealsBlocks")
      .withIndex("by_generatedAt")
      .order("desc")
      .collect();
    for (const row of old.slice(8)) await ctx.db.delete(row._id);
    return null;
  },
});

/** Sunday cron (also CLI-runnable): render + store + ping. */
export const generateInternal = internalAction({
  args: {},
  returns: v.object({ dealCount: v.number() }),
  handler: async (ctx) => {
    const nowMs = Date.now();
    try {
      const deals: BlockDeal[] = await ctx.runQuery(
        internal.dealsBlock.weekDealsInternal,
        { nowMs },
      );
      const html = renderBlock(deals, nowMs);
      await ctx.runMutation(internal.dealsBlock.store, {
        html,
        dealCount: deals.length,
        generatedAt: nowMs,
      });
      if (telegramConfigured()) {
        await sendTelegram(
          `📰 <b>Weekly deals block ready</b> — ${deals.length} consumer deals.\nCopy it from <a href="https://lnkd.world/admin/growth#deals">the Deals tab</a> or ask Claude to push it into the Beehiiv template.`,
        );
      }
      await reportCron(ctx, "weekly-deals-block", true, `deals=${deals.length}`);
      return { dealCount: deals.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await reportCron(ctx, "weekly-deals-block", false, message);
      throw new Error(`Weekly deals block failed: ${message}`);
    }
  },
});

/** Admin: the latest rendered block for the Deals tab panel. */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("dealsBlocks")
      .withIndex("by_generatedAt")
      .order("desc")
      .first();
  },
});
