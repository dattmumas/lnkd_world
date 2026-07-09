import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { gatherRss, type SourceHealth } from "./lib/rss";
import { gxSearch } from "./lib/getxapi";
import {
  dealBaseScore,
  externalIdFor,
  tweetIdFromLink,
  HALF_LIFE_HOURS,
  type QueueItemPayload,
} from "./lib/queueScore";
import { escapeHtml, sendTelegram, siteUrl, telegramConfigured } from "./lib/telegram";
import { reportCron } from "./lib/cronReport";
import { inActiveHours, type GrowthSettings } from "./growthSettings";

/**
 * Consumer Deal Radar pipeline: fuse two signal layers into the deals table
 * (convex/deals.ts) —
 *   1. RSS deal digests (dealSources) — the workhorse; funding-roundup posts
 *      carry many deals per item, read via content:encoded.
 *   2. X real-time — watchlist posts already in feedItems (free) plus two
 *      founder/investor keyword sweeps (gxSearch).
 * Candidates are prefiltered by regex, batch-extracted by Claude into
 * structured deals, deduped/merged by (company, round), then new consumer
 * deals push to Telegram and enter the engagement queue (a funding
 * announcement is a prime reply moment). Hourly during active hours; RSS-only
 * every 4h overnight.
 */

const RSS_WINDOW_MS = 48 * 3_600_000; // survives a day of failed runs; dealSeen dedups
const X_WINDOW_MS = 3 * 3_600_000;
const SWEEP_WINDOW_MS = 2 * 3_600_000;
const MAX_CANDIDATES_PER_RUN = 60;
const EXTRACT_CHUNK = 20;
const NOTIFY_PER_RUN = 5; // individual pushes; the rest go in one digest
const NOTIFY_MAX_AGE_MS = 24 * 3_600_000; // overnight flush window
export const MIN_PUSH_AMOUNT_USD = 0; // raise to e.g. 5_000_000 to quiet small rounds

// Prefilter: articles must name a deal verb AND money; X posts pass on the
// verb alone (founders often omit the amount).
const DEAL_VERB =
  /\brais(?:e[sd]?|ing)\b|\bfunding\b|\bfinanc(?:e[sd]?|ing)\b|\bseries\s+[a-e]\b|\bpre-?seed\b|\bseed\s+round\b|\bventure\s+round\b|\bled\s+(?:the|our|a)\s+(?:round|investment)\b|\bcloses?\s+\$|\bsecure[sd]?\s+\$/i;
const MONEY = /[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:million|billion|[mb]n?)\b/i;

const SWEEP_FOUNDER =
  '("we raised" OR "we\'ve raised" OR "we just raised" OR "raised our" OR "announcing our") ("pre-seed" OR seed OR "Series A" OR "Series B" OR round OR funding) -is:retweet -is:reply lang:en';
const SWEEP_INVESTOR =
  '("led our" OR "we led" OR "excited to lead" OR "proud to lead" OR "thrilled to lead" OR "co-led") (seed OR "Series A" OR "Series B" OR round OR investment) -is:retweet -is:reply lang:en';

const ROUNDS = new Set([
  "pre-seed", "seed", "series-a", "series-b", "series-c", "series-d",
  "series-e", "growth", "unknown",
]);

interface Candidate {
  externalId: string;
  title: string;
  text: string;
  source: string;
  link: string;
  dateMs: number;
  isPost: boolean;
}

interface ExtractedDeal {
  company: string;
  round: string;
  amountUsd: number | null;
  amountNote?: string;
  investors: string[];
  leadInvestor?: string;
  category: string;
  isConsumer: boolean;
  confidence: number;
  summary: string;
  companyDesc?: string;
  leadDesc?: string;
  announcedDateMs?: number;
}

