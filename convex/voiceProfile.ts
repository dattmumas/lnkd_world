import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import { gxSearch, gxUserTweets } from "./lib/getxapi";
import { reportCron } from "./lib/cronReport";
import { weightedEngagement, type Tweet, type XUser } from "./lib/xfeed";
import {
  PILLARS,
  PILLAR_NICHE_QUERY,
  PILLAR_TOPIC,
  type Pillar,
  type VoiceExample,
  type VoiceProfileData,
} from "./lib/xvoice";

/**
 * Real-tweet voice grounding for post drafting (used by xPosts.draftWithClaude):
 * per pillar, cache the tracked account's own top posts (the voice anchor) and
 * the niche's current top performers (what actually earns reach right now).
 * Refreshed daily by cron; drafting refreshes inline when the cache is stale.
 */

const OWN_WINDOW_DAYS = 90; // the account's own top posts, engagement-ranked
const NICHE_WINDOW_DAYS = 14; // "current winners" — recent enough to reflect the meta
const EXAMPLES_PER_SECTION = 8;
const NICHE_CANDIDATES = 20; // pulled per pillar, then Claude-filtered for topic fit
const MAX_PER_AUTHOR = 2; // one loud account can't define the profile
export const STALE_MS = 7 * 24 * 3_600_000; // drafting refreshes past this

const pillarValidator = v.union(
  v.literal("health"),
  v.literal("finance"),
  v.literal("startup"),
);

function toExample(
  tweet: Tweet,
  user: XUser | undefined,
  includeAuthor: boolean,
): VoiceExample {
  const m = tweet.public_metrics;
  return {
    text: tweet.text.slice(0, 600),
    author: includeAuthor ? user?.username : undefined,
    followers: includeAuthor ? user?.public_metrics?.followers_count : undefined,
    likes: m.like_count,
    replies: m.reply_count,
    reposts: m.retweet_count,
    views: m.impression_count || undefined,
  };
}

// Engagement-ranked examples from a search, capped per author so one loud
// account can't define the whole voice profile.
async function topExamples(
  query: string,
  windowDays: number,
  includeAuthor: boolean,
  limit: number = EXAMPLES_PER_SECTION,
): Promise<VoiceExample[]> {
  const { tweets, users } = await gxSearch(query, {
    product: "Top",
    maxAgeMs: windowDays * 86_400_000,
    maxTweets: 60,
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const perAuthor = new Map<string, number>();
  const out: VoiceExample[] = [];
  for (const t of tweets.sort(
    (a, b) => weightedEngagement(b.public_metrics) - weightedEngagement(a.public_metrics),
  )) {
    const n = perAuthor.get(t.author_id) ?? 0;
    if (includeAuthor && n >= MAX_PER_AUTHOR) continue;
    perAuthor.set(t.author_id, n + 1);
    out.push(toExample(t, userById.get(t.author_id), includeAuthor));
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Viral-but-off-topic posts routinely top engagement searches (a lifestyle
 * banger from an SMB account is not a finance exemplar). One cheap Claude pass
 * keeps only genuinely on-topic posts; falls back to the engagement ranking if
 * the key is unset or the call fails.
 */
async function curateExamples(
  pillar: Pillar,
  candidates: VoiceExample[],
): Promise<VoiceExample[]> {
  const key = process.env.anthropic_api_key;
  if (!key || candidates.length <= EXAMPLES_PER_SECTION) {
    return candidates.slice(0, EXAMPLES_PER_SECTION);
  }
  const list = candidates
    .map((e, i) => `${i + 1}. (${e.likes} likes) ${e.text.replace(/\s+/g, " ").slice(0, 240)}`)
    .join("\n");
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: `These X posts will be used as writing exemplars for this topic: ${PILLAR_TOPIC[pillar]}\n\nKeep only posts genuinely about that topic. Reject lifestyle content, generic virality, rage-bait, and anything a reader wouldn't recognize as this niche. Output ONLY a JSON array of the post numbers to keep, best-fit first, up to ${EXAMPLES_PER_SECTION}.`,
        messages: [{ role: "user", content: list }],
      }),
    });
    if (!res.ok) return candidates.slice(0, EXAMPLES_PER_SECTION);
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return candidates.slice(0, EXAMPLES_PER_SECTION);
    const keep = (JSON.parse(match[0]) as number[])
      .map((n) => candidates[n - 1])
      .filter(Boolean)
      .slice(0, EXAMPLES_PER_SECTION);
    return keep.length > 0 ? keep : candidates.slice(0, EXAMPLES_PER_SECTION);
  } catch {
    return candidates.slice(0, EXAMPLES_PER_SECTION);
  }
}

