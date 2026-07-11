import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin, requireSubscriber } from "./lib/auth";

/**
 * Consumer Deal Radar storage (see convex/dealsFeed.ts for the pipeline): one
 * row per unique (company, round) funding event. Multiple tellings — an
 * AlleyWatch roundup line, a TechCrunch article, the founder's tweet — merge
 * into a single row that accumulates sources.
 */

// Deals are NEVER pruned — the table is a compounding dataset. Only the
// extraction-dedup markers (dealSeen) age out.
const SEEN_RETENTION_DAYS = 14;
// Window inside which an unknown-round telling is assumed to be the same deal
// as a known-round one for the same company (and vice versa).
const ROUND_RECONCILE_MS = 14 * 86_400_000;

// Trailing corporate suffixes that outlets append inconsistently.
const SUFFIXES = new Set([
  "inc", "llc", "ltd", "co", "corp", "corporation", "company", "labs", "lab",
  "app", "hq", "technologies", "technology", "tech", "ai", "health", "group",
]);

/** Normalize a company name for dedup: "Glow Labs, Inc." → "glow". */
export function normalizeCompanyKey(name: string): string {
  const words = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // diacritics
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  // Strip trailing suffixes, but never below 4 chars of remaining name —
  // protects short real names ("Co", "Hims Health").
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) {
    const withoutLast = words.slice(0, -1).join("");
    if (withoutLast.length < 4) break;
    words.pop();
  }
  return words.join("");
}

export function dedupKeyFor(company: string, round: string): string {
  return `${normalizeCompanyKey(company)}|${round}`;
}

const dealPayload = v.object({
  company: v.string(),
  round: v.string(),
  amountUsd: v.union(v.number(), v.null()),
  amountNote: v.optional(v.string()),
  investors: v.array(v.string()),
  leadInvestor: v.optional(v.string()),
  category: v.string(),
  isConsumer: v.boolean(),
  confidence: v.number(),
  summary: v.string(),
  companyDesc: v.optional(v.string()),
  leadDesc: v.optional(v.string()),
  founders: v.optional(
    v.array(v.object({ name: v.string(), xHandle: v.optional(v.string()) })),
  ),
  hqCountry: v.optional(v.string()),
  website: v.optional(v.string()),
  valuationUsd: v.optional(v.number()),
  totalRaisedUsd: v.optional(v.number()),
  sourceName: v.string(),
  sourceUrl: v.string(),
  announcedAt: v.optional(v.number()),
  tweetId: v.optional(v.string()),
});

const newConsumerRow = v.object({
  id: v.id("deals"),
  company: v.string(),
  round: v.string(),
  amountUsd: v.union(v.number(), v.null()),
  amountNote: v.optional(v.string()),
  leadInvestor: v.optional(v.string()),
  category: v.string(),
  summary: v.string(),
  link: v.string(),
  tweetId: v.optional(v.string()),
  announcedAt: v.optional(v.number()),
});

/** Union investors case-insensitively, keeping first-seen casing. */
function unionInvestors(a: string[], b: string[]): string[] {
  const seen = new Set(a.map((x) => x.toLowerCase()));
  const out = [...a];
  for (const inv of b) {
    if (!seen.has(inv.toLowerCase())) {
      seen.add(inv.toLowerCase());
      out.push(inv);
    }
  }
  return out.slice(0, 20);
}

/**
 * Insert-or-merge extracted deals. Returns the NEWLY INSERTED consumer deals so
 * the pipeline action can notify and queue them (merged re-tellings never
 * re-notify).
 */
