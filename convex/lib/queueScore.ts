/**
 * Scoring for the unified engagement queue (convex/feedItems.ts, convex/queue.ts,
 * components/queue-feed.tsx). PURE MODULE — no Convex or Node imports — because the
 * client re-computes priorities on a timer with the exact same functions (Convex
 * queries re-run on data changes, not wall-clock time).
 *
 *   priority(t) = baseScore × 2^(−ageHours / halfLifeHours) × affinityMult
 *
 * Research grounding for the formula:
 * - Decay family: exponential half-life (2^(−age/h)), the standard for
 *   time-decayed counters in stream ranking (EWMA family). Considered and
 *   rejected: Hacker News gravity `points/(age+2)^1.8` and Reddit "hot"
 *   `log10(votes) + age/45000` — both are tuned for one homogeneous item type;
 *   a single per-type half-life is what makes tweets and articles comparable on
 *   one scale, and the exponential's fast tail is what buries a stale
 *   "reply early" item decisively (a power-law tail would keep it lingering).
 * - Half-life anchors: the measured median half-life of a tweet's engagement is
 *   ~24 minutes (Wiselytics 2014, widely replicated at <30 min) → early-reply
 *   items use 0.75h. News-take relevance runs hours-to-days → 30h keeps an
 *   article at ~50% after day one, ~10% by day four.
 * - Base value: X posts reuse X's open-sourced heavy-ranker engagement weights
 *   (weightedEngagement in convex/lib/xfeed.ts). Model-ranked lists (Sonnet /
 *   Opus orderings) convert rank position to score by linear interpolation —
 *   the rank-fusion family (cf. Cormack et al., Reciprocal Rank Fusion).
 */

import type { RankedPost } from "./xfeed";

// ---- Constants --------------------------------------------------------------

/** Per-feed decay half-lives (hours). See module comment for grounding. */
export const HALF_LIFE_HOURS: Record<string, number> = {
  early: 0.75, // reply window tracks tweet engagement half-life (~24 min)
  "x-trends": 6, // a rising conversation stays joinable for hours, dead next day
  science: 30, // original-take window: ~50% after 30h, ~10% by day 4
  biz: 30,
  creators: 12, // engagement-proven but reply value fades within a day
  deals: 48, // a funding announcement stays reply/QT-worthy for ~2 days
};

/** Items below this decayed priority are invisible in the queue. */
export const MIN_VISIBLE_PRIORITY = 3;

/** Queued items older than this many half-lives get expired by the prune cron. */
export const EXPIRE_HALF_LIVES = 8;

// ---- Base scores --------------------------------------------------------------

/**
 * Early-reply items: being fresh from a watched creator IS the value — the
 * best content in the tweets queue — so the base tops the trending ceiling
 * (95) with a small reach bonus (log-scaled followers, capped). A fresh early
 * post outranks everything; the 0.75h half-life retires it just as fast.
 */
export function earlyBaseScore(followers: number): number {
  return 95 + Math.min(5, Math.log10(Math.max(followers, 0) + 1));
}

/** Opus-curated trending posts: 95, 90, 85 … floor 50 by curation rank. */
export function trendsBaseScore(rank: number): number {
  return Math.max(50, 95 - 5 * (rank - 1));
}

/** Sonnet-ranked news (per column): 100, 95, 90 … floor 55 by importance rank. */
export function newsBaseScore(rank: number): number {
  return Math.max(55, 100 - 5 * (rank - 1));
}

/**
 * Creators-feed posts: 50–85 by engagement percentile within the batch
 * (weightedEngagement rank), below news/trending ceilings on purpose — these
 * are engagement-proven but not time-critical.
 */
export function creatorsBaseScore(indexInBatch: number, batchSize: number): number {
  const pct = batchSize > 1 ? (batchSize - 1 - indexInBatch) / (batchSize - 1) : 1;
  return 50 + 35 * pct;
}

/** Deal-radar items: bigger raises rank higher; undisclosed sits mid-pack.
 *  $1M→85, $10M→91, $100M→95 (capped) — between creators and trending. */
export function dealBaseScore(amountUsd: number | null): number {
  if (!amountUsd || amountUsd <= 0) return 87;
  return Math.min(95, 85 + Math.max(0, (Math.log10(amountUsd) - 5) * 3));
}

// ---- Priority -----------------------------------------------------------------

export interface ScoredItem {
  baseScore: number;
  halfLifeHours: number;
  affinityMult: number;
  publishedAt: number; // ms epoch — decay anchor
}

