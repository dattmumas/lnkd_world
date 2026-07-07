/**
 * OAuth 1.0a user-context calls to the official X API v2 — the WRITE path
 * (getXAPI in lib/getxapi.ts stays the read path). Used by convex/xPoster.ts to
 * publish the account's own scheduled posts, which X's automation rules
 * explicitly allow. Signing is HMAC-SHA1 via Web Crypto (Convex default
 * runtime), no SDK.
 *
 * Env (Convex): x_consumer, x_consumer_secret, x_access, x_access_secret.
 */

const API = "https://api.x.com/2";

interface XCreds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
}

function creds(): XCreds {
  const consumerKey = process.env.x_consumer;
  const consumerSecret = process.env.x_consumer_secret;
  const accessToken = process.env.x_access;
  const accessSecret = process.env.x_access_secret;
  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) {
    throw new Error(
      "X write credentials missing (x_consumer / x_consumer_secret / x_access / x_access_secret).",
    );
  }
  return { consumerKey, consumerSecret, accessToken, accessSecret };
}

// RFC 3986 percent-encoding (encodeURIComponent misses !'()*).
function enc(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

async function hmacSha1(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(message),
  );
  let binary = "";
  for (const b of new Uint8Array(sig)) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Build the OAuth 1.0a Authorization header. JSON bodies never enter the
 * signature (form-encoded-only rule), but QUERY params must — merged into the
 * sorted parameter string while the base string keeps the bare URL. Callers
 * with query params must build the request URL via `queryString()` so the
 * bytes on the wire match the bytes signed (URLSearchParams would not:
 * it encodes space as "+").
 */
async function authHeader(
  method: string,
  url: string,
  queryParams?: Record<string, string>,
): Promise<string> {
  const c = creds();
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.consumerKey,
    oauth_nonce: Array.from(nonceBytes, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: c.accessToken,
    oauth_version: "1.0",
  };
  const all: Record<string, string> = { ...oauth, ...(queryParams ?? {}) };
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${enc(k)}=${enc(all[k])}`)
    .join("&");
  const base = `${method.toUpperCase()}&${enc(url)}&${enc(paramString)}`;
  const signingKey = `${enc(c.consumerSecret)}&${enc(c.accessSecret)}`;
  oauth.oauth_signature = await hmacSha1(signingKey, base);
  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${enc(k)}="${enc(oauth[k])}"`)
      .join(", ")
  );
}

/** Query string encoded exactly like the signature (RFC 3986, sorted). */
function queryString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");
}

export function officialCredsConfigured(): boolean {
  return !!(
    process.env.x_consumer &&
    process.env.x_consumer_secret &&
    process.env.x_access &&
    process.env.x_access_secret
  );
}

/** Post a tweet (optionally as a reply, for thread chaining). Returns the tweet id. */
export async function postTweet(
  text: string,
  inReplyToTweetId?: string,
): Promise<string> {
  const url = `${API}/tweets`;
  const body: Record<string, unknown> = { text };
  if (inReplyToTweetId) {
    body.reply = { in_reply_to_tweet_id: inReplyToTweetId };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: await authHeader("POST", url),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    detail?: string;
    title?: string;
    errors?: { message?: string }[];
  };
  if (!res.ok || !json.data?.id) {
    const why =
      json.detail ??
      json.errors?.[0]?.message ??
      json.title ??
      `HTTP ${res.status}`;
    throw new Error(`X post failed: ${why}`);
  }
  return json.data.id;
}

export interface OfficialTweetMetrics {
  id: string;
  public: {
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    bookmarks: number;
    views: number;
  };
  nonPublic?: {
    impressions: number;
    profileClicks: number;
    urlClicks: number;
  };
}

interface RawTweetsResp {
  data?: {
    id: string;
    public_metrics?: {
      like_count?: number;
      reply_count?: number;
      retweet_count?: number;
      quote_count?: number;
      bookmark_count?: number;
      impression_count?: number;
    };
    non_public_metrics?: {
      impression_count?: number;
      user_profile_clicks?: number;
      url_link_clicks?: number;
    };
  }[];
  detail?: string;
  title?: string;
}

async function getTweetsRaw(
  ids: string[],
  fields: string,
): Promise<{ res: Response; json: RawTweetsResp }> {
  const url = `${API}/tweets`;
  const params = { ids: ids.join(","), "tweet.fields": fields };
  const res = await fetch(`${url}?${queryString(params)}`, {
    headers: { Authorization: await authHeader("GET", url, params) },
  });
  const json = (await res.json().catch(() => ({}))) as RawTweetsResp;
  return { res, json };
}

/**
 * Metrics for OWN tweets via the official API (user context). Requests
 * non_public_metrics (impressions, profile clicks, link clicks) — which fails
 * the WHOLE request if any id isn't the authenticated user's or is >30 days
 * old — and retries public-only on a 400 so one stray id can't blank the pull.
 * Max 100 ids per call.
 */
export async function getTweets(ids: string[]): Promise<OfficialTweetMetrics[]> {
  if (ids.length === 0) return [];
  const batch = ids.slice(0, 100);
  let { res, json } = await getTweetsRaw(
    batch,
    "public_metrics,non_public_metrics",
  );
  if (res.status === 400) {
    ({ res, json } = await getTweetsRaw(batch, "public_metrics"));
  }
  if (!res.ok || !json.data) {
    throw new Error(
      `X tweets lookup failed: ${json.detail ?? json.title ?? `HTTP ${res.status}`}`,
    );
  }
  return json.data.map((t) => {
    const p = t.public_metrics ?? {};
    const np = t.non_public_metrics;
    return {
      id: t.id,
      public: {
        likes: p.like_count ?? 0,
        replies: p.reply_count ?? 0,
        reposts: p.retweet_count ?? 0,
        quotes: p.quote_count ?? 0,
        bookmarks: p.bookmark_count ?? 0,
        views: p.impression_count ?? 0,
      },
      nonPublic: np
        ? {
            impressions: np.impression_count ?? 0,
            profileClicks: np.user_profile_clicks ?? 0,
            urlClicks: np.url_link_clicks ?? 0,
          }
        : undefined,
    };
  });
}

/** Read-only credential check: GET /2/users/me under the same signature. */
export async function verifyCredentials(): Promise<{
  id: string;
  username: string;
}> {
  const url = `${API}/users/me`;
  const res = await fetch(url, {
    headers: { Authorization: await authHeader("GET", url) },
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string; username?: string };
    detail?: string;
    title?: string;
  };
  if (!res.ok || !json.data?.id) {
    throw new Error(
      `X credential check failed: ${json.detail ?? json.title ?? `HTTP ${res.status}`}`,
    );
  }
  return { id: json.data.id, username: json.data.username ?? "" };
}
