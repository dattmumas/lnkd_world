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
const MAX_PER_SOURCE = 20;
const MAX_CANDIDATES = 150; // ~all recent articles per column, ranked in full
const TWEET_TOP_N = 10; // only the top N ranked items get a drafted tweet
const HANDLES_PER_QUERY = 15;

const ON_LABEL =
  "On Label covers the business of health, longevity, and biotech — drug development, deals, clinical data, metabolic health/GLP-1s, peptides, and the science behind the longevity industry. The audience is founders, operators, scientists, and investors.";

interface FeedItem {
  kind: "article" | "post";
  title: string; // headline (article) or "" (post)
  text: string; // synopsis (article) or tweet text (post)
  link: string;
  source: string; // source name or @handle
  dateMs: number;
  image: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---- RSS parsing ----------------------------------------------------------

function extractImage(block: string): string {
  block = block.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  const pats = [
    /<media:content[^>]+url="([^"]+)"[^>]*(?:medium|type)="image/i,
    /<media:thumbnail[^>]+url="([^"]+)"/i,
    /<enclosure[^>]+url="([^"]+)"[^>]*type="image/i,
    /<media:content[^>]+url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
    /<img[^>]+src="([^"]+)"/i,
  ];
  for (const re of pats) {
    const m = block.match(re);
    if (m && /^https?:\/\//i.test(m[1])) return m[1].replace(/&amp;/g, "&");
  }
  return "";
}

