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
  media_url?: string; // first attached photo (pbs.twimg.com), if any
  is_reply?: boolean;
  in_reply_to_tweet_id?: string;
  in_reply_to_user_id?: string;
}
export interface XUser {
  id: string;
  username: string;
  name: string;
  description?: string; // bio — lets the curator judge the account, not just the tweet
  verified?: boolean;
  public_metrics?: { followers_count?: number; following_count?: number };
  profile_image_url?: string;
}
export interface RankedPost {
  tweet: Tweet;
  user: XUser | undefined;
  W: number;
  score: number;
  reply?: string; // optional AI-suggested reply (Trending on X feed)
  authorNiche?: string; // short niche label for the author (from the curator)
}
export interface FeedGroup {
  niche: string; // section header; "" renders no header (flat list)
  posts: RankedPost[];
}

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

const REPLY_SYSTEM = `You write reply suggestions on X for someone growing an account in the business of health, longevity, and biotech (the On Label voice). Each reply goes under someone else's post. The goal is account growth. You want the author to reply back, and you want readers curious enough to click the profile and follow.

How to write them:
- Hook the first few words. No throat-clearing. No "Great point."
- Show you actually know this space. Drop a specific fact, a number, a concrete example, or an insider detail. That expertise is what earns the profile click.
- Make them want to reply. Ask a sharp question, add a real build, or point out the part most people miss. Reply chains are the strongest growth signal. Never just "I agree."
- Have an opinion, but stay friendly. No dunking. No negativity-bait. No sycophancy.

Voice and format:
- Casual and conversational. Write like you talk to a smart friend.
- Use short sentences. Split ideas into separate sentences instead of stacking clauses.
- Do NOT use em-dashes. Use a period or a comma instead.
- One idea. Under ~250 characters.
- Sound like a specific person, not a generic commenter.

Output ONLY the reply text. No preamble, quotes, labels, or explanation.`;

/**
 * Generate a short suggested reply for a post via the Anthropic API (raw HTTP —
 * the action module also holds a mutation/query, which precludes "use node" and
 * the SDK). Reads the key from `process.env.anthropic_api_key`. Returns null when
 * the key is unset or the call fails, so the feed degrades gracefully.
 */
