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

/**
 * Combined news briefing rendered as TWO side-by-side columns (served at "science"):
 *  - Science: stories worth sharing combed from the health/longevity/biotech RSS
 *    sources (convex/newsSources.ts).
 *  - Business: the biggest business news, blended from general-business RSS
 *    (convex/bizSources.ts) and posts from business X accounts (convex/bizAccounts.ts).
 * Each column is curated by Opus 4.8 with a one-line angle + a suggested tweet.
 * Rendered to HTML stored in `scienceSnapshots`.
 */

const SCI_WINDOW_DAYS = 5;
const BIZ_WINDOW_DAYS = 3; // business moves fast
const SCI_MAX_AGE_MS = SCI_WINDOW_DAYS * 24 * 3600 * 1000;
const BIZ_MAX_AGE_MS = BIZ_WINDOW_DAYS * 24 * 3600 * 1000;
const MAX_PER_SOURCE = 12;
const MAX_CANDIDATES = 45;
const FINAL_COUNT = 10; // per column
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
  const items: FeedItem[] = [];
  const health: SourceHealth[] = [];
  for (const s of sources) {
    try {
      const parsed = parseFeed(await fetchSource(s.url), s.name);
      const recent = parsed
        .filter((it) => !it.dateMs || nowMs - it.dateMs <= maxAge)
        .sort((a, b) => b.dateMs - a.dateMs)
        .slice(0, MAX_PER_SOURCE);
      items.push(...recent);
      health.push({ url: s.url, name: s.name, ok: true, items: recent.length });
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 80);
      console.error(`Source ${s.name} failed: ${msg}`);
      health.push({ url: s.url, name: s.name, ok: false, items: 0, error: msg });
    }
  }
  return { items, health };
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

interface Curated {
  n: number;
  angle: string;
  tweet: string;
}
interface Picked {
  item: FeedItem;
  angle: string;
  tweet: string;
}

function prompt(topic: "science" | "business"): string {
  if (topic === "science") {
    return `You curate a "science news worth sharing" briefing. ${ON_LABEL}

From the numbered items pick the ${FINAL_COUNT} most worth sharing to that audience on X — surprising, debate-worthy, or genuinely important to the business/science of health & longevity. Skip generic wellness fluff, press-release filler, and off-topic items.`;
  }
  return `You curate a "biggest business news worth sharing" briefing for a sharp, general business audience on X. The items are a mix of news articles and posts from major business accounts.

From the numbered items pick the ${FINAL_COUNT} biggest, most share-worthy business stories — major deals/M&A, market-moving events, big-company news, earnings, the economy, major tech and finance developments. Skip opinion columns, minor updates, and duplicates of the same event.`;
}

async function curate(items: FeedItem[], topic: "science" | "business"): Promise<Curated[]> {
  const key = process.env.anthropic_api_key;
  if (!key || items.length === 0) return [];
  const list = items
    .map((it, i) => `[${i}] (${it.source}) ${it.title || it.text.slice(0, 140)}\n${it.text.slice(0, 300)}`)
    .join("\n\n");
  const system = `${prompt(topic)}

Return ONLY a JSON array, no prose:
[{"n": <item number>, "angle": "<one short line on why it's worth sharing>", "tweet": "<a casual, punchy suggested tweet, 2-4 short lines, no hashtags, no em-dashes>"}]
Order best-first. Output at most ${FINAL_COUNT}.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 3000,
        thinking: { type: "adaptive" },
        system,
        messages: [{ role: "user", content: list }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as Curated[];
    return parsed.filter((p) => typeof p.n === "number" && items[p.n]);
  } catch (e) {
    console.error(`Curate (${topic}) failed: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function pick(candidates: FeedItem[], topic: "science" | "business"): Promise<Picked[]> {
  const curated = await curate(candidates, topic);
  if (curated.length > 0) {
    return curated.map((c) => ({ item: candidates[c.n], angle: c.angle ?? "", tweet: c.tweet ?? "" }));
  }
  return candidates.slice(0, FINAL_COUNT).map((item) => ({ item, angle: "", tweet: "" }));
}

// ---- Render ---------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCard({ item, angle, tweet }: Picked): string {
  const date = item.dateMs
    ? new Date(item.dateMs).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
  const angleBlock = angle
    ? `<div class="angle"><span class="angle-l">Why share</span>${esc(angle)}</div>`
    : "";
  const tweetBlock = tweet
    ? `<div class="tweet"><div class="tweet-h"><span class="tweet-l">Suggested tweet</span><button class="copy" data-copy="${esc(tweet)}">Copy</button></div><div class="tweet-b">${esc(tweet)}</div></div>`
    : "";
  if (item.kind === "post") {
    return `<article class="card">
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
    ${thumb}
    <div class="body">
      <div class="src">${esc(item.source)}${date ? " · " + esc(date) : ""}</div>
      <h3 class="title"><a href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.title)}</a></h3>
      ${synopsis}${angleBlock}${tweetBlock}
      <div class="foot"><a class="read" href="${esc(item.link)}" target="_blank" rel="noopener">Read ↗</a></div>
    </div>
  </article>`;
}

function renderNews(science: Picked[], business: Picked[], generatedAt: string): string {
  const when = new Date(generatedAt).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const col = (cls: string, label: string, items: Picked[]) =>
    `<section class="col ${cls}"><h2>${label}</h2>${
      items.map(renderCard).join("\n") || '<p class="empty">Nothing cleared the bar.</p>'
    }</section>`;
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
  .col h2{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0f172a;margin:0 0 4px;padding-bottom:9px;border-bottom:2px solid var(--acc)}
  .empty{font-size:13px;color:#94a3b8}
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
  .tweet{margin-top:9px;background:#fafbfc;border:1px solid #e8eaee;border-radius:11px;padding:10px 12px}
  .tweet-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
  .tweet-l{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8}
  .tweet-b{white-space:pre-line;font-size:13px;color:#1e293b;line-height:1.5}
  button.copy{appearance:none;border:1px solid #d8dde3;background:#fff;color:#0f172a;font-size:11px;font-weight:600;padding:4px 10px;border-radius:7px;cursor:pointer}
  button.copy:hover{background:#f1f5f9}
  .foot{margin-top:9px}
  .read{font-size:12.5px;font-weight:600;color:var(--acc);text-decoration:none}.read:hover{text-decoration:underline}
  footer{margin-top:28px;font-size:12px;color:#94a3b8;border-top:1px solid #e8eaee;padding-top:16px}
  @media(max-width:780px){.cols{grid-template-columns:1fr}}
  </style></head><body><div class="wrap">
  <header><div class="eyebrow">On Label · Daily</div><h1>Science &amp; Business</h1><div class="sub">${esc(when)} · worth sharing</div></header>
  <div class="cols">
    ${col("sci", "Science", science)}
    ${col("biz", "Business", business)}
  </div>
  <footer>Curated by Opus 4.8 from your RSS sources and business X accounts. Suggested tweets are drafts — nothing is posted.</footer>
  </div>
  <script>document.addEventListener('click',function(e){var b=e.target.closest('button.copy');if(!b)return;var t=b.getAttribute('data-copy')||'';function ok(){var p=b.textContent;b.textContent='Copied!';setTimeout(function(){b.textContent=p;},1500);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok).catch(ok);}else{ok();}});</script>
  </body></html>`;
}

// ---- Action / storage -----------------------------------------------------

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
    const old = await ctx.db
      .query("scienceSnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    if (old.length > 14) {
      for (const snap of old.slice(0, old.length - 14)) {
        await ctx.db.delete(snap._id);
      }
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