export const storeInternal = internalMutation({
  args: { pillar: v.string(), dataJson: v.string() },
  returns: v.null(),
  handler: async (ctx, { pillar, dataJson }) => {
    const existing = await ctx.db
      .query("voiceProfiles")
      .withIndex("by_pillar", (q) => q.eq("pillar", pillar))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { dataJson, refreshedAt: Date.now() });
    } else {
      await ctx.db.insert("voiceProfiles", {
        pillar,
        dataJson,
        refreshedAt: Date.now(),
      });
    }
    return null;
  },
});

export const getInternal = internalQuery({
  args: { pillar: v.string() },
  returns: v.union(
    v.object({ dataJson: v.string(), refreshedAt: v.number() }),
    v.null(),
  ),
  handler: async (ctx, { pillar }) => {
    const row = await ctx.db
      .query("voiceProfiles")
      .withIndex("by_pillar", (q) => q.eq("pillar", pillar))
      .unique();
    return row ? { dataJson: row.dataJson, refreshedAt: row.refreshedAt } : null;
  },
});

/**
 * Refresh one pillar's profile (or all when `pillar` is omitted). The account's
 * own posts are pulled once and shared across pillars — they anchor the voice
 * regardless of topic; the niche winners are pillar-specific.
 */
export const refreshInternal = internalAction({
  args: { pillar: v.optional(pillarValidator) },
  returns: v.object({ status: v.string(), pillars: v.number() }),
  handler: async (ctx, { pillar }) => {
    const handle: string | null = await ctx.runQuery(
      internal.growth.handleInternal,
      {},
    );

    let ownPosts: VoiceExample[] = [];
    if (handle) {
      try {
        // Timeline read, not search — search omits small accounts entirely.
        const { tweets } = await gxUserTweets(handle, {
          maxAgeMs: OWN_WINDOW_DAYS * 86_400_000,
          maxTweets: 60,
        });
        ownPosts = tweets
          .sort(
            (a, b) =>
              weightedEngagement(b.public_metrics) - weightedEngagement(a.public_metrics),
          )
          .slice(0, EXAMPLES_PER_SECTION)
          .map((t) => toExample(t, undefined, false));
        console.log(
          `voiceProfile ownPosts @${handle}: timeline=${tweets.length} kept=${ownPosts.length}`,
        );
      } catch (e) {
        console.error(
          `Voice own-posts pull failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    const targets: Pillar[] = pillar ? [pillar] : PILLARS;
    let done = 0;
    for (const p of targets) {
      let nicheWinners: VoiceExample[] = [];
      try {
        const candidates = await topExamples(
          PILLAR_NICHE_QUERY[p],
          NICHE_WINDOW_DAYS,
          true,
          NICHE_CANDIDATES,
        );
        nicheWinners = await curateExamples(p, candidates);
      } catch (e) {
        console.error(
          `Voice niche pull failed (${p}): ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      if (ownPosts.length === 0 && nicheWinners.length === 0) continue; // keep old cache
      const data: VoiceProfileData = { ownPosts, nicheWinners };
      await ctx.runMutation(internal.voiceProfile.storeInternal, {
        pillar: p,
        dataJson: JSON.stringify(data),
      });
      done++;
    }
    await reportCron(ctx, "voice-profiles", done > 0, `pillars=${done}`);
    return { status: done > 0 ? "ok" : "empty", pillars: done };
  },
});

/** Admin: manual refresh (composer's "Refresh voice data" button). */
export const refresh = action({
  args: { pillar: v.optional(pillarValidator) },
  returns: v.object({ status: v.string(), pillars: v.number() }),
  handler: async (ctx, { pillar }) => {
    await ctx.runQuery(internal.growth._assertAdmin, {});
    const result: { status: string; pillars: number } = await ctx.runAction(
      internal.voiceProfile.refreshInternal,
      { pillar },
    );
    return result;
  },
});

/** Admin: per-pillar grounding status for the composer hint. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const out: Record<
      string,
      { ownPosts: number; nicheWinners: number; refreshedAt: number } | null
    > = {};
    for (const p of PILLARS) {
      const row = await ctx.db
        .query("voiceProfiles")
        .withIndex("by_pillar", (q) => q.eq("pillar", p))
        .unique();
      if (!row) {
        out[p] = null;
        continue;
      }
      const data = JSON.parse(row.dataJson) as VoiceProfileData;
      out[p] = {
        ownPosts: data.ownPosts.length,
        nicheWinners: data.nicheWinners.length,
        refreshedAt: row.refreshedAt,
      };
    }
    return out;
  },
});
