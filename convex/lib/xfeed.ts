/**
 * Shared X-feed helpers used by both the "Trending on X" feed (convex/xTrends.ts)
 * and the curated "Creators" feed (convex/creators_feed.ts): the X API recent-search
 * call, engagement scoring, and the HTML renderer (cards + X icons + Copy).
 */

export interface PublicMetrics {
  reply_count: number;
  retweet_count: number;
  like_count: number;
  quote_count?: number;
  bookmark_count?: number;
  impression_count?: number;
}
export interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: PublicMetrics;
}
export interface XUser {
  id: string;
  username: string;
  name: string;
}
export interface RankedPost {
  tweet: Tweet;
  user: XUser | undefined;
  W: number;
  score: number;
}
export interface FeedGroup {
  niche: string; // section header; "" renders no header (flat list)
  posts: RankedPost[];
}

const MAX_RESULTS = 100; // per query (X API allows 10–100)

// X-aligned weights: reply ≫ quote > repost ≈ bookmark ≫ like. Replies are the
// strongest signal in X's open-sourced ranking (≈27× a like).
export function weightedEngagement(m: PublicMetrics): number {
  return (
    27 * m.reply_count +
    15 * (m.quote_count ?? 0) +
    2 * m.retweet_count +
    2 * (m.bookmark_count ?? 0) +
    1 * m.like_count
  );
}

// Early-trending score: weighted engagement per minute since posting (velocity,
// floored at the ~30-min evaluation window) × √volume so tiny-but-fast posts don't win.
export function scorePost(
  tweet: Tweet,
  nowMs: number,
): { W: number; score: number } {
  const W = weightedEngagement(tweet.public_metrics);
  const ageMin = Math.max((nowMs - Date.parse(tweet.created_at)) / 60000, 30);
  return { W, score: (W / ageMin) * Math.sqrt(W) };
}

// X recent search. Returns tweets + resolved author users (via author_id expansion).
export async function searchRecent(
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
  url.searchParams.set("tweet.fields", "public_metrics,created_at,lang,author_id");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username,name");
  url.searchParams.set("start_time", startTime);
  url.searchParams.set("sort_order", "relevancy");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "lnkd-world-xfeed" },
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
  return `${Math.round(min / 60)}h`;
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K";
  return String(n);
}

// X's own action-bar icons (reply, repost, like, views) as SVG path data.
const ICON: Record<string, string> = {
  reply:
    "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l1.904-.04v2.58l5.05-2.79c1.94-1.07 3.144-3.11 3.144-5.36 0-3.39-2.75-6.13-6.129-6.13H9.756z",
  repost:
    "M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z",
  like:
    "M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z",
  views:
    "M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z",
};
function stat(name: string, count: number): string {
  return `<span class="stat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[name]}"/></svg>${fmt(count)}</span>`;
}

/** Render a feed page (cards + X icons + Copy) from grouped, ranked posts. */
export function renderHtml(
  groups: FeedGroup[],
  opts: { title: string; subtitle: string; generatedAt: string; nowMs: number },
): string {
  const { title, subtitle, generatedAt, nowMs } = opts;
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
              ? stat("views", m.impression_count)
              : "";
          return `
        <div class="post">
          <div class="meta"><span class="name">${name}</span> <span class="handle">${esc(
            handle,
          )}</span> · <span class="age">${ageLabel(p.tweet.created_at, nowMs)}</span></div>
          <div class="text">${esc(p.tweet.text)}</div>
          <div class="stats">${stat("reply", m.reply_count)}${stat(
            "repost",
            m.retweet_count,
          )}${stat("like", m.like_count)}${views}</div>
          <div class="actions">
            <a href="${permalink}" target="_blank" rel="noopener">Open on X ↗</a>
            <button class="copy" data-url="${permalink}">Copy link</button>
          </div>
        </div>`;
        })
        .join("\n");
      return g.niche
        ? `<h2 class="niche">${esc(g.niche)}</h2>\n${cards}`
        : cards;
    })
    .join("\n");

  const body =
    sections ||
    `<p class="empty">No qualifying posts right now. The page refreshes automatically.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
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
  .stats { display:flex; gap:20px; align-items:center; color:#536471; font-size:13px; margin-bottom:10px; }
  .stat { display:inline-flex; align-items:center; gap:6px; }
  .stat svg { width:16px; height:16px; fill:currentColor; }
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
    <h1>${esc(title)}</h1>
    <div class="sub">Updated ${esc(when)} · ${esc(subtitle)}</div>
    ${body}
    <footer>Live from the X API.</footer>
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