export const upsertDeals = internalMutation({
  args: { deals: v.array(dealPayload) },
  returns: v.object({
    inserted: v.number(),
    merged: v.number(),
    newConsumer: v.array(newConsumerRow),
  }),
  handler: async (ctx, { deals }) => {
    const now = Date.now();
    let inserted = 0;
    let merged = 0;
    const newConsumer = [];

    for (const d of deals.slice(0, 100)) {
      const companyKey = normalizeCompanyKey(d.company);
      if (!companyKey) continue;
      const dedupKey = `${companyKey}|${d.round}`;

      // Exact (company, round) match first.
      let existing = await ctx.db
        .query("deals")
        .withIndex("by_dedupKey", (q) => q.eq("dedupKey", dedupKey))
        .first();

      // Unknown-round reconciliation: a known-round telling adopts a recent
      // unknown-round row for the same company; an unknown-round telling
      // attaches to ANY recent row for the same company.
      if (!existing) {
        const sameCompany = await ctx.db
          .query("deals")
          .withIndex("by_companyKey", (q) => q.eq("companyKey", companyKey))
          .take(10);
        // "Same deal" = announced within the reconcile window of each other
        // (announcement-date distance, not insert time — backfills insert
        // months of deals in one run and must not merge across months).
        const incomingAt = d.announcedAt ?? now;
        const recent = sameCompany.filter(
          (r) =>
            Math.abs((r.announcedAt ?? r.firstSeenAt) - incomingAt) <
            ROUND_RECONCILE_MS,
        );
        if (d.round !== "unknown") {
          existing = recent.find((r) => r.round === "unknown") ?? null;
          if (existing) {
            await ctx.db.patch(existing._id, { round: d.round, dedupKey });
          }
        } else {
          existing = recent[0] ?? null;
        }
      }

      if (existing) {
        const patch: Partial<Doc<"deals">> = {
          investors: unionInvestors(existing.investors, d.investors),
          lastSeenAt: now,
        };
        if (existing.amountUsd == null && d.amountUsd != null) {
          patch.amountUsd = d.amountUsd;
          patch.amountNote = d.amountNote;
        }
        if (!existing.leadInvestor && d.leadInvestor) patch.leadInvestor = d.leadInvestor;
        if (!existing.companyDesc && d.companyDesc) patch.companyDesc = d.companyDesc;
        if (!existing.leadDesc && d.leadDesc) patch.leadDesc = d.leadDesc;
        if (!existing.hqCountry && d.hqCountry) patch.hqCountry = d.hqCountry;
        if (!existing.website && d.website) patch.website = d.website;
        if (!existing.valuationUsd && d.valuationUsd) patch.valuationUsd = d.valuationUsd;
        if (!existing.totalRaisedUsd && d.totalRaisedUsd)
          patch.totalRaisedUsd = d.totalRaisedUsd;
        if (d.founders?.length) {
          const have = new Set(
            (existing.founders ?? []).map((f) => f.name.toLowerCase()),
          );
          const added = d.founders.filter((f) => !have.has(f.name.toLowerCase()));
          // A telling that knows a founder's handle upgrades a name-only entry.
          const upgraded = (existing.founders ?? []).map((f) => {
            if (f.xHandle) return f;
            const match = d.founders?.find(
              (g) => g.xHandle && g.name.toLowerCase() === f.name.toLowerCase(),
            );
            return match ? { ...f, xHandle: match.xHandle } : f;
          });
          if (added.length > 0 || upgraded.some((f, i) => f !== (existing.founders ?? [])[i])) {
            patch.founders = [...upgraded, ...added].slice(0, 6);
          }
        }
        if (!existing.announcementTweetId && d.tweetId) patch.announcementTweetId = d.tweetId;
        if (!existing.announcedAt && d.announcedAt) patch.announcedAt = d.announcedAt;
        if (d.confidence > existing.confidence) {
          patch.confidence = d.confidence;
          patch.category = d.category;
          patch.isConsumer = d.isConsumer;
        }
        if (!existing.sources.some((s) => s.url === d.sourceUrl)) {
          patch.sources = [
            ...existing.sources,
            { name: d.sourceName, url: d.sourceUrl },
          ].slice(0, 10);
        }
        await ctx.db.patch(existing._id, patch);
        merged++;
        continue;
      }

      const id = await ctx.db.insert("deals", {
        company: d.company,
        companyKey,
        round: d.round,
        dedupKey,
        amountUsd: d.amountUsd,
        amountNote: d.amountNote,
        investors: d.investors.slice(0, 20),
        leadInvestor: d.leadInvestor,
        category: d.category,
        isConsumer: d.isConsumer,
        confidence: d.confidence,
        summary: d.summary,
        companyDesc: d.companyDesc,
        leadDesc: d.leadDesc,
        founders: d.founders?.length ? d.founders.slice(0, 6) : undefined,
        hqCountry: d.hqCountry,
        website: d.website,
        valuationUsd: d.valuationUsd,
        totalRaisedUsd: d.totalRaisedUsd,
        sources: [{ name: d.sourceName, url: d.sourceUrl }],
        announcementTweetId: d.tweetId,
        status: "new",
        notified: false,
        announcedAt: d.announcedAt,
        firstSeenAt: now,
        lastSeenAt: now,
      });
      inserted++;
      if (d.isConsumer) {
        newConsumer.push({
          id,
          company: d.company,
          round: d.round,
          amountUsd: d.amountUsd,
          amountNote: d.amountNote,
          leadInvestor: d.leadInvestor,
          category: d.category,
          summary: d.summary,
          link: d.sourceUrl,
          tweetId: d.tweetId,
          announcedAt: d.announcedAt,
        });
      }
    }
    return { inserted, merged, newConsumer };
  },
});

