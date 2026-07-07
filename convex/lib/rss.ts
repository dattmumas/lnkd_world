/**
 * Shared RSS/Atom ingestion, extracted from convex/scienceFeed.ts so the deal
 * radar (convex/dealsFeed.ts) reuses the same battle-tested parsing. Defaults
 * preserve scienceFeed's exact behavior; the deal pipeline passes
 * { textCap: 6000, preferFullContent: true } because funding-roundup posts
 * carry their many deals in <content:encoded>, which the default path ignores.
 */

export interface FeedItem {
  kind: "article" | "post";
  title: string; // headline (article) or "" (post)
  text: string; // synopsis (article) or tweet text (post)
  link: string;
  source: string; // source name or @handle
  dateMs: number;
  image: string;
}

export interface SourceHealth {
  url: string;
  name: string;
  ok: boolean;
  items: number; // recent items contributed
  error?: string;
}

export interface ParseOpts {
  textCap?: number; // default 400 (scienceFeed behavior)
  preferFullContent?: boolean; // read <content:encoded> first (roundup bodies)
}

export interface GatherOpts extends ParseOpts {
  maxPerSource?: number; // default 20
}

export function extractImage(block: string): string {
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
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export function decode(s: string): string {
  let t = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  t = stripTags(t);
  t = decodeEntities(t);
  t = stripTags(t);
  t = t.replace(/&amp;/g, "&");
  // Second pass: double-encoding sources (&amp;#x2019;) only reveal their
  // entities after the &amp; unescape above.
  t = decodeEntities(t);
  t = stripTags(t);
  return t.replace(/\s+/g, " ").trim();
}

// Entity-decode without tag-stripping or whitespace collapse — safe for
// displaying already-stored text (queue rows ingested before hex entities
// were handled, tweet text where newlines must survive).
export function decodeInline(s: string): string {
  return decodeEntities(decodeEntities(s).replace(/&amp;/g, "&"));
}

export function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

export function parseFeed(
  xml: string,
  source: string,
  opts: ParseOpts = {},
): FeedItem[] {
  const textCap = opts.textCap ?? 400;
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
    const summary = opts.preferFullContent
      ? tag(b, "content:encoded") ||
        tag(b, "description") ||
        tag(b, "summary") ||
        tag(b, "content")
      : tag(b, "description") || tag(b, "summary") || tag(b, "content");
    const dateStr =
      tag(b, "pubDate") || tag(b, "updated") || tag(b, "published") || tag(b, "dc:date");
    out.push({
      kind: "article",
      title,
      text: summary.slice(0, textCap),
      link,
      source,
      dateMs: Date.parse(dateStr) || 0,
      image: extractImage(b),
    });
  }
  return out;
}

export async function fetchSource(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "lnkd-world/1.0 (+https://lnkd.world)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

// Gather recent RSS items across sources (one bad feed doesn't sink the rest),
// recording per-source health so /admin/sources can show what actually works.
export async function gatherRss(
  sources: { name: string; url: string }[],
  nowMs: number,
  maxAge: number,
  opts: GatherOpts = {},
): Promise<{ items: FeedItem[]; health: SourceHealth[] }> {
  const maxPerSource = opts.maxPerSource ?? 20;
  // Fetch all sources concurrently — one slow/dead feed no longer delays the rest.
  const results = await Promise.all(
    sources.map(async (s) => {
      try {
        const parsed = parseFeed(await fetchSource(s.url), s.name, opts);
        const recent = parsed
          .filter((it) => !it.dateMs || nowMs - it.dateMs <= maxAge)
          .sort((a, b) => b.dateMs - a.dateMs)
          .slice(0, maxPerSource);
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

export function dedupe(items: FeedItem[]): FeedItem[] {
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
