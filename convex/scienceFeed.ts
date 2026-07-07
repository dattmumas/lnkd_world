import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import { gxSearch } from "./lib/getxapi";
import { reportCron } from "./lib/cronReport";
import { gatherRss, dedupe, type FeedItem } from "./lib/rss";
import {
  newsBaseScore,
  externalIdFor,
  tweetIdFromLink,
  HALF_LIFE_HOURS,
  type QueueItemPayload,
} from "./lib/queueScore";

/**
 * Combined news briefing rendered as TWO side-by-side columns (served at "science"):
 *  - Science: stories worth sharing combed from the health/longevity/biotech RSS
 *    sources (convex/newsSources.ts).
 *  - Business: the biggest business news, blended from general-business RSS
 *    (convex/bizSources.ts) and posts from business X accounts (convex/bizAccounts.ts).
 * Every recent article in each column is ranked by importance by Sonnet 4.6
 * (best-first) with a one-line angle; the top few also get a suggested tweet.
 * Rendered to HTML stored in `scienceSnapshots`.
 */

const SCI_WINDOW_DAYS = 5;
const BIZ_WINDOW_DAYS = 3; // business moves fast
const SCI_MAX_AGE_MS = SCI_WINDOW_DAYS * 24 * 3600 * 1000;
const BIZ_MAX_AGE_MS = BIZ_WINDOW_DAYS * 24 * 3600 * 1000;
const MAX_CANDIDATES = 150; // ~all recent articles per column, ranked in full
const TWEET_TOP_N = 10; // only the top N ranked items get a drafted tweet
const HANDLES_PER_QUERY = 15;

const ON_LABEL =
  "On Label covers the business of health, longevity, and biotech — drug development, deals, clinical data, metabolic health/GLP-1s, peptides, and the science behind the longevity industry. The audience is founders, operators, scientists, and investors.";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// RSS parsing/gathering lives in lib/rss.ts (shared with the deal radar).
// Default options preserve this feed's original behavior exactly.