/** Internal: consumer deals still awaiting a Telegram push (overnight flush). */
export const unnotifiedConsumerInternal = internalQuery({
  args: { sinceMs: v.number() },
  returns: v.array(newConsumerRow),
  handler: async (ctx, { sinceMs }) => {
    const rows = await ctx.db
      .query("deals")
      .withIndex("by_isConsumer_firstSeenAt", (q) =>
        q.eq("isConsumer", true).gt("firstSeenAt", sinceMs),
      )
      .take(100);
    return rows
      .filter((r) => !r.notified && r.status === "new")
      .map((r) => ({
        id: r._id,
        company: r.company,
        round: r.round,
        amountUsd: r.amountUsd,
        amountNote: r.amountNote,
        leadInvestor: r.leadInvestor,
        category: r.category,
        summary: r.summary,
        link: r.sources[0]?.url ?? "",
        tweetId: r.announcementTweetId,
        announcedAt: r.announcedAt,
      }));
  },
});

/** Internal: recent deals still missing descriptions (enrichment targets). */
export const missingDescInternal = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("deals"),
      company: v.string(),
      summary: v.string(),
      leadInvestor: v.optional(v.string()),
      category: v.string(),
      needsCompany: v.boolean(),
      needsLead: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const sinceMs = Date.now() - 14 * 86_400_000;
    const rows = await ctx.db
      .query("deals")
      .withIndex("by_firstSeenAt", (q) => q.gt("firstSeenAt", sinceMs))
      .take(400);
    return rows
      .filter((r) => !r.companyDesc || (r.leadInvestor && !r.leadDesc))
      .slice(0, 25)
      .map((r) => ({
        id: r._id,
        company: r.company,
        summary: r.summary,
        leadInvestor: r.leadInvestor,
        category: r.category,
        needsCompany: !r.companyDesc,
        needsLead: !!r.leadInvestor && !r.leadDesc,
      }));
  },
});