export function priority(item: ScoredItem, nowMs: number): number {
  const ageHours = Math.max(0, nowMs - item.publishedAt) / 3_600_000;
  return item.baseScore * Math.pow(2, -ageHours / item.halfLifeHours) * item.affinityMult;
}

// ---- Affinity -------------------------------------------------------------------

export interface AffinityCounts {
  engaged: number;
  opened: number;
  skipped: number;
}

/**
 * Behavior → score multiplier via a Bayesian-smoothed engagement rate
 * (Laplace / beta-binomial smoothing — the standard "don't trust small samples"
 * fix, cf. Evan Miller's "How Not To Sort By Average Rating" family; a smoothed
 * rate estimate, not a Wilson lower bound, since we want an expectation).
 * Prior α=1, β=3 ⇒ no history ≈ 1.0×; heavy skipping → ~0.8×; consistent
 * engagement → ~1.4×.
 */
export function affinityMultiplier(c: AffinityCounts): number {
  const rate = (c.engaged + 0.5 * c.opened + 1) / (c.engaged + c.opened + c.skipped + 4);
  return Math.min(1.5, Math.max(0.75, 0.75 + rate));
}

// ---- Normalization / payload helpers ---------------------------------------------

/**
 * Dedup key: `x:<tweetId>` for posts, `url:<normalized>` for articles
 * (lowercase host, no fragment, no tracking params, no trailing slash).
 */
export function externalIdFor(kind: "x-post" | "article", idOrLink: string): string {
  if (kind === "x-post") return `x:${idOrLink}`;
  return `url:${normalizeUrl(idOrLink)}`;
}

function normalizeUrl(link: string): string {
  try {
    const u = new URL(link);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(k)) u.searchParams.delete(k);
    }
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/$/, "");
  } catch {
    return link;
  }
}

/** Tweet ID from an x.com/twitter.com permalink, or null. */
export function tweetIdFromLink(link: string): string | null {
  const m = link.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}

/** The payload shape convex/feedItems.upsertBatch accepts (validator lives there). */
export interface QueueItemPayload {
  kind: "x-post" | "article";
  externalId: string;
  feed: string; // emitting feed slug: early | x-trends | science | biz | creators
  title?: string;
  text: string;
  link: string;
  imageUrl?: string;
  source: string; // RSS source name or "@handle"
  authorUsername?: string;
  authorName?: string;
  authorAvatar?: string;
  authorFollowers?: number;
  authorVerified?: boolean;
  authorNiche?: string;
  replies?: number;
  reposts?: number;
  likes?: number;
  quotes?: number;
  bookmarkCount?: number;
  views?: number;
  draft?: string;
  draftKind?: "reply" | "post";
  angle?: string;
  baseScore: number;
  halfLifeHours: number;
  scoreReason: string;
  publishedAt: number; // ms epoch; 0 = unknown (upsert anchors decay to first-seen)
}

/** Map a RankedPost (xTrends / creators feeds) to a queue item payload. */
export function itemFromRankedPost(
  p: RankedPost,
  feed: string,
  scoring: { baseScore: number; scoreReason: string },
): QueueItemPayload {
  const u = p.user;
  const m = p.tweet.public_metrics;
  return {
    kind: "x-post",
    externalId: externalIdFor("x-post", p.tweet.id),
    feed,
    text: p.tweet.text,
    link: u
      ? `https://x.com/${u.username}/status/${p.tweet.id}`
      : `https://x.com/i/status/${p.tweet.id}`,
    imageUrl: p.tweet.media_url,
    source: u ? "@" + u.username : "X",
    authorUsername: u?.username.toLowerCase(),
    authorName: u?.name,
    authorAvatar: u?.profile_image_url,
    authorFollowers: u?.public_metrics?.followers_count,
    authorVerified: u?.verified,
    authorNiche: p.authorNiche,
    replies: m.reply_count,
    reposts: m.retweet_count,
    likes: m.like_count,
    quotes: m.quote_count,
    bookmarkCount: m.bookmark_count,
    views: m.impression_count,
    draft: p.reply,
    draftKind: p.reply ? "reply" : undefined,
    baseScore: scoring.baseScore,
    halfLifeHours: HALF_LIFE_HOURS[feed],
    scoreReason: scoring.scoreReason,
    publishedAt: Date.parse(p.tweet.created_at) || 0,
  };
}
