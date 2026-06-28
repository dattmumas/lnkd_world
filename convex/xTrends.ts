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
 * "Trending on X" — pulls real posts from the X API (recent search) and ranks
 * them by an EARLY-trending score, then renders the page HTML stored in
 * `xTrendsSnapshots` and served by `feed.getPage`.
 *
 * Ranking is research-grounded, not raw engagement:
 *  - X's own open-sourced weights put replies ≈ 27× reposts ≈ 27× likes, with
 *    bookmarks/quotes high and likes near-baseline → `weightedEngagement`.
 *  - Early-virality research: the strongest *early* signal is weighted engagement
 *    normalized by post age (velocity), within the first ~30–60 min window →
 *    score = velocity · √(weightedEngagement), over the last 24h.
 * Sources: X recommendation-algorithm (open source); NYU Cybersecurity for
 * Democracy, "Predicting Virality: How soon can we tell?".
 */

interface PublicMetrics {
  reply_count: number;
  retweet_count: number;
  like_count: number;
  quote_count?: number;
  bookmark_count?: number;
  impression_count?: number;
}
interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: PublicMetrics;
}
interface XUser {
  id: string;
  username: string;
  name: string;
}
interface RankedPost {
  tweet: Tweet;
  user: XUser | undefined;
  W: number;
  score: number;
}

// Niche search queries (recent search; last 24h applied via start_time).
const QUERIES: { niche: string; q: string }[] = [
  {
    niche: "Longevity",
    q: '(longevity OR healthspan OR rapamycin OR "anti-aging" OR senolytics OR epigenetic OR NAD) -is:retweet -is:reply lang:en',
  },
  {
    niche: "Health",
    q: '("metabolic health" OR GLP-1 OR "zone 2" OR VO2max OR creatine OR "blood sugar" OR "deep sleep") -is:retweet -is:reply lang:en',
  },
  {
    niche: "Health & longevity startups",
    q: '((startup OR founder OR raised OR "seed round" OR "Series A") (health OR biotech OR longevity OR wellness OR diagnostics)) -is:retweet -is:reply lang:en',
  },
];

const MAX_RESULTS = 100; // per query (X API allows 10–100); bigger candidate pool
const TOP_N = 6; // posts kept per niche
const MIN_W = 25; // weighted-engagement floor to drop noise (≈1 reply or 25 likes)

// X-aligned weights: reply ≫ quote > repost ≈ bookmark ≫ like (see file header).
function weightedEngagement(m: PublicMetrics): number {
  return (
    27 * m.reply_count +
    15 * (m.quote_count ?? 0) +
    2 * m.retweet_count +
    2 * (m.bookmark_count ?? 0) +
    1 * m.like_count
  );
}

// Early-trending score: velocity (W per minute since posting, floored at the
// ~30-min evaluation window) weighted by √volume so tiny-but-fast posts don't win.
function scorePost(tweet: Tweet, nowMs: number): { W: number; score: number } {
  const W = weightedEngagement(tweet.public_metrics);
  const ageMin = Math.max((nowMs - Date.parse(tweet.created_at)) / 60000, 30);
  const velocity = W / ageMin;
  return { W, score: velocity * Math.sqrt(W) };
}

async function searchRecent(
  query: string,
  startTime: string,
): Promise<{ tweets: Tweet[]; users: XUser[] }> {
  const token = process.env.x_bearer;
  if (!token) {
    throw new Error("x_bearer is not set in the Convex environment.");
  }
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", String(MAX_RESULTS));
  url.searchParams.set(
    "tweet.fields",
    "public_metrics,created_at,lang,author_id",
  );
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username,name");
  url.searchParams.set("start_time", startTime);
  // Rank by relevancy (engagement-correlated) rather than newest-first, so the
  // candidate pool contains posts that have actually accumulated engagement.
  url.searchParams.set("sort_order", "relevancy");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "lnkd-world-xtrends" },
  });
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: Tweet[];
    includes?: { users?: XUser[] };
  };
  return { tweets: json.data ?? [], users: json.includes?.users ?? [] };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ageLabel(createdAt: string, nowMs: number): string {
  const min = Math.max(Math.round((nowMs - Date.parse(createdAt)) / 60000), 1);
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  return `${h}h`;
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K";
  return String(n);
}

