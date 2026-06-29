"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import crypto from "node:crypto";

/**
 * Mass-follow accounts discovered by the network tool (convex/network.ts), via
 * the X API write endpoint (POST /2/users/:id/following), authenticated with
 * OAuth 1.0a user context. Isolated in its own "use node" file because OAuth
 * signing uses Node's crypto (HMAC-SHA1) and this file exports only actions.
 *
 * Guardrails against X's aggressive-follow detection: a hard daily cap, a
 * per-run cap, ~2s pacing between calls, dedup against prior follows, and an
 * early stop on rate-limit (429). The UI also forces an explicit confirm.
 */

const DAILY_FOLLOW_CAP = 100; // max successful follows per UTC day (account safety)
const PER_RUN_CAP = 50; // max follows attempted in a single call
const PACE_MS = 2000; // delay between follow calls

interface Creds {
  consumer: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}

// RFC-3986 percent-encoding (encodeURIComponent leaves !*'() unescaped).
function pctEncode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

// Build the `Authorization: OAuth …` header for a request. For these v2
// endpoints there are no query params and the JSON body is not signed, so the
// signature base covers only the oauth_* params.
function oauthHeader(method: string, url: string, creds: Creds): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumer,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.token,
    oauth_version: "1.0",
  };
  const paramString = Object.keys(oauth)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(oauth[k])}`)
    .join("&");
  const baseString = [
    method.toUpperCase(),
    pctEncode(url),
    pctEncode(paramString),
  ].join("&");
  const signingKey = `${pctEncode(creds.consumerSecret)}&${pctEncode(creds.tokenSecret)}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");
  const signed: Record<string, string> = { ...oauth, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(signed)
      .sort()
      .map((k) => `${pctEncode(k)}="${pctEncode(signed[k])}"`)
      .join(", ")
  );
}

const UA = "lnkd-world-xfeed";

// Resolve the authenticated user's own id (the follow source).
async function getMe(creds: Creds): Promise<string> {
  const url = "https://api.x.com/2/users/me";
  const res = await fetch(url, {
    headers: { Authorization: oauthHeader("GET", url, creds), "User-Agent": UA },
  });
  if (!res.ok) {
    throw new Error(`X /me ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { id?: string } };
  if (!json.data?.id) throw new Error("Could not resolve authenticated user id.");
  return json.data.id;
}

interface FollowResult {
  ok: boolean;
  rateLimited?: boolean;
  detail?: string;
}

async function follow(
  meId: string,
  targetId: string,
  creds: Creds,
): Promise<FollowResult> {
  const url = `https://api.x.com/2/users/${meId}/following`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: oauthHeader("POST", url, creds),
      "Content-Type": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify({ target_user_id: targetId }),
  });
  if (res.status === 429) return { ok: false, rateLimited: true };
  if (!res.ok) {
    return { ok: false, detail: `${res.status}: ${(await res.text()).slice(0, 200)}` };
  }
  const json = (await res.json()) as {
    data?: { following?: boolean; pending_follow?: boolean };
  };
  const ok = json.data?.following === true || json.data?.pending_follow === true;
  return { ok, detail: JSON.stringify(json.data) };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const followAccounts = action({
  args: {
    targets: v.array(
      v.object({ id: v.string(), username: v.optional(v.string()) }),
    ),
  },
  returns: v.object({
    followed: v.number(),
    failed: v.number(),
    skipped: v.number(),
    stoppedEarly: v.boolean(),
    capRemaining: v.number(),
  }),
  handler: async (ctx, { targets }) => {
    await ctx.runQuery(internal.network._assertAdmin, {});

    const creds: Creds = {
      consumer: process.env.x_consumer ?? "",
      consumerSecret: process.env.x_consumer_secret ?? "",
      token: process.env.x_access ?? "",
      tokenSecret: process.env.x_access_secret ?? "",
    };
    if (!creds.consumer || !creds.consumerSecret || !creds.token || !creds.tokenSecret) {
      throw new Error(
        "X OAuth keys not configured (need x_consumer, x_consumer_secret, x_access, x_access_secret).",
      );
    }

    const { todayCount, followedIds } = await ctx.runQuery(
      internal.network.followStats,
      {},
    );
    const already = new Set(followedIds);
    const remainingToday = Math.max(DAILY_FOLLOW_CAP - todayCount, 0);

    const meId = await getMe(creds);
    already.add(meId);

    const results: {
      targetId: string;
      username?: string;
      status: string;
      detail?: string;
    }[] = [];
    let followed = 0;
    let failed = 0;
    let skipped = 0;
    let stoppedEarly = false;
    let attempted = 0;

    for (const t of targets) {
      if (already.has(t.id)) {
        skipped++;
        continue;
      }
      if (attempted >= PER_RUN_CAP || followed >= remainingToday) {
        stoppedEarly = true;
        break;
      }
      attempted++;
      const r = await follow(meId, t.id, creds);
      if (r.rateLimited) {
        stoppedEarly = true;
        break;
      }
      if (r.ok) {
        followed++;
        results.push({ targetId: t.id, username: t.username, status: "followed" });
      } else {
        failed++;
        results.push({
          targetId: t.id,
          username: t.username,
          status: "failed",
          detail: r.detail,
        });
      }
      await sleep(PACE_MS);
    }

    if (results.length) {
      await ctx.runMutation(internal.network.recordFollows, { results });
    }
    return {
      followed,
      failed,
      skipped,
      stoppedEarly,
      capRemaining: Math.max(remainingToday - followed, 0),
    };
  },
});
