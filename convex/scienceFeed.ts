import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";

/**
 * "Science News" — combs the admin-managed RSS sources (convex/newsSources.ts)
 * for recent stories, then has Opus 4.8 pick the ones worth sharing for On Label
 * (the business of health, longevity & biotech), each with a one-line angle and a
 * suggested tweet. Rendered to HTML stored in `scienceSnapshots`, served at "science".
 */

const WINDOW_DAYS = 5;
const MAX_AGE_MS = WINDOW_DAYS * 24 * 3600 * 1000;
const MAX_PER_SOURCE = 12; // recent items considered per source
const MAX_CANDIDATES = 45; // total items handed to the curator
const FINAL_COUNT = 12; // stories surfaced

const ON_LABEL =
  "On Label covers the business of health, longevity, and biotech — drug development, deals, clinical data, metabolic health/GLP-1s, peptides, and the science behind the longevity industry. The audience is founders, operators, scientists, and investors in that space.";

interface NewsItem {
  title: string;
  link: string;
  summary: string;
  source: string;
  dateMs: number;
  image: string;
}

// Pull a representative image URL from an RSS/Atom item block. Entity-decode first
// so images embedded as encoded HTML (&lt;img src=…&gt;) are found too.
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

// Strip only real tag-like markup (starts with a letter / "/" / "!"), so text like
// "5 < 10" survives.
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

// CDATA-unwrap, strip literal tags, decode entities, then strip again to catch
// markup that was entity-encoded (e.g. BioPharma Dive's "&lt;figure&gt;…").
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

// Parse RSS <item> or Atom <entry> blocks into items.
function parseFeed(xml: string, source: string): NewsItem[] {
  const blocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s\S]*?<\/entry>/gi) ??
    [];
  const out: NewsItem[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    if (!title) continue;
    // RSS <link>url</link> or Atom <link href="url"/>.
    let link = tag(b, "link");
    if (!link) {
      const href = b.match(/<link[^>]*href="([^"]+)"/i);
      if (href) link = href[1];
    }
    const summary = tag(b, "description") || tag(b, "summary") || tag(b, "content");
    const dateStr =
      tag(b, "pubDate") || tag(b, "updated") || tag(b, "published") || tag(b, "dc:date");
    const dateMs = Date.parse(dateStr) || 0;
    out.push({
      title,
      link,
      summary: summary.slice(0, 400),
      source,
      dateMs,
      image: extractImage(b),
    });
  }
  return out;
}

async function fetchSource(name: string, url: string): Promise<NewsItem[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "lnkd-world/1.0 (+https://lnkd.world)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const xml = await res.text();
  return parseFeed(xml, name);
}

interface Curated {
  n: number;
  angle: string;
  tweet: string;
}