export async function suggestReply(tweetText: string): Promise<string | null> {
  const key = process.env.anthropic_api_key;
  if (!key) return null;
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
        max_tokens: 150,
        thinking: { type: "disabled" },
        system: REPLY_SYSTEM,
        messages: [
          { role: "user", content: `Post:\n"""${tweetText}"""\n\nWrite the reply.` },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    return text || null;
  } catch (e) {
    console.error(`Anthropic fetch failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

// What On Label is — context for the curation model. Edit to refine the focus.
const ON_LABEL_CONTEXT = `On Label is a new blog about the business of health and longevity — the startups, companies, funding rounds, deals, operators, and investors building the longevity economy, plus biotech and consumer-health companies and the science with real business implications. Its audience is founders, operators, and investors who want genuine signal on what's happening in health/longevity business, not generic wellness content.`;

/**
 * Use Claude (Opus 4.8) to curate the candidate posts down to the `count` most
 * relevant/valuable for On Label's audience. Returns the selected posts in the
 * model's ranked order. Falls back to the velocity-ranked top `count` if the key
 * is unset, the pool is already small, or the call/parse fails.
 */
export async function curateTopPosts(
  candidates: RankedPost[],
  count: number,
): Promise<RankedPost[]> {
  const key = process.env.anthropic_api_key;
  // Run curation whenever there's a key and any candidates, so the niche labels
  // (and ranking) are always produced — not just when the pool exceeds `count`.
  if (!key || candidates.length === 0) return candidates.slice(0, count);

  const now = Date.now();
  const list = candidates
    .map((p, i) => {
      const m = p.tweet.public_metrics;
      const u = p.user;
      const followers = u?.public_metrics?.followers_count;
      const who = [
        u ? "@" + u.username : "?",
        u?.verified ? "✓" : "",
        followers != null ? `${fmt(followers)} followers` : "",
        u?.description
          ? `bio: ${u.description.replace(/\s+/g, " ").slice(0, 140)}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const text = p.tweet.text.replace(/\s+/g, " ").slice(0, 280);
      return `${i + 1}. ${who} · posted ${ageLabel(p.tweet.created_at, now)} ago\n   (${m.like_count} likes, ${m.reply_count} replies, ${m.retweet_count} reposts) ${text}`;
    })
    .join("\n");

  const system = `${ON_LABEL_CONTEXT}

You curate the "Trending on X" feed for On Label. Each candidate shows its AUTHOR (handle, verified, follower count, bio) and the POST (engagement + text). Judge fit using BOTH — the author matters as much as the tweet.

Select only posts that clearly belong on On Label: substantive and on-topic for the BUSINESS of health & longevity — startups, companies, funding/deals, FDA/clinical/regulatory news, notable founders/operators, or rigorous science with clear business implications. Strongly prefer authors who are operators, founders, scientists, or analysts close to specific companies and the science. Be selective with general investors and markets commentators.

Reject — even with high engagement: generic wellness/biohacking fluff, supplement or product ads, off-topic virality, engagement-bait, and accounts whose bio shows they are clearly not in this space. Also down-rank generic markets/macro/equity-trading and stock-picking commentary (sector-rotation takes, "is X a buy", ticker calls, portfolio updates) UNLESS the post is substantively about a specific company, product, deal, regulatory event, or the underlying science. On Label is the business and science of the space, not market/ticker commentary.

These are posts to REPLY to for audience growth, so also weigh REPLY OPPORTUNITY: prefer posts from accounts with real reach in the space (higher follower count) that were posted recently and are still gaining engagement — a reply there gets seen as the post climbs and exposes the author to that account's audience. A sharp reply under a big, rising, on-topic post is worth more than one under a tiny or stale account. Balance this with genuine topical fit.

Return the ${count} best-fitting posts, ranked most-valuable first. Aim to return ${count}: when several reasonable on-topic options exist, fill to ${count}. Only return fewer if there genuinely aren't ${count} posts that reasonably fit On Label. Cap the selection at no more than 2 posts that are primarily investor or markets commentary; fill the rest with company, product, deal, science, or founder substance.

Output ONLY a JSON array, one object per selected post, ranked most-valuable first. Every object MUST have both keys: {"n": <the post number>, "niche": "<1-3 word label for THIS author's niche, judged from their bio, e.g. Biotech VC, Longevity researcher, Pharma analyst, Health founder>"}. Always include "niche" for every pick. Do not output bare numbers. Example: [{"n":4,"niche":"Biotech VC"},{"n":1,"niche":"Longevity researcher"}].`;

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
        messages: [{ role: "user", content: `Candidates:\n${list}` }],
      }),
    });
    if (!res.ok) {
      console.error(`Anthropic curate ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return candidates.slice(0, count);
    }
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return candidates.slice(0, count);
    // Accept objects ({n, niche}) or bare numbers, for robustness.
    const order = JSON.parse(match[0]) as (number | { n: number; niche?: string })[];
    const picked: RankedPost[] = [];
    const used = new Set<number>();
    for (const item of order) {
      const n = typeof item === "number" ? item : item.n;
      const niche = typeof item === "number" ? undefined : item.niche;
      const i = n - 1;
      if (i >= 0 && i < candidates.length && !used.has(i)) {
        used.add(i);
        if (niche) candidates[i].authorNiche = niche;
        picked.push(candidates[i]);
      }
      if (picked.length >= count) break;
    }
    return picked.length ? picked : candidates.slice(0, count);
  } catch (e) {
    console.error(`Anthropic curate failed: ${e instanceof Error ? e.message : String(e)}`);
    return candidates.slice(0, count);
  }
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
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10_000 ? 0 : 1) + "K";
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
  verified:
    "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z",
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
          const avatarUrl = u?.profile_image_url
            ? u.profile_image_url.replace("_normal", "_bigger")
            : "";
          const avatar = avatarUrl
            ? `<img class="avatar" src="${esc(avatarUrl)}" alt="" loading="lazy">`
            : `<div class="avatar avatar-fallback">${esc((u?.name || "?").slice(0, 1).toUpperCase())}</div>`;
          const badge = u?.verified
            ? `<svg class="badge" viewBox="0 0 24 24" aria-label="Verified"><path d="${ICON.verified}"/></svg>`
            : "";
          const bioTitle = u?.description ? ` title="${esc(u.description)}"` : "";
          const followers = u?.public_metrics?.followers_count;
          const insightParts = [
            followers != null ? `${fmt(followers)} followers` : "",
            p.authorNiche ? esc(p.authorNiche) : "",
          ].filter(Boolean);
          const insights = insightParts.length
            ? `<div class="tw-insights">${insightParts.join(" · ")}</div>`
            : "";
          return `
        <div class="post">
          ${avatar}
          <div class="tw-body">
            <div class="tw-head"><span class="tw-name"${bioTitle}>${name}</span>${badge}<span class="tw-handle">${esc(
              handle,
            )}</span><span class="tw-dot">·</span><span class="tw-age">${ageLabel(p.tweet.created_at, nowMs)}</span></div>
            ${insights}
            <div class="tw-text">${esc(p.tweet.text)}</div>
            <div class="stats">${stat("reply", m.reply_count)}${stat(
              "repost",
              m.retweet_count,
            )}${stat("like", m.like_count)}${views}</div>
            ${
              p.reply
                ? `<div class="reply"><div class="reply-label">Suggested reply</div><div class="reply-text">${esc(
                    p.reply,
                  )}</div><button class="copy" data-copy="${esc(p.reply)}">Copy reply</button></div>`
                : ""
            }
            <div class="actions">
              <a href="${permalink}" target="_blank" rel="noopener">Open on X ↗</a>
              <button class="copy" data-copy="${esc(permalink)}">Copy link</button>
            </div>
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
  .post { display:flex; gap:12px; background:#fff; border:1px solid #e6e9ee; border-radius:14px; padding:14px 16px; margin-bottom:12px; }
  .avatar { width:44px; height:44px; border-radius:50%; flex-shrink:0; object-fit:cover; background:#e6e9ee; }
  .avatar-fallback { display:flex; align-items:center; justify-content:center; font-weight:700; color:#64748b; font-size:18px; }
  .tw-body { flex:1; min-width:0; }
  .tw-head { display:flex; align-items:center; gap:4px; flex-wrap:wrap; font-size:15px; line-height:1.3; }
  .tw-name { font-weight:700; color:#0f172a; }
  .badge { width:16px; height:16px; fill:#1d9bf0; flex-shrink:0; }
  .tw-handle, .tw-dot, .tw-age { color:#64748b; font-weight:400; }
  .tw-insights { font-size:12.5px; color:#536471; margin:2px 0 8px; }
  .tw-text { font-size:15px; color:#0f172a; white-space:pre-wrap; margin-bottom:10px; }
  .stats { display:flex; gap:20px; align-items:center; color:#536471; font-size:13px; margin-bottom:10px; }
  .stat { display:inline-flex; align-items:center; gap:6px; }
  .stat svg { width:16px; height:16px; fill:currentColor; }
  .reply { background:#f8fafc; border:1px solid #e6e9ee; border-radius:8px; padding:10px 12px; margin-bottom:10px; }
  .reply-label { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#94a3b8; margin-bottom:4px; }
  .reply-text { font-size:14px; color:#0f172a; margin-bottom:8px; white-space:pre-wrap; }
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
        var val = b.getAttribute("data-copy");
        var label = b.textContent;
        var done = function () { b.textContent = "Copied!"; setTimeout(function () { b.textContent = label; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val).then(done).catch(done);
        } else { done(); }
      });
    });
  </script>
</body>
</html>`;
}