export const applyEnrichment = internalMutation({
  args: {
    rows: v.array(
      v.object({
        id: v.id("deals"),
        companyDesc: v.optional(v.string()),
        leadDesc: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { rows }) => {
    for (const row of rows.slice(0, 50)) {
      const patch: Partial<Doc<"deals">> = {};
      if (row.companyDesc) patch.companyDesc = row.companyDesc.slice(0, 140);
      if (row.leadDesc) patch.leadDesc = row.leadDesc.slice(0, 140);
      if (Object.keys(patch).length > 0) await ctx.db.patch(row.id, patch);
    }
    return null;
  },
});

export const markNotified = internalMutation({
  args: { ids: v.array(v.id("deals")) },
  returns: v.null(),
  handler: async (ctx, { ids }) => {
    for (const id of ids.slice(0, 100)) {
      await ctx.db.patch(id, { notified: true });
    }
    return null;
  },
});

/** Subscriber: deals for the Deals tab, newest-announced first (filters are
 * client-side). `days` bounds by announcement/first-seen recency; 0 = all. */
/**
 * Public read for the /deals page: the deal dataset minus the operator-only
 * surface (status/notified triage, confidence, deep-dive reports).
 */
export const publicList = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("deals")
      .withIndex("by_firstSeenAt")
      .order("desc")
      .take(1000);
    // Dismissed rows are triaged noise — they never reach the public page.
    return rows.filter((d) => d.status !== "dismissed").map((d) => ({
      id: d._id,
      company: d.company,
      round: d.round,
      amountUsd: d.amountUsd,
      amountNote: d.amountNote,
      investors: d.investors,
      leadInvestor: d.leadInvestor,
      category: d.category,
      isConsumer: d.isConsumer,
      summary: d.summary,
      companyDesc: d.companyDesc,
      leadDesc: d.leadDesc,
      founders: d.founders,
      hqCountry: d.hqCountry,
      website: d.website,
      valuationUsd: d.valuationUsd,
      totalRaisedUsd: d.totalRaisedUsd,
      sources: d.sources,
      announcedAt: d.announcedAt ?? d.firstSeenAt,
    }));
  },
});

export const list = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    await requireSubscriber(ctx);
    const d = days ?? 14;
    const sinceMs = d > 0 ? Date.now() - d * 86_400_000 : 0;
    const rows = await ctx.db
      .query("deals")
      .withIndex("by_firstSeenAt", (q) => q.gt("firstSeenAt", sinceMs))
      .order("desc")
      .take(1000);
    // Backfilled deals arrive with old announcedAt but fresh firstSeenAt —
    // order by when the deal actually happened.
    return rows.sort(
      (a, b) => (b.announcedAt ?? b.firstSeenAt) - (a.announcedAt ?? a.firstSeenAt),
    );
  },
});

/**
 * Admin: correct a mis-extracted company name. Recomputes the dedup keys so
 * future tellings merge under the corrected name; if a row for the corrected
 * (company, round) already exists, the two rows merge (sources/investors
 * unioned, earliest firstSeenAt kept) and this row is deleted.
 */
export const rename = mutation({
  args: { id: v.id("deals"), company: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, company }) => {
    await requireAdmin(ctx);
    const name = company.trim();
    if (!name) throw new Error("Company name is required.");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Deal not found.");

    const companyKey = normalizeCompanyKey(name);
    if (!companyKey) throw new Error("Name normalizes to nothing.");
    const dedupKey = `${companyKey}|${row.round}`;

    const collision = await ctx.db
      .query("deals")
      .withIndex("by_dedupKey", (q) => q.eq("dedupKey", dedupKey))
      .first();

    if (collision && collision._id !== id) {
      // The corrected name reveals this was a duplicate — fold into the other row.
      const mergedSources = [...collision.sources];
      for (const s of row.sources) {
        if (!mergedSources.some((m) => m.url === s.url)) mergedSources.push(s);
      }
      await ctx.db.patch(collision._id, {
        investors: unionInvestors(collision.investors, row.investors),
        sources: mergedSources.slice(0, 10),
        amountUsd: collision.amountUsd ?? row.amountUsd,
        amountNote: collision.amountNote ?? row.amountNote,
        leadInvestor: collision.leadInvestor ?? row.leadInvestor,
        companyDesc: collision.companyDesc ?? row.companyDesc,
        leadDesc: collision.leadDesc ?? row.leadDesc,
        announcementTweetId: collision.announcementTweetId ?? row.announcementTweetId,
        announcedAt: collision.announcedAt ?? row.announcedAt,
        firstSeenAt: Math.min(collision.firstSeenAt, row.firstSeenAt),
        lastSeenAt: Math.max(collision.lastSeenAt, row.lastSeenAt),
      });
      await ctx.db.delete(id);
      return null;
    }

    await ctx.db.patch(id, { company: name, companyKey, dedupKey });
    return null;
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("deals"),
    status: v.union(v.literal("new"), v.literal("seen"), v.literal("dismissed")),
  },
  returns: v.null(),
  handler: async (ctx, { id, status }) => {
    await requireSubscriber(ctx);
    await ctx.db.patch(id, { status });
    return null;
  },
});