// Opus 4.8 picks the most share-worthy items + a one-line angle and a tweet.
async function curate(items: NewsItem[]): Promise<Curated[]> {
  const key = process.env.anthropic_api_key;
  if (!key || items.length === 0) return [];
  const list = items
    .map((it, i) => `[${i}] ${it.title} (${it.source})\n${it.summary}`)
    .join("\n\n");
  const system = `You curate a "science news worth sharing" briefing. ${ON_LABEL}

From the numbered items, pick the ${FINAL_COUNT} most worth sharing to that audience on X — surprising, debate-worthy, or genuinely important to the business/science of health & longevity. Skip generic wellness fluff, press-release filler, and off-topic items.

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
    console.error(`Science curate failed: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNews(picked: { item: NewsItem; angle: string; tweet: string }[], generatedAt: string): string {
  const when = new Date(generatedAt).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const cards = picked
    .map(({ item, angle, tweet }) => {
      const date = item.dateMs
        ? new Date(item.dateMs).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "";
      const thumb = item.image
        ? `<img class="thumb" src="${esc(item.image)}" alt="" loading="lazy" onerror="this.remove()">`
        : "";
      const synopsis = item.summary ? `<p class="synopsis">${esc(item.summary)}</p>` : "";
      const angleBlock = angle
        ? `<div class="angle"><span class="angle-l">Why share</span>${esc(angle)}</div>`
        : "";
      const tweetBlock = tweet
        ? `<div class="tweet"><div class="tweet-h"><span class="tweet-l">Suggested tweet</span><button class="copy" data-copy="${esc(tweet)}">Copy</button></div><div class="tweet-b">${esc(tweet)}</div></div>`
        : "";
      return `<article class="card">
        ${thumb}
        <div class="body">
          <div class="src">${esc(item.source)}${date ? " · " + esc(date) : ""}</div>
          <h2 class="title"><a href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.title)}</a></h2>
          ${synopsis}
          ${angleBlock}
          ${tweetBlock}
          <div class="foot"><a class="read" href="${esc(item.link)}" target="_blank" rel="noopener">Read full story ↗</a></div>
        </div>
      </article>`;
    })
    .join("\n");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  :root{color-scheme:light}*{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#f7f8fa;line-height:1.55;-webkit-font-smoothing:antialiased}
  .wrap{max-width:780px;margin:0 auto;padding:28px 20px 64px}
  header{margin-bottom:20px}
  .eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8}
  h1{font-size:27px;margin:5px 0 3px;letter-spacing:-.015em;font-weight:700}
  .sub{font-size:13.5px;color:#94a3b8}
  .card{display:flex;gap:16px;background:#fff;border:1px solid #e8eaee;border-radius:16px;padding:16px;margin:14px 0;box-shadow:0 1px 2px rgba(15,23,42,.04),0 2px 6px rgba(15,23,42,.03)}
  .thumb{width:150px;height:114px;flex-shrink:0;border-radius:12px;object-fit:cover;background:#eef2f6}
  .body{min-width:0;flex:1}
  .src{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;margin-bottom:5px}
  .title{margin:0 0 7px;font-size:17px;line-height:1.32;font-weight:700;letter-spacing:-.01em}
  .title a{color:#0f172a;text-decoration:none}.title a:hover{color:#059669}
  .synopsis{margin:0 0 10px;font-size:14px;color:#52606d;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .angle{font-size:13.5px;color:#334155;background:#f1f6f4;border-radius:10px;padding:9px 12px;margin:10px 0}
  .angle-l{display:block;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#059669;margin-bottom:3px}
  .tweet{margin-top:10px;background:#fafbfc;border:1px solid #e8eaee;border-radius:12px;padding:11px 13px}
  .tweet-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
  .tweet-l{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8}
  .tweet-b{white-space:pre-line;font-size:13.5px;color:#1e293b;line-height:1.55}
  button.copy{appearance:none;border:1px solid #d8dde3;background:#fff;color:#0f172a;font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:8px;cursor:pointer}
  button.copy:hover{background:#f1f5f9}
  .foot{margin-top:11px}
  .read{font-size:13px;font-weight:600;color:#059669;text-decoration:none}.read:hover{text-decoration:underline}
  footer{margin-top:30px;font-size:12px;color:#94a3b8;border-top:1px solid #e8eaee;padding-top:16px}
  @media(max-width:560px){.card{flex-direction:column}.thumb{width:100%;height:180px}}
  </style></head><body><div class="wrap">
  <header><div class="eyebrow">On Label · Science</div><h1>Worth Sharing</h1><div class="sub">${esc(when)} · curated from your sources</div></header>
  ${cards || '<p class="sub">No stories cleared the bar this run.</p>'}
  <footer>Curated by Opus 4.8 from your RSS sources. Suggested tweets are drafts — nothing is posted.</footer>
  </div>
  <script>document.addEventListener('click',function(e){var b=e.target.closest('button.copy');if(!b)return;var t=b.getAttribute('data-copy')||'';function ok(){var p=b.textContent;b.textContent='Copied!';setTimeout(function(){b.textContent=p;},1500);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok).catch(ok);}else{ok();}});</script>
  </body></html>`;
}

export const refreshInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const generatedAt = new Date().toISOString();
    const nowMs = Date.now();
    try {
      const sources: { name: string; url: string }[] = await ctx.runQuery(
        internal.newsSources.activeSources,
        {},
      );
      if (sources.length === 0) {
        await ctx.runMutation(internal.scienceFeed.store, {
          generatedAt,
          html: "",
          status: "empty",
          count: 0,
        });
        return { status: "empty", count: 0 };
      }

      // Gather recent items across sources (one bad feed doesn't sink the rest).
      const items: NewsItem[] = [];
      for (const s of sources) {
        try {
          const parsed = await fetchSource(s.name, s.url);
          const recent = parsed
            .filter((it) => !it.dateMs || nowMs - it.dateMs <= MAX_AGE_MS)
            .sort((a, b) => b.dateMs - a.dateMs)
            .slice(0, MAX_PER_SOURCE);
          items.push(...recent);
        } catch (err) {
          console.error(
            `Science source ${s.name} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // Dedup by link, newest-first, cap the candidate pool.
      const seen = new Set<string>();
      const candidates = items
        .filter((it) => {
          const k = it.link || it.title;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((a, b) => b.dateMs - a.dateMs)
        .slice(0, MAX_CANDIDATES);

      // Opus picks the share-worthy ones; fall back to most-recent on failure.
      const curated = await curate(candidates);
      const picked =
        curated.length > 0
          ? curated.map((c) => ({
              item: candidates[c.n],
              angle: c.angle ?? "",
              tweet: c.tweet ?? "",
            }))
          : candidates.slice(0, FINAL_COUNT).map((item) => ({ item, angle: "", tweet: "" }));

      const html = renderNews(picked, generatedAt);
      const status = picked.length > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.scienceFeed.store, {
        generatedAt,
        html,
        status,
        count: picked.length,
      });
      return { status, count: picked.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.scienceFeed.store, {
        generatedAt,
        html: "",
        status: "error",
        count: 0,
        error: message,
      });
      throw new Error(`Science feed refresh failed: ${message}`);
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