function renderHtml(
  groups: { niche: string; posts: RankedPost[] }[],
  generatedAt: string,
  nowMs: number,
): string {
  const when = new Date(generatedAt).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const sections = groups
    .filter((g) => g.posts.length > 0)
    .map((g) => {
      const cards = g.posts
        .map((p) => {
          const u = p.user;
          const handle = u ? "@" + u.username : "";
          const name = u ? esc(u.name) : "Unknown";
          const permalink = u
            ? `https://x.com/${u.username}/status/${p.tweet.id}`
            : `https://x.com/i/status/${p.tweet.id}`;
          const m = p.tweet.public_metrics;
          const views =
            m.impression_count && m.impression_count > 0
              ? ` · 👁 ${fmt(m.impression_count)}`
              : "";
          return `
        <div class="post">
          <div class="meta"><span class="name">${name}</span> <span class="handle">${esc(
            handle,
          )}</span> · <span class="age">${ageLabel(p.tweet.created_at, nowMs)}</span></div>
          <div class="text">${esc(p.tweet.text)}</div>
          <div class="stats">💬 ${fmt(m.reply_count)} · 🔁 ${fmt(
            m.retweet_count,
          )} · ❤️ ${fmt(m.like_count)}${views}</div>
          <div class="actions">
            <a href="${permalink}" target="_blank" rel="noopener">Open on X ↗</a>
            <button class="copy" data-url="${permalink}">Copy link</button>
          </div>
        </div>`;
        })
        .join("\n");
      return `<h2 class="niche">${esc(g.niche)}</h2>\n${cards}`;
    })
    .join("\n");

  const body =
    sections ||
    `<p class="empty">No qualifying posts in the last 24h. The page will refresh automatically.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trending on X</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#0f172a; background:#f7f8fa; line-height:1.5; }
  .wrap { max-width:680px; margin:0 auto; padding:32px 20px 64px; }
  h1 { font-size:24px; margin:0 0 4px; }
  .sub { color:#64748b; font-size:13px; margin-bottom:24px; }
  h2.niche { font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:#2563eb; margin:28px 0 12px; }
  .post { background:#fff; border:1px solid #e6e9ee; border-radius:12px; padding:14px 16px; margin-bottom:12px; }
  .meta { font-size:13px; color:#64748b; margin-bottom:6px; }
  .meta .name { color:#0f172a; font-weight:600; }
  .text { font-size:15px; white-space:pre-wrap; margin-bottom:10px; }
  .stats { font-size:13px; color:#475569; margin-bottom:10px; }
  .actions { display:flex; gap:10px; align-items:center; }
  .actions a { font-size:13px; font-weight:600; color:#2563eb; text-decoration:none; }
  .actions a:hover { text-decoration:underline; }
  button.copy { font-size:12px; border:1px solid #cbd5e1; background:#fff; border-radius:6px; padding:4px 10px; cursor:pointer; color:#334155; }
  button.copy:hover { background:#f1f5f9; }
  .empty { color:#64748b; }
  footer { margin-top:28px; font-size:12px; color:#94a3b8; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Trending on X</h1>
    <div class="sub">Updated ${esc(when)} · ranked by early engagement velocity (replies ≫ reposts ≫ likes), last 24h</div>
    ${body}
    <footer>Live from the X API. Ranked by weighted-engagement velocity, not raw likes.</footer>
  </div>
  <script>
    document.querySelectorAll("button.copy").forEach(function (b) {
      b.addEventListener("click", function () {
        var url = b.getAttribute("data-url");
        var done = function () { b.textContent = "Copied!"; setTimeout(function () { b.textContent = "Copy link"; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done).catch(done);
        } else { done(); }
      });
    });
  </script>
</body>
</html>`;
}

/** The actual refresh: search X, rank, render, store. Called by cron + admin trigger. */
export const refreshInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const generatedAt = new Date().toISOString();
    const nowMs = Date.now();
    try {
      const startTime = new Date(nowMs - 24 * 3600 * 1000).toISOString();
      const groups: { niche: string; posts: RankedPost[] }[] = [];
      let total = 0;
      for (const { niche, q } of QUERIES) {
        const { tweets, users } = await searchRecent(q, startTime);
        const userById = new Map(users.map((u) => [u.id, u]));
        const ranked: RankedPost[] = tweets
          .map((t) => {
            const { W, score } = scorePost(t, nowMs);
            return { tweet: t, user: userById.get(t.author_id), W, score };
          })
          .filter((p) => p.W >= MIN_W)
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_N);
        groups.push({ niche, posts: ranked });
        total += ranked.length;
      }
      const html = renderHtml(groups, generatedAt, nowMs);
      const status = total > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.xTrends.store, {
        generatedAt,
        html,
        status,
        count: total,
      });
      return { status, count: total };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.xTrends.store, {
        generatedAt,
        html: "",
        status: "error",
        count: 0,
        error: message,
      });
      throw new Error(`X trends refresh failed: ${message}`);
    }
  },
});

/** Store a snapshot, pruning to the last 14. */
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
      .query("xTrendsSnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    if (old.length > 14) {
      for (const snap of old.slice(0, old.length - 14)) {
        await ctx.db.delete(snap._id);
      }
    }
    return await ctx.db.insert("xTrendsSnapshots", {
      generatedAt: args.generatedAt,
      html: args.html,
      status: args.status,
      count: args.count,
      error: args.error,
      createdAt: new Date().toISOString(),
    });
  },
});

/** Admin gate for the manual trigger (actions have no db, so check runs as a query). */
export const _assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

/** Admin-only manual refresh (the cron handles the daily run automatically). */
export const refresh = action({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const _admin: null = await ctx.runQuery(internal.xTrends._assertAdmin, {});
    // Explicit annotation breaks same-file runAction return-type circularity.
    const result: { status: string; count: number } = await ctx.runAction(
      internal.xTrends.refreshInternal,
      {},
    );
    return { ok: true, status: result.status, count: result.count };
  },
});