/** "Caught up" — every `new` deal becomes `seen`. */
export const markAllSeen = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const sinceMs = Date.now() - 30 * 86_400_000;
    const rows = await ctx.db
      .query("deals")
      .withIndex("by_firstSeenAt", (q) => q.gt("firstSeenAt", sinceMs))
      .take(400);
    let n = 0;
    for (const r of rows) {
      if (r.status === "new") {
        await ctx.db.patch(r._id, { status: "seen" });
        n++;
      }
    }
    return n;
  },
});

/** Retention: extraction markers past 14d only — deals themselves are kept forever. */
export const prune = internalMutation({
  args: {},
  returns: v.object({ seenDeleted: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const oldSeen = await ctx.db
      .query("dealSeen")
      .withIndex("by_createdAt", (q) =>
        q.lt("createdAt", now - SEEN_RETENTION_DAYS * 86_400_000),
      )
      .take(1000);
    for (const r of oldSeen) await ctx.db.delete(r._id);
    return { seenDeleted: oldSeen.length };
  },
});

// ---- AI deep dive -----------------------------------------------------------
// Admin-triggered per-deal research report: Claude (Opus) with server-side web
// search, stored as markdown on the deal row. The Deals tab renders it in the
// expanded panel; status updates flow reactively through deals.list.

/**
 * Maintenance (CLI): rename mis-extracted rows and dismiss unnamed noise.
 *   npx convex run deals:cleanupInternal '{"renames":[{"id":"...","company":"Auger"}],"dismissIds":["..."]}' --prod
 * Renames reuse the same fold-into-duplicate logic as the admin rename.
 */
export const cleanupInternal = internalMutation({
  args: {
    renames: v.optional(
      v.array(v.object({ id: v.id("deals"), company: v.string() })),
    ),
    dismissIds: v.optional(v.array(v.id("deals"))),
  },
  returns: v.object({ renamed: v.number(), dismissed: v.number() }),
  handler: async (ctx, { renames, dismissIds }) => {
    let renamed = 0;
    for (const r of renames ?? []) {
      const row = await ctx.db.get(r.id);
      if (!row) continue;
      const companyKey = normalizeCompanyKey(r.company);
      if (!companyKey) continue;
      const dedupKey = `${companyKey}|${row.round}`;
      const collision = await ctx.db
        .query("deals")
        .withIndex("by_dedupKey", (q) => q.eq("dedupKey", dedupKey))
        .first();
      if (collision && collision._id !== r.id) {
        const mergedSources = [...collision.sources];
        for (const s of row.sources) {
          if (!mergedSources.some((m) => m.url === s.url)) mergedSources.push(s);
        }
        await ctx.db.patch(collision._id, {
          investors: unionInvestors(collision.investors, row.investors),
          sources: mergedSources.slice(0, 10),
        });
        await ctx.db.delete(r.id);
      } else {
        await ctx.db.patch(r.id, { company: r.company, companyKey, dedupKey });
      }
      renamed++;
    }
    let dismissed = 0;
    for (const id of dismissIds ?? []) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      await ctx.db.patch(id, { status: "dismissed" });
      dismissed++;
    }
    return { renamed, dismissed };
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

export const getInternal = internalQuery({
  args: { id: v.id("deals") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const setDeepDive = internalMutation({
  args: {
    id: v.id("deals"),
    status: v.union(v.literal("running"), v.literal("ok"), v.literal("error")),
    report: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, status, report, error }) => {
    await ctx.db.patch(id, {
      deepDiveStatus: status,
      ...(report !== undefined ? { deepDive: report, deepDiveAt: Date.now() } : {}),
      deepDiveError: status === "error" ? error : undefined,
    });
    return null;
  },
});

const DEEP_DIVE_SYSTEM = `You are a sharp venture analyst writing a company deep-dive for an investor/operator who just spotted this funding round on their deal radar. Research the company with web search, then write a markdown report.

Structure (use ### headings, skip a section if nothing substantive was found):
### What they do — product, business model, who pays
### Founders & team — backgrounds, prior companies, notable hires
### The round — amount, lead, notable angels, prior funding history, valuation if reported
### Market & competition — how big, who else, what's the wedge
### Traction & signals — revenue/users/growth if reported, launch dates, press
### Take — 2-3 sentences: why this is interesting, and the biggest risk

Rules: ~500-800 words total. Ground every claim in what you found — inline-link sources as [name](url). If searches contradict each other or info is thin, say so plainly rather than padding. No preamble before the first heading.`;

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

async function runDeepDive(key: string, deal: Doc<"deals">): Promise<string> {
  const amount =
    deal.amountUsd != null
      ? `$${(deal.amountUsd / 1_000_000).toFixed(1)}M`
      : (deal.amountNote ?? "undisclosed");
  const facts = [
    `Company: ${deal.company}`,
    deal.companyDesc ? `Known description: ${deal.companyDesc}` : "",
    `Round: ${deal.round}, ${amount}${deal.leadInvestor ? `, led by ${deal.leadInvestor}` : ""}`,
    deal.investors.length ? `Investors: ${deal.investors.join(", ")}` : "",
    `Category: ${deal.category}`,
    `Radar summary: ${deal.summary}`,
    deal.announcedAt
      ? `Announced: ${new Date(deal.announcedAt).toISOString().slice(0, 10)}`
      : "",
    deal.sources.length
      ? `Known coverage:\n${deal.sources.map((s) => `- ${s.name}: ${s.url}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: { role: string; content: string | AnthropicContentBlock[] }[] = [
    { role: "user", content: `Deep-dive this deal:\n\n${facts}` },
  ];

  // Server-side web search runs in a server loop that can pause (stop_reason
  // "pause_turn") — re-send the conversation to resume, bounded.
  for (let round = 0; round < 4; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        system: DEEP_DIVE_SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
        messages,
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      content?: AnthropicContentBlock[];
      stop_reason?: string;
    };
    if (json.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: json.content ?? [] });
      continue;
    }
    const text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    if (!text) {
      throw new Error(`Deep dive came back empty (stop_reason=${json.stop_reason ?? "?"}).`);
    }
    return text;
  }
  throw new Error("Deep dive did not finish after 4 continuation rounds.");
}

/** Admin: research one deal with Claude + web search (takes ~1-2 min). */
export const deepDive = action({
  args: { id: v.id("deals") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { id }) => {
    await ctx.runQuery(internal.deals._assertAdmin, {});
    const deal: Doc<"deals"> | null = await ctx.runQuery(internal.deals.getInternal, {
      id,
    });
    if (!deal) throw new Error("Deal not found.");
    const key = process.env.anthropic_api_key;
    if (!key) throw new Error("anthropic_api_key is not set on this deployment.");

    await ctx.runMutation(internal.deals.setDeepDive, { id, status: "running" });
    try {
      const report = await runDeepDive(key, deal);
      await ctx.runMutation(internal.deals.setDeepDive, { id, status: "ok", report });
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.deals.setDeepDive, {
        id,
        status: "error",
        error: message.slice(0, 500),
      });
      throw new Error(`Deep dive failed: ${message}`);
    }
  },
});
