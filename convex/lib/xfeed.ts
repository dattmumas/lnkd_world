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
  authorNiche?: string; // short niche label for the author (from the curator)
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
