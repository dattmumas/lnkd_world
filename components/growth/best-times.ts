/**
 * Best-time-to-post, computed client-side in the user's local timezone from
 * the posted pipeline's denormalized metrics (xPosts.board ships postedAt +
 * latest*). Below the minimum sample, fall back to the research default.
 */

export interface PostedLike {
  postedAt?: number;
  latestLikes?: number;
  latestReplies?: number;
  latestReposts?: number;
  latestQuotes?: number;
  latestBookmarks?: number;
  latestViews?: number;
}

export interface TimeWindow {
  day: number; // 0 = Sunday (JS getDay)
  block: number; // 3h block index, 0 = 00:00-03:00 local
  label: string; // "Wed 9-12"
  avgEngagement: number;
  posts: number;
}

export const MIN_POSTS_FOR_SIGNAL = 15;

export const DEFAULT_WINDOW_NOTE =
  "Not enough measured posts yet — research default: Tue–Thu, 9–11am (audience timezone), Wednesday strongest.";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Same reply-heavy weighting as the rest of the system (lib/xfeed.ts).
function engagement(p: PostedLike): number {
  return (
    27 * (p.latestReplies ?? 0) +
    15 * (p.latestQuotes ?? 0) +
    2 * (p.latestReposts ?? 0) +
    2 * (p.latestBookmarks ?? 0) +
    (p.latestLikes ?? 0)
  );
}

/**
 * Bucket posted-with-metrics items into local day-of-week × 3h blocks and
 * return the top windows by average engagement, or null below the sample gate.
 */
export function computeBestWindows(posts: PostedLike[]): TimeWindow[] | null {
  const measured = posts.filter(
    (p) => p.postedAt != null && p.latestViews != null,
  );
  if (measured.length < MIN_POSTS_FOR_SIGNAL) return null;

  const buckets = new Map<string, { total: number; posts: number; day: number; block: number }>();
  for (const p of measured) {
    const d = new Date(p.postedAt as number);
    const day = d.getDay();
    const block = Math.floor(d.getHours() / 3);
    const key = `${day}-${block}`;
    const cur = buckets.get(key) ?? { total: 0, posts: 0, day, block };
    cur.total += engagement(p);
    cur.posts += 1;
    buckets.set(key, cur);
  }

  return [...buckets.values()]
    .filter((b) => b.posts >= 2) // one lucky post isn't a window
    .map((b) => ({
      day: b.day,
      block: b.block,
      label: `${DAY[b.day]} ${b.block * 3}–${b.block * 3 + 3}h`,
      avgEngagement: Math.round(b.total / b.posts),
      posts: b.posts,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 3);
}