// Posts from the business X accounts (getXAPI), as FeedItems.
async function fetchPosts(handles: string[]): Promise<FeedItem[]> {
  const out: FeedItem[] = [];
  for (const group of chunk(handles, HANDLES_PER_QUERY)) {
    const q = `(${group.map((h) => `from:${h}`).join(" OR ")}) -is:retweet -is:reply lang:en`;
    try {
      const { tweets, users } = await gxSearch(q, {
        product: "Top",
        maxAgeMs: BIZ_MAX_AGE_MS,
        maxTweets: 60,
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      for (const t of tweets) {
        const u = byId.get(t.author_id);
        out.push({
          kind: "post",
          title: "",
          text: t.text,
          link: u
            ? `https://x.com/${u.username}/status/${t.id}`
            : `https://x.com/i/status/${t.id}`,
          source: u ? "@" + u.username : "X",
          dateMs: Date.parse(t.created_at) || 0,
          image: "",
        });
      }
    } catch (err) {
      console.error(`Business posts query failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

// ---- Curation -------------------------------------------------------------

interface TopPick {
  n: number;
  angle: string;
  tweet: string;
}
interface RankResult {
  order: number[]; // every item index, most important first
  top: TopPick[]; // angle + tweet for the top TWEET_TOP_N only
}
interface Picked {
  item: FeedItem;
  angle: string;
  tweet: string;
}

function prompt(topic: "science" | "business"): string {
  // Several outlets covering one story must not fill the top of the briefing —
  // exactly one telling ranks on merit, the rest sink.
  const dedupe = `CRITICAL — one story, one slot: when several items cover the SAME story or event (different outlets, same news), rank ONLY the single best-reported item on its merits and place every other telling of that story in the bottom third. The top ${TWEET_TOP_N} positions must be ${TWEET_TOP_N} DIFFERENT stories.`;
  if (topic === "science") {
    return `You curate a "science news worth sharing" briefing. ${ON_LABEL}

Rank EVERY numbered item from most to least worth sharing to that audience on X. Rank highest the items that are surprising, debate-worthy, or genuinely important to the business/science of health & longevity; rank lowest generic wellness fluff, press-release filler, and off-topic items. Do not drop any item.

${dedupe}`;
  }
  return `You curate a "biggest business news worth sharing" briefing for a sharp, general business audience on X. The items are a mix of news articles and posts from major business accounts.

Rank EVERY numbered item from most to least share-worthy. Rank highest major deals/M&A, market-moving events, big-company news, earnings, the economy, and major tech and finance developments; rank lowest opinion columns and minor updates. Do not drop any item.

${dedupe}`;
}

// Ask the model for a full importance ordering (just index numbers — cheap to
// emit even for 150 items) plus an angle + tweet for only the top few. Prose for
// the long tail isn't rendered (compact rows show none), so we don't pay to
// generate it — this keeps the call fast enough to run on every refresh.
async function rank(items: FeedItem[], topic: "science" | "business"): Promise<RankResult | null> {
  const key = process.env.anthropic_api_key;
  if (!key || items.length === 0) return null;
  const list = items
    .map((it, i) => `[${i}] (${it.source}) ${it.title || it.text.slice(0, 140)}\n${it.text.slice(0, 300)}`)
    .join("\n\n");
  const system = `${prompt(topic)}

Return ONLY a JSON object, no prose:
{"order": [<every item number, most important first>], "top": [{"n": <item number>, "angle": "<one short line on why it's worth sharing>", "tweet": "<casual, punchy tweet, 2-4 short lines, no hashtags, no em-dashes>"}]}
"order" must list all ${items.length} item numbers exactly once. "top" gives an angle + tweet for ONLY the ${TWEET_TOP_N} most important items (the first ${TWEET_TOP_N} of "order").`;

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
        max_tokens: 6000,
        thinking: { type: "disabled" },
        system,
        messages: [{ role: "user", content: list }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<RankResult>;
    const order = (parsed.order ?? []).filter((n) => typeof n === "number" && items[n]);
    if (order.length === 0) return null;
    const top = (parsed.top ?? []).filter((t) => typeof t?.n === "number" && items[t.n]);
    return { order, top };
  } catch (e) {
    console.error(`Rank (${topic}) failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "after", "over", "into",
  "amid", "says", "said", "will", "could", "would", "than", "have", "has",
  "are", "was", "were", "been", "its", "his", "her", "their", "your", "new",
  "how", "why", "what", "who", "more", "most", "just", "about", "as", "to",
]);

// Significant title tokens for duplicate detection (entities survive, filler doesn't).
function storyTokens(it: FeedItem): Set<string> {
  const text = `${it.title ?? ""} ${it.text.slice(0, 120)}`.toLowerCase();
  return new Set(
    (text.match(/[a-z0-9$%-]{3,}/g) ?? []).filter((w) => !STOPWORDS.has(w)),
  );
}

// Same story? Jaccard similarity over significant tokens — different outlets
// reuse the entities ("fda", "orca", "approval") even when headlines differ.
function sameStory(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const jaccard = shared / (a.size + b.size - shared);
  return shared >= 3 && jaccard >= 0.4;
}

/**
 * Deterministic dedup safety net (the ranking prompt asks for one-story-one-slot,
 * but a big story can still sweep the top): walk the ranked list and demote any
 * item that reads like a story already kept above it. Demoted tellings drop to
 * the tail, so the top of the page is always distinct stories.
 */
function demoteDuplicates(ordered: Picked[]): Picked[] {
  const kept: Picked[] = [];
  const keptTokens: Set<string>[] = [];
  const dupes: Picked[] = [];
  for (const p of ordered) {
    const tokens = storyTokens(p.item);
    if (keptTokens.some((k) => sameStory(k, tokens))) {
      dupes.push(p);
    } else {
      kept.push(p);
      keptTokens.push(tokens);
    }
  }
  if (dupes.length > 0) {
    console.log(
      `scienceFeed dedup: demoted ${dupes.length} duplicate tellings (e.g. "${(dupes[0].item.title ?? dupes[0].item.text).slice(0, 60)}")`,
    );
  }
  return [...kept, ...dupes];
}

// Order all candidates best-first from the model's ranking, attaching angle +
// tweet to the top items. Any indices the model omits are appended in date order
// so nothing is dropped; on failure everything shows in date order.
async function pick(candidates: FeedItem[], topic: "science" | "business"): Promise<Picked[]> {
  const ranked = await rank(candidates, topic);
  if (!ranked) {
    return candidates.map((item) => ({ item, angle: "", tweet: "" }));
  }
  const extras = new Map<number, { angle: string; tweet: string }>();
  for (const t of ranked.top) {
    extras.set(t.n, { angle: t.angle ?? "", tweet: t.tweet ?? "" });
  }
  const used = new Set<number>();
  const out: Picked[] = [];
  for (const n of ranked.order) {
    if (used.has(n)) continue;
    used.add(n);
    const extra = extras.get(n);
    out.push({ item: candidates[n], angle: extra?.angle ?? "", tweet: extra?.tweet ?? "" });
  }
  candidates.forEach((item, i) => {
    if (!used.has(i)) out.push({ item, angle: "", tweet: "" });
  });
  return demoteDuplicates(out);
}

// ---- Render ---------------------------------------------------------------

// (HTML renderers removed 2026-07-05 — the feed page is gone; snapshots
// carry status/health only and the queue is the sole consumer.)

function queueItems(picks: Picked[], feed: "science" | "biz"): QueueItemPayload[] {
  const label = feed === "science" ? "science" : "business";
  return picks.slice(0, TWEET_TOP_N).map((p, i) => {
    const tweetId = p.item.kind === "post" ? tweetIdFromLink(p.item.link) : null;
    const kind = tweetId ? ("x-post" as const) : ("article" as const);
    return {
      kind,
      externalId: tweetId
        ? externalIdFor("x-post", tweetId)
        : externalIdFor("article", p.item.link),
      feed,
      title: p.item.title || undefined,
      text: p.item.text || p.item.title,
      link: p.item.link,
      imageUrl: p.item.image || undefined,
      source: p.item.source,
      authorUsername: p.item.source.startsWith("@")
        ? p.item.source.slice(1).toLowerCase()
        : undefined,
      draft: p.tweet || undefined,
      draftKind: p.tweet ? ("post" as const) : undefined,
      angle: p.angle || undefined,
      baseScore: newsBaseScore(i + 1),
      halfLifeHours: HALF_LIFE_HOURS[feed],
      scoreReason: `#${i + 1} in today's ${label} ranking`,
      publishedAt: p.item.dateMs || 0,
    };
  });
}

export const refreshInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const generatedAt = new Date().toISOString();
    const nowMs = Date.now();
    try {
      const sciSources: { name: string; url: string }[] = await ctx.runQuery(
        internal.newsSources.activeSources,
        {},
      );
      const bizSources: { name: string; url: string }[] = await ctx.runQuery(
        internal.bizSources.activeSources,
        {},
      );
      const bizHandles: string[] = await ctx.runQuery(internal.bizAccounts.activeHandles, {});

      const sci = await gatherRss(sciSources, nowMs, SCI_MAX_AGE_MS);
      const biz = await gatherRss(bizSources, nowMs, BIZ_MAX_AGE_MS);
      const bizPosts = bizHandles.length ? await fetchPosts(bizHandles) : [];

      const sciCandidates = dedupe(sci.items)
        .sort((a, b) => b.dateMs - a.dateMs)
        .slice(0, MAX_CANDIDATES);
      const bizCandidates = dedupe([...biz.items, ...bizPosts])
        .sort((a, b) => b.dateMs - a.dateMs)
        .slice(0, MAX_CANDIDATES);

      const science = await pick(sciCandidates, "science");
      const business = await pick(bizCandidates, "business");

      // Per-source / per-account health, so /admin/sources can show what works.
      const sources: Record<string, { name: string; ok: boolean; items: number; error?: string }> = {};
      for (const h of [...sci.health, ...biz.health]) {
        sources[h.url] = { name: h.name, ok: h.ok, items: h.items, error: h.error };
      }
      const accounts: Record<string, number> = {};
      for (const p of bizPosts) {
        const k = p.source.replace(/^@/, "").toLowerCase();
        accounts[k] = (accounts[k] ?? 0) + 1;
      }
      await ctx.runMutation(internal.scienceFeed.storeHealth, {
        data: JSON.stringify({ checkedAt: generatedAt, sources, accounts }),
        checkedAt: generatedAt,
      });

      const html = ""; // feed page removed — snapshot is status/health only
      const count = science.length + business.length;
      const status = count > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.scienceFeed.store, { generatedAt, html, status, count });
      // Emit the top-ranked items of each column into the unified queue
      // (best-effort — never sinks the feed). The tab keeps the full ~150-row
      // ranking; the queue only wants the take-worthy top.
      try {
        await ctx.runMutation(internal.feedItems.upsertBatch, {
          items: [
            ...queueItems(science, "science"),
            ...queueItems(business, "biz"),
          ],
        });
      } catch (err) {
        console.error(
          `News queue emit failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await reportCron(ctx, "science-feed", true, `count=${count}`);
      return { status, count };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.scienceFeed.store, {
        generatedAt,
        html: "",
        status: "error",
        count: 0,
        error: message,
      });
      await reportCron(ctx, "science-feed", false, message);
      throw new Error(`News feed refresh failed: ${message}`);
    }
  },
});

/** Diagnostics: snapshot metadata without the megabyte html payloads. */
export const latestMeta = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("scienceSnapshots")
      .withIndex("by_createdAt")
      .order("desc")
      .take(5);
    return rows.map((r) => ({
      createdAt: r.createdAt,
      generatedAt: r.generatedAt,
      status: r.status,
      count: r.count,
      htmlLen: r.html.length,
      error: r.error ?? null,
    }));
  },
});

export const store = internalMutation({
  args: {
    generatedAt: v.string(),
    html: v.string(),
    status: v.string(),
    count: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Keep the last 3 snapshots, but never prune the most recent "ok" one —
    // getPage serves the latest ok, so a run of failed refreshes must not delete it.
    const all = await ctx.db
      .query("scienceSnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    const latestOkId = [...all].reverse().find((s) => s.status === "ok")?._id;
    for (const snap of all
      .slice(0, Math.max(0, all.length - 3))
      .filter((s) => s._id !== latestOkId)) {
      await ctx.db.delete(snap._id);
    }
    return await ctx.db.insert("scienceSnapshots", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});

/** Replace the single feed-health record with the latest run's results. */
export const storeHealth = internalMutation({
  args: { data: v.string(), checkedAt: v.string() },
  handler: async (ctx, args) => {
    // Merge source/account keys instead of replacing the row — the deal radar
    // (convex/dealsFeed.ts) reports into the same JSON, and each pipeline must
    // not wipe the other's badges between runs.
    const old = await ctx.db.query("feedHealth").collect();
    let merged = args.data;
    try {
      const incoming = JSON.parse(args.data);
      const prev = old[0] ? JSON.parse(old[0].data) : {};
      merged = JSON.stringify({
        checkedAt: incoming.checkedAt ?? args.checkedAt,
        sources: { ...(prev.sources ?? {}), ...(incoming.sources ?? {}) },
        accounts: { ...(prev.accounts ?? {}), ...(incoming.accounts ?? {}) },
      });
    } catch {
      // unparseable — fall back to replace
    }
    for (const r of old) await ctx.db.delete(r._id);
    await ctx.db.insert("feedHealth", { data: merged, checkedAt: args.checkedAt });
  },
});

/** Admin: latest per-source health JSON (or null before the first run). */
export const getHealth = query({
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("feedHealth")
      .withIndex("by_checkedAt")
      .order("desc")
      .first();
    return row?.data ?? null;
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

/** Admin-only manual refresh (the cron handles the daily run). */
export const refresh = action({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const _admin: null = await ctx.runQuery(internal.scienceFeed._assertAdmin, {});
    const result: { status: string; count: number } = await ctx.runAction(
      internal.scienceFeed.refreshInternal,
      {},
    );
    return { ok: true, status: result.status, count: result.count };
  },
});