const EXTRACT_SYSTEM = `You extract venture funding deals from news items and X posts. Items are numbered; roundup posts (e.g. "The AlleyWatch Startup Daily Funding Report") contain MANY deals — extract every one. Regular articles usually contain one. Some items contain none (rumors about public companies, VC firms raising their own funds, M&A, IPOs) — return an empty deals array for those.

For each deal:
- company: the startup's name as written (never the investor).
- round: one of pre-seed | seed | series-a | series-b | series-c | series-d | series-e | growth | unknown.
- amountUsd: the raise as a plain number in USD (convert roughly: €1≈$1.08, £1≈$1.27; round cleanly). null if undisclosed.
- amountNote: original figure when non-USD (e.g. "€12M"), else omit.
- investors: named participants in the round (empty array if none named).
- lead: the lead investor if identified, else null.
- category: one of consumer-health | wellness | cpg | consumer-fintech | marketplace | social | gaming | travel | consumer-other | b2b | biotech | deeptech | other.
- isConsumer: true only if the company primarily sells to consumers (health, wellness, CPG, consumer fintech, marketplaces, social, gaming, travel). B2B/enterprise/infra/dev-tools/biotech-R&D = false.
- confidence: 0-1 that this is a real, announced venture round with fields as extracted. "Reportedly raising" or unconfirmed = 0.5 or less.
- summary: what the company does + the raise, under 140 chars.
- companyDesc: one plain line on what the company does (from the item text), under 120 chars.
- leadDesc: one plain line on who the lead investor is (stage/thesis/notable bets — general knowledge is fine, e.g. "Consumer-focused VC; early Hims and Glossier backer"), under 120 chars. null if you don't know the firm.
- announcedDate: "YYYY-MM-DD" ONLY if the item explicitly states when the round was announced or closed ("announced Tuesday", "closed June 30"); null otherwise — never guess.

Return ONLY JSON, no prose:
{"items":[{"n":<item number>,"deals":[{"company":"...","round":"seed","amountUsd":12000000,"amountNote":"€11M","investors":["..."],"lead":"...","category":"consumer-health","isConsumer":true,"confidence":0.9,"summary":"...","companyDesc":"...","leadDesc":"...","announcedDate":null}]}]}
Include an entry for EVERY item number, with "deals":[] when none. Extract the same deal from each item it appears in (deduplication happens downstream).`;

// Explicit announcement date from extraction, sanity-bounded: not in the
// future, not older than 60 days (protects against model hallucination).
function parseAnnouncedDate(s: string | null | undefined): number | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return undefined;
  const now = Date.now();
  if (ms > now + 86_400_000 || ms < now - 60 * 86_400_000) return undefined;
  return ms;
}

// ---- extraction -------------------------------------------------------------

// `ok: false` means the chunk never got a usable Claude answer (no key, HTTP
// error, unparseable output) — the caller must NOT mark those candidates seen,
// or every deal during an Anthropic outage is burned forever. An index absent
// from `byIndex` on an ok chunk simply had no deals.
async function extractChunk(
  candidates: Candidate[],
  offset: number,
): Promise<{ ok: boolean; byIndex: Map<number, ExtractedDeal[]> }> {
  const key = process.env.anthropic_api_key;
  const out = new Map<number, ExtractedDeal[]>();
  if (candidates.length === 0) return { ok: true, byIndex: out };
  if (!key) return { ok: false, byIndex: out };

  const list = candidates
    .map(
      (c, i) =>
        `[${offset + i}] (${c.source}) ${c.title || "(X post)"}\n${c.link}\n${c.text.slice(0, 6000)}`,
    )
    .join("\n\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        thinking: { type: "disabled" },
        system: EXTRACT_SYSTEM,
        messages: [{ role: "user", content: list }],
      }),
    });
    if (!res.ok) {
      console.error(`Deal extract ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return { ok: false, byIndex: out };
    }
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, byIndex: out };
    const parsed = JSON.parse(match[0]) as {
      items?: {
        n?: number;
        deals?: {
          company?: string;
          round?: string;
          amountUsd?: number | null;
          amountNote?: string;
          investors?: string[];
          lead?: string | null;
          category?: string;
          isConsumer?: boolean;
          confidence?: number;
          summary?: string;
          companyDesc?: string | null;
          leadDesc?: string | null;
          announcedDate?: string | null;
        }[];
      }[];
    };
    for (const item of parsed.items ?? []) {
      if (typeof item.n !== "number") continue;
      const deals: ExtractedDeal[] = [];
      for (const d of item.deals ?? []) {
        if (!d.company) continue;
        deals.push({
          company: String(d.company).slice(0, 120),
          round: ROUNDS.has(d.round ?? "") ? (d.round as string) : "unknown",
          amountUsd:
            typeof d.amountUsd === "number" && d.amountUsd > 0 ? d.amountUsd : null,
          amountNote: d.amountNote ? String(d.amountNote).slice(0, 30) : undefined,
          investors: (d.investors ?? []).map((x) => String(x).slice(0, 80)).slice(0, 20),
          leadInvestor: d.lead ? String(d.lead).slice(0, 80) : undefined,
          category: String(d.category ?? "other").slice(0, 30),
          isConsumer: d.isConsumer === true,
          confidence: Math.max(0, Math.min(1, Number(d.confidence ?? 0.5))),
          summary: String(d.summary ?? "").slice(0, 160),
          companyDesc: d.companyDesc ? String(d.companyDesc).slice(0, 140) : undefined,
          leadDesc: d.leadDesc ? String(d.leadDesc).slice(0, 140) : undefined,
          announcedDateMs: parseAnnouncedDate(d.announcedDate),
        });
      }
      out.set(item.n, deals);
    }
  } catch (e) {
    console.error(
      `Deal extract chunk failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return { ok: false, byIndex: out };
  }
  return { ok: true, byIndex: out };
}