function stripTags(s: string): string {
  return s.replace(/<\/?[a-zA-Z!][^>]*>/g, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function decode(s: string): string {
  let t = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  t = stripTags(t);
  t = decodeEntities(t);
  t = stripTags(t);
  return t.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

function parseFeed(xml: string, source: string): FeedItem[] {
  const blocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  const out: FeedItem[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    if (!title) continue;
    let link = tag(b, "link");
    if (!link) {
      const href = b.match(/<link[^>]*href="([^"]+)"/i);
      if (href) link = href[1];
    }
    const summary = tag(b, "description") || tag(b, "summary") || tag(b, "content");
    const dateStr =
      tag(b, "pubDate") || tag(b, "updated") || tag(b, "published") || tag(b, "dc:date");
    out.push({
      kind: "article",
      title,
      text: summary.slice(0, 400),
      link,
      source,
      dateMs: Date.parse(dateStr) || 0,
      image: extractImage(b),
    });
  }
  return out;
}

async function fetchSource(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "lnkd-world/1.0 (+https://lnkd.world)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

interface SourceHealth {
  url: string;
  name: string;
  ok: boolean;
  items: number; // recent items contributed
  error?: string;
}

// Gather recent RSS items across sources (one bad feed doesn't sink the rest),
// recording per-source health so /admin/sources can show what actually works.
async function gatherRss(
  sources: { name: string; url: string }[],
  nowMs: number,
  maxAge: number,
): Promise<{ items: FeedItem[]; health: SourceHealth[] }> {
  // Fetch all sources concurrently — one slow/dead feed no longer delays the rest.
  const results = await Promise.all(
    sources.map(async (s) => {
      try {
        const parsed = parseFeed(await fetchSource(s.url), s.name);
        const recent = parsed
          .filter((it) => !it.dateMs || nowMs - it.dateMs <= maxAge)
          .sort((a, b) => b.dateMs - a.dateMs)
          .slice(0, MAX_PER_SOURCE);
        const health: SourceHealth = { url: s.url, name: s.name, ok: true, items: recent.length };
        return { items: recent, health };
      } catch (err) {
        const msg = (err instanceof Error ? err.message : String(err)).slice(0, 80);
        console.error(`Source ${s.name} failed: ${msg}`);
        const health: SourceHealth = { url: s.url, name: s.name, ok: false, items: 0, error: msg };
        return { items: [] as FeedItem[], health };
      }
    }),
  );
  return {
    items: results.flatMap((r) => r.items),
    health: results.map((r) => r.health),
  };
}

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

function dedupe(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const it of items) {
    const k = it.link || it.title || it.text;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
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
  if (topic === "science") {
    return `You curate a "science news worth sharing" briefing. ${ON_LABEL}

Rank EVERY numbered item from most to least worth sharing to that audience on X. Rank highest the items that are surprising, debate-worthy, or genuinely important to the business/science of health & longevity; rank lowest generic wellness fluff, press-release filler, and off-topic items. Do not drop any item.`;
  }
  return `You curate a "biggest business news worth sharing" briefing for a sharp, general business audience on X. The items are a mix of news articles and posts from major business accounts.

Rank EVERY numbered item from most to least share-worthy. Rank highest major deals/M&A, market-moving events, big-company news, earnings, the economy, and major tech and finance developments; rank lowest opinion columns, minor updates, and duplicates of the same event. Do not drop any item.`;
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
  return out;
}

// ---- Render ---------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(dateMs: number): string {
  return dateMs
    ? new Date(dateMs).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
}

// Full rich card for the top-ranked items (these carry a drafted tweet).
function renderCard({ item, angle, tweet }: Picked, rank: number): string {
  const date = fmtDate(item.dateMs);
  const badge = `<span class="rank">${rank}</span>`;
  const angleBlock = angle
    ? `<div class="angle"><span class="angle-l">Why share</span>${esc(angle)}</div>`
    : "";
  const tweetBlock = tweet
    ? `<details class="tweet"><summary><span class="tweet-l">Draft tweet</span></summary><div class="tweet-b">${esc(tweet)}</div><button class="copy" data-copy="${esc(tweet)}">Copy</button></details>`
    : "";
  if (item.kind === "post") {
    return `<article class="card">
      ${badge}
      <div class="body">
        <div class="src">${esc(item.source)}${date ? " · " + esc(date) : ""}</div>
        <p class="ptext">${esc(item.text)}</p>
        ${angleBlock}${tweetBlock}
        <div class="foot"><a class="read" href="${esc(item.link)}" target="_blank" rel="noopener">View on X ↗</a></div>
      </div>
    </article>`;
  }
  const thumb = item.image
    ? `<img class="thumb" src="${esc(item.image)}" alt="" loading="lazy" onerror="this.remove()">`
    : "";
  const synopsis = item.text ? `<p class="synopsis">${esc(item.text)}</p>` : "";
  return `<article class="card">
    ${badge}
    ${thumb}
    <div class="body">
      <div class="src">${esc(item.source)}${date ? " · " + esc(date) : ""}</div>
      <h3 class="title"><a href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.title)}</a></h3>
      ${synopsis}${angleBlock}${tweetBlock}
      <div class="foot"><a class="read" href="${esc(item.link)}" target="_blank" rel="noopener">Read ↗</a></div>
    </div>
  </article>`;
}

// Compact one-line row for the long tail below the top-ranked items.
function renderRow({ item }: Picked, rank: number): string {
  const date = fmtDate(item.dateMs);
  const label = item.title || item.text.slice(0, 120);
  return `<a class="row" href="${esc(item.link)}" target="_blank" rel="noopener">
    <span class="rank rank-sm">${rank}</span>
    <span class="row-body">
      <span class="row-meta">${esc(item.source)}${date ? " · " + esc(date) : ""}</span>
      <span class="row-title">${esc(label)}</span>
    </span>
    <span class="row-arrow">↗</span>
  </a>`;
}

function renderNews(science: Picked[], business: Picked[], generatedAt: string): string {
  const when = new Date(generatedAt).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const total = science.length + business.length;
  const col = (cls: string, label: string, items: Picked[]) => {
    const heading = `<h2>${label} <span class="count">${items.length}</span></h2>`;
    if (items.length === 0) {
      return `<section class="col ${cls}">${heading}<p class="empty">Nothing cleared the bar.</p></section>`;
    }
    const top = items.slice(0, TWEET_TOP_N).map((p, i) => renderCard(p, i + 1)).join("\n");
    const rest = items.slice(TWEET_TOP_N);
    const more = rest.length
      ? `<div class="more">More</div>${rest
          .map((p, i) => renderRow(p, TWEET_TOP_N + i + 1))
          .join("\n")}`
      : "";
    return `<section class="col ${cls}">${heading}${top}${more}</section>`;
  };
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  :root{color-scheme:light}*{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#f7f8fa;line-height:1.5;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1040px;margin:0 auto;padding:26px 20px 64px}
  header{margin-bottom:18px}
  .eyebrow{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8}
  h1{font-size:25px;margin:5px 0 3px;letter-spacing:-.015em;font-weight:700}
  .sub{font-size:13px;color:#94a3b8}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}
  .col.sci{--acc:#059669}.col.biz{--acc:#2563eb}
  .col h2{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0f172a;margin:0 0 4px;padding-bottom:9px;border-bottom:2px solid var(--acc)}
  .count{font-size:11px;font-weight:700;letter-spacing:.02em;color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,#fff);border-radius:999px;padding:1px 8px}
  .empty{font-size:13px;color:#94a3b8}
  .rank{flex-shrink:0;align-self:flex-start;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-size:12px;font-weight:700;color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,#fff)}
  .card{display:flex;gap:13px;background:#fff;border:1px solid #e8eaee;border-radius:14px;padding:14px;margin:12px 0;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .thumb{width:104px;height:80px;flex-shrink:0;border-radius:10px;object-fit:cover;background:#eef2f6}
  .body{min-width:0;flex:1}
  .src{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#94a3b8;margin-bottom:5px}
  .title{margin:0 0 6px;font-size:15px;line-height:1.32;font-weight:700;letter-spacing:-.01em}
  .title a{color:#0f172a;text-decoration:none}.title a:hover{color:var(--acc)}
  .ptext{margin:0 0 8px;font-size:14px;color:#1e293b;line-height:1.5;white-space:pre-line;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
  .synopsis{margin:0 0 8px;font-size:13px;color:#52606d;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .angle{font-size:12.5px;color:#334155;background:#f1f5f9;border-radius:9px;padding:8px 11px;margin:9px 0}
  .angle-l{display:block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--acc);margin-bottom:3px}
  details.tweet{margin-top:9px;background:#fafbfc;border:1px solid #e8eaee;border-radius:11px;padding:8px 12px}
  details.tweet summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px}
  details.tweet summary::-webkit-details-marker{display:none}
  details.tweet summary::before{content:"▸";color:#94a3b8;font-size:10px;transition:transform .15s}
  details.tweet[open] summary::before{transform:rotate(90deg)}
  .tweet-l{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8}
  .tweet-b{white-space:pre-line;font-size:13px;color:#1e293b;line-height:1.5;margin-top:8px}
  button.copy{appearance:none;border:1px solid #d8dde3;background:#fff;color:#0f172a;font-size:11px;font-weight:600;padding:4px 10px;border-radius:7px;cursor:pointer;margin-top:8px}
  button.copy:hover{background:#f1f5f9}
  .more{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin:18px 0 2px;padding-top:10px;border-top:1px dashed #d8dde3}
  .row{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid #eef1f4;text-decoration:none;color:inherit}
  .row:hover{background:#fbfcfd}
  .rank-sm{width:20px;height:20px;font-size:11px;background:transparent;color:#94a3b8}
  .row-body{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
  .row-meta{font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#94a3b8}
  .row-title{font-size:13px;font-weight:600;line-height:1.3;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row:hover .row-title{color:var(--acc)}
  .row-arrow{flex-shrink:0;font-size:12px;color:#94a3b8}
  .foot{margin-top:9px}
  .read{font-size:12.5px;font-weight:600;color:var(--acc);text-decoration:none}.read:hover{text-decoration:underline}
  footer{margin-top:28px;font-size:12px;color:#94a3b8;border-top:1px solid #e8eaee;padding-top:16px}
  @media(max-width:780px){.cols{grid-template-columns:1fr}}
  </style></head><body><div class="wrap">
  <header><div class="eyebrow">On Label · Daily</div><h1>Science &amp; Business</h1><div class="sub">${esc(when)} · ${total} stories ranked by importance</div></header>
  <div class="cols">
    ${col("sci", "Science", science)}
    ${col("biz", "Business", business)}
  </div>
  <footer>All recent articles from your RSS sources and business X accounts, ranked by importance by Sonnet 4.6. Suggested tweets are drafts — nothing is posted.</footer>
  </div>
  <script>document.addEventListener('click',function(e){var b=e.target.closest('button.copy');if(!b)return;var t=b.getAttribute('data-copy')||'';function ok(){var p=b.textContent;b.textContent='Copied!';setTimeout(function(){b.textContent=p;},1500);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok).catch(ok);}else{ok();}});</script>
  </body></html>`;
}

// ---- Action / storage -----------------------------------------------------

// Map a column's top ranked picks (the ones with drafted tweets) to unified-queue
// payloads (convex/feedItems.ts). X posts in the business blend become "x-post"
// items keyed by tweet ID so they dedup against the other feeds.
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

      const html = renderNews(science, business, generatedAt);
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
      throw new Error(`News feed refresh failed: ${message}`);
    }
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
    const old = await ctx.db.query("feedHealth").collect();
    for (const r of old) await ctx.db.delete(r._id);
    await ctx.db.insert("feedHealth", args);
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
