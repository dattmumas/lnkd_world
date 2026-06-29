/**
 * GetXAPI (https://api.getxapi.com) helpers for all X READ paths: network
 * discovery (user info + following) and the feeds (tweet search). Chosen over the
 * official X API because it bills per CALL ($0.001) instead of per object (~$0.01),
 * and its list responses already include full user/author objects — so no separate
 * enrich step. ~700× cheaper on the network pulls; ~$0.001/page on search.
 *
 * Auth: `Authorization: Bearer <process.env.production>` (the key is stored in
 * Convex under the env name "production"). Read-only.
 */
import type { Tweet, XUser } from "./xfeed";

const BASE = "https://api.getxapi.com";
const PAGE_SIZE = 70; // following_v2 returns ~70/page (used for cost estimates)
const MAX_PAGES = 100; // safety ceiling on pagination
const MAX_FOLLOWS = 6000; // storage/cost guard per seed; flagged as truncated beyond

export const GX_PAGE_SIZE = PAGE_SIZE;

interface GxRawUser {
  id: string | number;
  userName?: string;
  name?: string;
  description?: string | null;
  followers?: number;
  following?: number;
  profilePicture?: string | null;
  isBlueVerified?: boolean;
  isVerified?: boolean;
}

interface GxFollowingResp {
  following?: GxRawUser[];
  users?: GxRawUser[];
  data?: GxRawUser[] | { following?: GxRawUser[] };
  has_more?: boolean;
  next_cursor?: string | null;
}

function gxHeaders(): Record<string, string> {
  const key = process.env.production;
  if (!key) {
    throw new Error("getXAPI key (Convex env 'production') is not set.");
  }
  return { Authorization: `Bearer ${key}`, "User-Agent": "lnkd-world" };
}

async function sleep(ms: number): Promise<void> {
  if (typeof setTimeout !== "function") return; // no-op if the runtime lacks timers
  await new Promise<void>((r) => setTimeout(r, ms));
}