// ---- helpers ----------------------------------------------------------------

function fmtAmount(amountUsd: number | null, amountNote?: string): string {
  if (amountNote) return amountNote;
  if (!amountUsd) return "undisclosed";
  if (amountUsd >= 1_000_000_000) return `$${(amountUsd / 1_000_000_000).toFixed(1)}B`;
  if (amountUsd >= 1_000_000) return `$${Math.round(amountUsd / 1_000_000)}M`;
  return `$${Math.round(amountUsd / 1000)}K`;
}

type NewConsumerDeal = {
  id: Id<"deals">;
  company: string;
  round: string;
  amountUsd: number | null;
  amountNote?: string;
  leadInvestor?: string;
  category: string;
  summary: string;
  link: string;
  tweetId?: string;
  announcedAt?: number;
};

// Fill missing company/lead descriptions for recent deals (one cheap Claude
// call; runs only when gaps exist — extraction normally provides both).
async function enrichMissing(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
): Promise<void> {
  const key = process.env.anthropic_api_key;
  if (!key) return;
  const targets: {
    id: Id<"deals">;
    company: string;
    summary: string;
    leadInvestor?: string;
    category: string;
    needsCompany: boolean;
    needsLead: boolean;
  }[] = await ctx.runQuery(internal.deals.missingDescInternal, {});
  if (targets.length === 0) return;

  const list = targets
    .map(
      (t, i) =>
        `[${i}] ${t.company} (${t.category}) — ${t.summary}${t.leadInvestor ? ` — lead investor: ${t.leadInvestor}` : ""}`,
    )
    .join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      thinking: { type: "disabled" },
      system: `For each numbered startup, write:
- companyDesc: one plain line on what the company does, under 120 chars (infer from the summary; no hype words).
- leadDesc: one plain line on who the lead investor is (stage, thesis, notable bets — general knowledge), under 120 chars. null if no lead given or you don't know the firm.
Return ONLY JSON: {"rows":[{"n":0,"companyDesc":"...","leadDesc":"..."}]} with an entry for every number.`,
      messages: [{ role: "user", content: list }],
    }),
  });
  if (!res.ok) {
    console.error(`Deal enrich ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return;
  const parsed = JSON.parse(match[0]) as {
    rows?: { n?: number; companyDesc?: string | null; leadDesc?: string | null }[];
  };
  const rows = (parsed.rows ?? [])
    .filter((r) => typeof r.n === "number" && targets[r.n as number])
    .map((r) => {
      const t = targets[r.n as number];
      return {
        id: t.id,
        companyDesc: t.needsCompany && r.companyDesc ? String(r.companyDesc) : undefined,
        leadDesc: t.needsLead && r.leadDesc ? String(r.leadDesc) : undefined,
      };
    })
    .filter((r) => r.companyDesc || r.leadDesc);
  if (rows.length > 0) {
    await ctx.runMutation(internal.deals.applyEnrichment, { rows });
    console.log(`dealRadar enrich: filled descriptions for ${rows.length} deals`);
  }
}

// ---- pipeline ---------------------------------------------------------------

export const refreshInternal = internalAction({
  args: {
    sweepX: v.optional(v.boolean()), // include X read-back + keyword sweeps
    notify: v.optional(v.boolean()), // Telegram pushes (incl. overnight flush)
  },
  returns: v.object({
    status: v.string(),
    candidates: v.number(),
    extracted: v.number(),
    newConsumer: v.number(),
  }),
  handler: async (ctx, { sweepX, notify }) => {
    const nowMs = Date.now();
    try {
      // ---- gather ----
      const sources: { name: string; url: string }[] = await ctx.runQuery(
        internal.dealSources.activeSources,
        {},
      );
      const { items: rssItems, health } = await gatherRss(sources, nowMs, RSS_WINDOW_MS, {
        textCap: 6000,
        preferFullContent: true,
        maxPerSource: 30,
      });

      let candidates: Candidate[] = rssItems.map((it) => ({
        externalId: externalIdFor("article", it.link),
        title: it.title,
        text: it.text,
        source: it.source,
        link: it.link,
        dateMs: it.dateMs,
        isPost: false,
      }));

      if (sweepX) {
        // Watchlist posts already paid for by the early feed.
        const watchlist: {
          externalId: string;
          text: string;
          link: string;
          source: string;
          publishedAt: number;
        }[] = await ctx.runQuery(internal.feedItems.recentXPosts, {
          sinceMs: nowMs - X_WINDOW_MS,
        });
        for (const p of watchlist) {
          candidates.push({
            externalId: p.externalId,
            title: "",
            text: p.text,
            source: p.source,
            link: p.link,
            dateMs: p.publishedAt,
            isPost: true,
          });
        }
        // Founder/investor announcement sweeps.
        for (const q of [SWEEP_FOUNDER, SWEEP_INVESTOR]) {
          try {
            const { tweets, users } = await gxSearch(q, {
              product: "Latest",
              maxAgeMs: SWEEP_WINDOW_MS,
              maxTweets: 40,
            });
            const byId = new Map(users.map((u) => [u.id, u]));
            for (const t of tweets) {
              const u = byId.get(t.author_id);
              candidates.push({
                externalId: externalIdFor("x-post", t.id),
                title: "",
                text: t.text,
                source: u ? "@" + u.username : "X",
                link: u
                  ? `https://x.com/${u.username}/status/${t.id}`
                  : `https://x.com/i/status/${t.id}`,
                dateMs: Date.parse(t.created_at) || nowMs,
                isPost: true,
              });
            }
          } catch (e) {
            console.error(
              `Deal sweep failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
      }

      // ---- dedupe within run + against previously extracted ----
      const byId = new Map<string, Candidate>();
      for (const c of candidates) if (!byId.has(c.externalId)) byId.set(c.externalId, c);
      candidates = [...byId.values()];
      const seen: string[] = await ctx.runQuery(internal.dealsFeed.seenFilter, {
        externalIds: candidates.map((c) => c.externalId),
      });
      const seenSet = new Set(seen);
      const fresh = candidates.filter((c) => !seenSet.has(c.externalId));

      // ---- prefilter + cap ----
      const survivors = fresh
        .filter((c) => {
          const blob = `${c.title} ${c.text}`;
          return c.isPost
            ? DEAL_VERB.test(blob)
            : DEAL_VERB.test(blob) && MONEY.test(blob);
        })
        .sort((a, b) => b.dateMs - a.dateMs)
        .slice(0, MAX_CANDIDATES_PER_RUN);

      console.log(
        `dealRadar: rss=${rssItems.length} candidates=${candidates.length} fresh=${fresh.length} survivors=${survivors.length}`,
      );

      // ---- extract (chunked; a failed chunk never sinks the run) ----
      const extractedByIndex = new Map<number, ExtractedDeal[]>();
      const failedExtract = new Set<string>(); // externalIds to retry next run
      for (let i = 0; i < survivors.length; i += EXTRACT_CHUNK) {
        const chunk = survivors.slice(i, i + EXTRACT_CHUNK);
        const { ok, byIndex } = await extractChunk(chunk, i);
        if (!ok) for (const c of chunk) failedExtract.add(c.externalId);
        for (const [n, deals] of byIndex) extractedByIndex.set(n, deals);
      }

      const payloads = [];
      for (const [n, deals] of extractedByIndex) {
        const cand = survivors[n];
        if (!cand) continue;
        for (const d of deals) {
          if (d.confidence < 0.3) continue; // rumor floor
          const { announcedDateMs, ...deal } = d;
          payloads.push({
            ...deal,
            sourceName: cand.source,
            sourceUrl: cand.link,
            // Explicit date stated in the text beats the item's publish date.
            announcedAt: announcedDateMs ?? (cand.dateMs || undefined),
            tweetId: cand.isPost ? (tweetIdFromLink(cand.link) ?? undefined) : undefined,
          });
        }
      }

      // ---- persist ----
      const upsert: {
        inserted: number;
        merged: number;
        newConsumer: NewConsumerDeal[];
      } = payloads.length
        ? await ctx.runMutation(internal.deals.upsertDeals, { deals: payloads })
        : { inserted: 0, merged: 0, newConsumer: [] };

      // Mark fresh candidates as processed (prefiltered-out ones too) — EXCEPT
      // survivors whose extract chunk failed, so they retry while still inside
      // the gather windows instead of being burned by an Anthropic outage.
      const processed = fresh.filter((c) => !failedExtract.has(c.externalId));
      if (processed.length > 0) {
        await ctx.runMutation(internal.dealsFeed.markSeenCandidates, {
          externalIds: processed.map((c) => c.externalId),
        });
      }

      // ---- notify (with overnight flush) ----
      if (notify && telegramConfigured()) {
        try {
          const flush: NewConsumerDeal[] = await ctx.runQuery(
            internal.deals.unnotifiedConsumerInternal,
            { sinceMs: nowMs - NOTIFY_MAX_AGE_MS },
          );
          const byDealId = new Map<string, NewConsumerDeal>();
          for (const d of [...upsert.newConsumer, ...flush]) byDealId.set(d.id, d);
          const pending = [...byDealId.values()].filter(
            (d) => (d.amountUsd ?? Infinity) >= MIN_PUSH_AMOUNT_USD,
          );
          pending.sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1));

          const dash = siteUrl();
          const sent: Id<"deals">[] = [];
          for (const d of pending.slice(0, NOTIFY_PER_RUN)) {
            const lines = [
              `💰 <b>${escapeHtml(d.company)}</b> — <b>${escapeHtml(fmtAmount(d.amountUsd, d.amountNote))} ${escapeHtml(d.round)}</b>`,
              `${escapeHtml(d.category)}${d.leadInvestor ? ` · led by ${escapeHtml(d.leadInvestor)}` : ""}`,
              escapeHtml(d.summary),
              `<a href="${d.tweetId ? `https://x.com/i/status/${d.tweetId}` : d.link}">Announcement</a>${dash ? ` · <a href="${dash}/admin/growth#deals">Deals</a>` : ""}`,
            ];
            if (await sendTelegram(lines.join("\n"))) sent.push(d.id);
          }
          const rest = pending.slice(NOTIFY_PER_RUN);
          if (rest.length > 0) {
            const digest = rest
              .slice(0, 20)
              .map(
                (d) =>
                  `• ${escapeHtml(d.company)} — ${escapeHtml(fmtAmount(d.amountUsd, d.amountNote))} ${escapeHtml(d.round)} (${escapeHtml(d.category)})`,
              )
              .join("\n");
            if (await sendTelegram(`💰 <b>${rest.length} more consumer deals</b>\n${digest}`)) {
              sent.push(...rest.slice(0, 20).map((d) => d.id));
            }
          }
          if (sent.length > 0) {
            await ctx.runMutation(internal.deals.markNotified, { ids: sent });
          }
        } catch (e) {
          console.error(
            `Deal notify failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      // ---- queue emission (best-effort) ----
      if (upsert.newConsumer.length > 0) {
        try {
          const items: QueueItemPayload[] = upsert.newConsumer.map((d) => ({
            kind: d.tweetId ? ("x-post" as const) : ("article" as const),
            externalId: d.tweetId
              ? externalIdFor("x-post", d.tweetId)
              : externalIdFor("article", d.link),
            feed: "deals",
            title: `${d.company} raised ${fmtAmount(d.amountUsd, d.amountNote)} (${d.round})`,
            text: d.summary,
            link: d.tweetId ? `https://x.com/i/status/${d.tweetId}` : d.link,
            source: "Deal Radar",
            baseScore: dealBaseScore(d.amountUsd),
            halfLifeHours: HALF_LIFE_HOURS.deals,
            scoreReason: `New consumer deal: ${fmtAmount(d.amountUsd, d.amountNote)} ${d.round} (${d.category})`,
            publishedAt: d.announcedAt ?? 0,
          }));
          await ctx.runMutation(internal.feedItems.upsertBatch, { items });
        } catch (e) {
          console.error(
            `Deal queue emit failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      // ---- enrichment self-heal: fill missing descriptions (best-effort) ----
      try {
        await enrichMissing(ctx);
      } catch (e) {
        console.error(
          `Deal enrichment failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      // ---- health + cron report ----
      try {
        const healthJson = JSON.stringify({
          checkedAt: new Date(nowMs).toISOString(),
          sources: Object.fromEntries(
            health.map((h: SourceHealth) => [h.url, h]),
          ),
        });
        await ctx.runMutation(internal.scienceFeed.storeHealth, {
          data: healthJson,
          checkedAt: new Date(nowMs).toISOString(),
        });
      } catch (e) {
        console.error(
          `Deal health store failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      await reportCron(
        ctx,
        "deal-radar",
        true,
        `cand=${survivors.length} new=${upsert.inserted} merged=${upsert.merged} consumer=${upsert.newConsumer.length}`,
      );
      return {
        status: "ok",
        candidates: survivors.length,
        extracted: payloads.length,
        newConsumer: upsert.newConsumer.length,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await reportCron(ctx, "deal-radar", false, message);
      throw new Error(`Deal radar refresh failed: ${message}`);
    }
  },
});

/**
 * One-time historical backfill: run the announcement sweeps week-by-week using
 * X search date operators (since:/until:), through the same prefilter →
 * extraction → dedup path. No notifications, no queue emission — this is
 * dataset building, the reply windows are long gone. Safe to re-run (dealSeen
 * + dedupKey make it idempotent).
 */
export const backfillInternal = internalAction({
  args: {
    weeks: v.number(),
    startWeek: v.optional(v.number()), // run in slices — one action can't fit 8 weeks in the 10-min limit
  },
  returns: v.object({
    windows: v.number(),
    candidates: v.number(),
    inserted: v.number(),
    merged: v.number(),
  }),
  handler: async (ctx, { weeks, startWeek }) => {
    const nowMs = Date.now();
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const first = startWeek ?? 0;
    let totalCandidates = 0;
    let inserted = 0;
    let merged = 0;
    let windows = 0;

    for (let w = first; w < Math.min(first + weeks, 16); w++) {
      const until = day(nowMs - w * 7 * 86_400_000);
      const since = day(nowMs - (w + 1) * 7 * 86_400_000);
      const candidates: Candidate[] = [];
      for (const base of [SWEEP_FOUNDER, SWEEP_INVESTOR]) {
        try {
          const { tweets, users } = await gxSearch(
            `${base} since:${since} until:${until}`,
            { product: "Top", maxTweets: 100 },
          );
          const byId = new Map(users.map((u) => [u.id, u]));
          for (const t of tweets) {
            const u = byId.get(t.author_id);
            candidates.push({
              externalId: externalIdFor("x-post", t.id),
              title: "",
              text: t.text,
              source: u ? "@" + u.username : "X",
              link: u
                ? `https://x.com/${u.username}/status/${t.id}`
                : `https://x.com/i/status/${t.id}`,
              dateMs: Date.parse(t.created_at) || 0,
              isPost: true,
            });
          }
        } catch (e) {
          console.error(
            `Backfill sweep ${since}..${until} failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      // Dedup within + against previous runs, prefilter, cap per window.
      const uniq = new Map<string, Candidate>();
      for (const c of candidates) if (!uniq.has(c.externalId)) uniq.set(c.externalId, c);
      const ids = [...uniq.keys()];
      const seen: string[] = await ctx.runQuery(internal.dealsFeed.seenFilter, {
        externalIds: ids,
      });
      const seenSet = new Set(seen);
      const survivors = [...uniq.values()]
        .filter((c) => !seenSet.has(c.externalId) && DEAL_VERB.test(c.text))
        .slice(0, MAX_CANDIDATES_PER_RUN);

      const extractedByIndex = new Map<number, ExtractedDeal[]>();
      const failedExtract = new Set<string>(); // failed chunks stay re-runnable
      for (let i = 0; i < survivors.length; i += EXTRACT_CHUNK) {
        const chunk = survivors.slice(i, i + EXTRACT_CHUNK);
        const { ok, byIndex } = await extractChunk(chunk, i);
        if (!ok) for (const c of chunk) failedExtract.add(c.externalId);
        for (const [n, deals] of byIndex) extractedByIndex.set(n, deals);
      }

      const payloads = [];
      for (const [n, deals] of extractedByIndex) {
        const cand = survivors[n];
        if (!cand) continue;
        for (const d of deals) {
          if (d.confidence < 0.3) continue;
          const { announcedDateMs, ...deal } = d;
          payloads.push({
            ...deal,
            sourceName: cand.source,
            sourceUrl: cand.link,
            announcedAt: announcedDateMs ?? (cand.dateMs || undefined),
            tweetId: tweetIdFromLink(cand.link) ?? undefined,
          });
        }
      }

      if (payloads.length > 0) {
        const result: { inserted: number; merged: number; newConsumer: unknown[] } =
          await ctx.runMutation(internal.deals.upsertDeals, { deals: payloads });
        inserted += result.inserted;
        merged += result.merged;
      }
      const processed = survivors.filter((c) => !failedExtract.has(c.externalId));
      if (processed.length > 0) {
        await ctx.runMutation(internal.dealsFeed.markSeenCandidates, {
          externalIds: processed.map((c) => c.externalId),
        });
      }
      totalCandidates += survivors.length;
      windows++;
      console.log(
        `dealRadar backfill ${since}..${until}: survivors=${survivors.length} extracted=${payloads.length}`,
      );
    }
    return { windows, candidates: totalCandidates, inserted, merged };
  },
});

/** Hourly cron entry: full sweep during active hours; RSS-only every 4h overnight. */
export const tickInternal = internalAction({
  args: {},
  returns: v.object({ ran: v.boolean(), active: v.boolean() }),
  handler: async (ctx): Promise<{ ran: boolean; active: boolean }> => {
    const nowMs = Date.now();
    const settings: GrowthSettings | null = await ctx.runQuery(
      internal.growthSettings.getInternal,
      {},
    );
    const active = settings != null && inActiveHours(settings, nowMs);
    if (!active && new Date(nowMs).getUTCHours() % 4 !== 2) {
      return { ran: false, active };
    }
    const notifyEnabled = settings?.notifyEnabled !== false;
    const _r: { status: string } = await ctx.runAction(
      internal.dealsFeed.refreshInternal,
      { sweepX: active, notify: active && notifyEnabled },
    );
    return { ran: true, active };
  },
});

export const _assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

/** Admin: manual refresh (full sweep, no pushes). */
export const refresh = action({
  args: {},
  returns: v.object({
    status: v.string(),
    candidates: v.number(),
    extracted: v.number(),
    newConsumer: v.number(),
  }),
  handler: async (ctx) => {
    await ctx.runQuery(internal.dealsFeed._assertAdmin, {});
    const result: {
      status: string;
      candidates: number;
      extracted: number;
      newConsumer: number;
    } = await ctx.runAction(internal.dealsFeed.refreshInternal, {
      sweepX: true,
      notify: false,
    });
    return result;
  },
});

/** Internal: which candidate ids were already extracted in past runs. */
export const seenFilter = internalQuery({
  args: { externalIds: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, { externalIds }) => {
    const out: string[] = [];
    for (const id of externalIds.slice(0, 400)) {
      const row = await ctx.db
        .query("dealSeen")
        .withIndex("by_externalId", (q) => q.eq("externalId", id))
        .first();
      if (row) out.push(id);
    }
    return out;
  },
});

/**
 * Maintenance (CLI): un-mark candidates seen in the last N minutes so the next
 * run re-processes them — outage recovery (deals.upsertDeals dedupes by
 * dedupKey, so re-extraction of an already-captured deal just merges).
 *   npx convex run dealsFeed:unmarkSeenSince '{"minutes": 2880}' --prod
 */
export const unmarkSeenSince = internalMutation({
  args: { minutes: v.number() },
  returns: v.number(),
  handler: async (ctx, { minutes }) => {
    const cutoff = Date.now() - minutes * 60_000;
    const rows = await ctx.db
      .query("dealSeen")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", cutoff))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return rows.length;
  },
});

export const markSeenCandidates = internalMutation({
  args: { externalIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { externalIds }) => {
    const now = Date.now();
    for (const externalId of externalIds.slice(0, 400)) {
      const existing = await ctx.db
        .query("dealSeen")
        .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
        .first();
      if (!existing) await ctx.db.insert("dealSeen", { externalId, createdAt: now });
    }
    return null;
  },
});