// Fetch a getXAPI URL with retries on TRANSIENT failures (HTTP 5xx + network/throw).
// 2xx and 4xx (incl. 429) return immediately so callers handle them as before. This
// absorbs getXAPI's occasional 502s so one hiccup doesn't fail a whole feed refresh.
async function gxFetch(url: string): Promise<Response> {
  const backoffs = [300, 800, 1500];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await fetch(url, { headers: gxHeaders() });
      if (res.status >= 500 && attempt < backoffs.length) {
        await sleep(backoffs[attempt]);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < backoffs.length) {
        await sleep(backoffs[attempt]);
        continue;
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("getXAPI request failed after retries");
}

// Map a getXAPI user object onto our shared XUser shape.
function mapUser(u: GxRawUser): XUser {
  return {
    id: String(u.id),
    username: u.userName ?? "",
    name: u.name ?? "",
    description: u.description ?? undefined,
    verified: u.isBlueVerified ?? u.isVerified ?? undefined,
    public_metrics: {
      followers_count: u.followers ?? 0,
      following_count: u.following ?? 0,
    },
    profile_image_url: u.profilePicture ?? undefined,
  };
}

// Resolve a handle to its profile (id + follower/following counts + bio).
export async function gxUserInfo(handle: string): Promise<XUser> {
  const url = new URL(`${BASE}/twitter/user/info`);
  url.searchParams.set("userName", handle);
  const res = await gxFetch(url.toString());
  if (!res.ok) {
    throw new Error(`getXAPI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { status?: string; msg?: string; data?: GxRawUser };
  if (!json.data) {
    throw new Error(`getXAPI user/info failed for @${handle}: ${json.msg ?? "no data"}`);
  }
  return mapUser(json.data);
}

// Pull the accounts a user follows (cursor-paginated), as FULL user objects —
// getXAPI's list already carries profile fields, so no enrich step is needed.
export async function gxFollowing(
  handle: string,
): Promise<{ users: XUser[]; truncated: boolean }> {
  const byId = new Map<string, XUser>();
  let cursor: string | undefined;
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${BASE}/twitter/user/following_v2`);
    url.searchParams.set("userName", handle);
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await gxFetch(url.toString());
    if (res.status === 429) {
      truncated = true; // rate-limited mid-pull — keep what we have
      break;
    }
    if (!res.ok) {
      throw new Error(`getXAPI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as GxFollowingResp;
    const list: GxRawUser[] = Array.isArray(json.following)
      ? json.following
      : Array.isArray(json.users)
        ? json.users
        : Array.isArray(json.data)
          ? json.data
          : (json.data?.following ?? []);
    for (const u of list) {
      const m = mapUser(u);
      if (m.id && !byId.has(m.id)) byId.set(m.id, m);
    }
    if (byId.size >= MAX_FOLLOWS) {
      truncated = true;
      break;
    }
    if (!json.has_more || !json.next_cursor) break;
    cursor = json.next_cursor;
    if (page === MAX_PAGES - 1 && json.has_more) truncated = true;
  }
  return { users: [...byId.values()], truncated };
}

interface GxTweet {
  id: string | number;
  text?: string;
  createdAt?: string;
  lang?: string;
  retweetCount?: number;
  replyCount?: number;
  likeCount?: number;
  quoteCount?: number;
  bookmarkCount?: number;
  viewCount?: number | string;
  author?: GxRawUser;
}

interface GxSearchResp {
  tweets?: GxTweet[];
  has_more?: boolean;
  next_cursor?: string | null;
}

// Map a getXAPI tweet (+ inline author) onto our shared Tweet/XUser shapes.
function mapTweet(t: GxTweet): { tweet: Tweet; user?: XUser } {
  const a = t.author;
  return {
    tweet: {
      id: String(t.id),
      text: t.text ?? "",
      created_at: t.createdAt ?? "",
      author_id: a ? String(a.id) : "",
      public_metrics: {
        reply_count: t.replyCount ?? 0,
        retweet_count: t.retweetCount ?? 0,
        like_count: t.likeCount ?? 0,
        quote_count: t.quoteCount ?? 0,
        bookmark_count: t.bookmarkCount ?? 0,
        impression_count: Number(t.viewCount ?? 0),
      },
    },
    user: a ? mapUser(a) : undefined,
  };
}

const MAX_SEARCH_PAGES = 8; // advanced_search returns ~20 tweets/page

// Search tweets via getXAPI advanced_search (drop-in for the old X searchRecent).
// product "Top" = engagement-sorted (best for trending), "Latest" = chronological.
// Collects up to maxTweets within maxAgeMs; returns the same {tweets, users} shape.
export async function gxSearch(
  query: string,
  opts: { product?: "Top" | "Latest"; maxAgeMs?: number; maxTweets?: number } = {},
): Promise<{ tweets: Tweet[]; users: XUser[] }> {
  const product = opts.product ?? "Latest";
  const maxTweets = opts.maxTweets ?? 60;
  const maxAgeMs = opts.maxAgeMs;
  const now = Date.now();
  const tweets: Tweet[] = [];
  const users = new Map<string, XUser>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_SEARCH_PAGES && tweets.length < maxTweets; page++) {
    const url = new URL(`${BASE}/twitter/tweet/advanced_search`);
    url.searchParams.set("q", query);
    url.searchParams.set("product", product);
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await gxFetch(url.toString());
    if (res.status === 429) break;
    if (!res.ok) {
      throw new Error(`getXAPI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as GxSearchResp;
    const list = json.tweets ?? [];
    if (list.length === 0) break;
    for (const raw of list) {
      const { tweet, user } = mapTweet(raw);
      if (maxAgeMs && tweet.created_at) {
        const age = now - Date.parse(tweet.created_at);
        if (Number.isFinite(age) && age > maxAgeMs) continue; // outside the window
      }
      tweets.push(tweet);
      if (user && !users.has(user.id)) users.set(user.id, user);
      if (tweets.length >= maxTweets) break;
    }
    // Chronological "Latest": once a whole page is older than the window, stop.
    if (maxAgeMs && product === "Latest") {
      const pageAllOld = list.every((t) => {
        if (!t.createdAt) return false;
        const age = now - Date.parse(t.createdAt);
        return Number.isFinite(age) && age > maxAgeMs;
      });
      if (pageAllOld) break;
    }
    if (!json.has_more || !json.next_cursor) break;
    cursor = json.next_cursor;
  }
  return { tweets, users: [...users.values()] };
}
