import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import { type RankedPost, type XUser } from "./lib/xfeed";
import { gxSearch } from "./lib/getxapi";
import { earlyBaseScore, externalIdFor, HALF_LIFE_HOURS } from "./lib/queueScore";
import {
  suggestReplyGrounded,
  type Pillar,
  type VoiceProfileData,
} from "./lib/xvoice";
import { escapeHtml, sendTelegram, siteUrl, telegramConfigured } from "./lib/telegram";
import { reportCron } from "./lib/cronReport";
import { inActiveHours, type GrowthSettings } from "./growthSettings";

/**
 * "Early Engagement" — the newest posts from your Creators watchlist, polled
 * fast (5-min cron via `tick`, active hours ONLY — off-hours ticks are skipped
 * entirely) so you can reply early: the most reliable organic-reach lever
 * on X. During active hours, fresh posts get a voice-grounded reply draft and
 * the hottest new ones push to Telegram. Served by feed.getPage for "early".
 *
 * getXAPI budget: this feed is the system's dominant API spend. Fast tier is
 * kept to ~30 high-affinity accounts (creators.retierFastPollInternal); the
 * full watchlist joins only the every-2-hours sweep. ~450 calls/day total.
 */

const WINDOW_MIN = 120; // surface posts from the last 2 hours
const MAX_AGE_MS = WINDOW_MIN * 60 * 1000;
const HANDLES_PER_QUERY = 15; // keep the `from:` query under the length limit
const TOP_N = 40;
const DRAFT_MAX_AGE_MIN = 45; // only draft replies for posts still in the window
const DRAFTS_PER_RUN = 8; // Anthropic cost cap per refresh
const NOTIFY_PER_RUN = 3; // Telegram anti-spam cap

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const refreshInternal = internalAction({
  args: {
    drafts: v.optional(v.boolean()), // generate reply drafts for fresh items
    notify: v.optional(v.boolean()), // Telegram-push the hottest new items
    includeSlow: v.optional(v.boolean()), // hourly sweep: poll slow-tier accounts too
  },
  returns: v.object({ status: v.string(), count: v.number() }),
  handler: async (ctx, { drafts, notify, includeSlow }) => {
    const generatedAt = new Date().toISOString();
    const nowMs = Date.now();
    try {
      const creatorList: {
        handle: string;
        pillar?: Pillar;
        fastPoll?: boolean;
        newsOrg?: boolean;
      }[] = (await ctx.runQuery(internal.creators.activeCreators, {}))
        // News orgs are never reply targets — don't spend getXAPI calls on them.
        // (queue.getQueue also drops their tweets arriving via any other feed.)
        .filter((c) => !c.newsOrg);
      // Fast-poll accounts ride every cycle; slow-tier (fastPoll === false —
      // VC firms, outlets) only join the every-2-hours full sweep. Cost control.
      const polled = includeSlow
        ? creatorList
        : creatorList.filter((c) => c.fastPoll !== false);
      const handles = polled.map((c) => c.handle);
      const pillarByHandle = new Map(
        creatorList.map((c) => [c.handle, c.pillar ?? ("health" as Pillar)]),
      );
      console.log(
        `earlyFeed poll: ${handles.length}/${creatorList.length} accounts (${includeSlow ? "full sweep" : "fast tier"})`,
      );
      if (handles.length === 0) {
        await ctx.runMutation(internal.earlyFeed.store, {
          generatedAt,
          html: "",
          status: "empty",
          count: 0,
        });
        return { status: "empty", count: 0 };
      }

      const byId = new Map<string, RankedPost>();
      const userById = new Map<string, XUser>();
      const groups = chunk(handles, HANDLES_PER_QUERY);
      let groupFailures = 0;
      for (const group of groups) {
        const q = `(${group.map((h) => `from:${h}`).join(" OR ")}) -is:retweet -is:reply lang:en`;
        let tweets, users;
        try {
          ({ tweets, users } = await gxSearch(q, {
            product: "Latest", // chronological — we want the freshest posts
            maxAgeMs: MAX_AGE_MS,
            maxTweets: 60,
          }));
        } catch (err) {
          groupFailures++;
          console.error(
            `Early query failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
        for (const u of users) userById.set(u.id, u);
        for (const t of tweets) {
          if (byId.has(t.id)) continue;
          // score = recency; render order is newest-first.
          byId.set(t.id, {
            tweet: t,
            user: userById.get(t.author_id),
            W: 0,
            score: Date.parse(t.created_at) || 0,
          });
        }
      }
      if (groups.length > 0 && groupFailures === groups.length) {
        throw new Error(`All ${groups.length} getXAPI search queries failed.`);
      }

      const picked = [...byId.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_N);

      // Snapshot rows are timestamps + health only now (the feed page is gone);
      // rendering/storing HTML here was pure write bandwidth.
      const cards = picked
        .map((p) => {
          const u = p.user;
          const m = p.tweet.public_metrics;
          return {
            tweetId: p.tweet.id,
            text: p.tweet.text,
            createdAt: p.tweet.created_at,
            username: u?.username ?? "",
            name: u?.name ?? "",
            avatar: u?.profile_image_url ?? "",
            media: p.tweet.media_url ?? "",
            followers: u?.public_metrics?.followers_count ?? 0,
            verified: !!u?.verified,
            permalink: u
              ? `https://x.com/${u.username}/status/${p.tweet.id}`
              : `https://x.com/i/status/${p.tweet.id}`,
            replies: m.reply_count,
            reposts: m.retweet_count,
            likes: m.like_count,
            views: m.impression_count ?? 0,
          };
        })
        .filter((c) => c.username);
      const status = picked.length > 0 ? "ok" : "empty";
      await ctx.runMutation(internal.earlyFeed.store, {
        generatedAt,
        html: "",
        status,
        count: picked.length,
      });

      // "Genuinely new" detection via the tiny earlySeen marker table — point
      // reads on 200-byte docs instead of re-reading full queue rows every
      // cycle (this was the hottest read path in the system).
      const seenSet = new Set<string>(
        await ctx.runQuery(internal.earlyFeed.seenTweets, {
          tweetIds: cards.map((c) => c.tweetId),
        }),
      );
      const isNew = (c: (typeof cards)[number]) => !seenSet.has(c.tweetId);
      const newCards = cards.filter(isNew);

      // Voice-grounded reply drafts for the freshest NEW items (best-effort).
      const draftByTweetId = new Map<string, string>();
      if (drafts) {
        try {
          const candidates = newCards
            .filter(
              (c) =>
                nowMs - (Date.parse(c.createdAt) || 0) < DRAFT_MAX_AGE_MIN * 60_000,
            )
            .sort((a, b) => b.followers - a.followers)
            .slice(0, DRAFTS_PER_RUN);

          // Load each needed pillar profile once (no inline refresh — the
          // daily cron keeps them warm; missing profile just means no anchor).
          const profileByPillar = new Map<Pillar, VoiceProfileData | null>();
          for (const c of candidates) {
            const pillar = pillarByHandle.get(c.username.toLowerCase()) ?? "health";
            if (!profileByPillar.has(pillar)) {
              const row: { dataJson: string } | null = await ctx.runQuery(
                internal.voiceProfile.getInternal,
                { pillar },
              );
              profileByPillar.set(
                pillar,
                row ? (JSON.parse(row.dataJson) as VoiceProfileData) : null,
              );
            }
          }

          await Promise.all(
            candidates.map(async (c) => {
              const pillar = pillarByHandle.get(c.username.toLowerCase()) ?? "health";
              const reply = await suggestReplyGrounded(
                c.text,
                { username: c.username, followers: c.followers },
                profileByPillar.get(pillar) ?? null,
              );
              if (reply) draftByTweetId.set(c.tweetId, reply);
            }),
          );
        } catch (err) {
          console.error(
            `Early draft generation failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // Emit into the unified queue (best-effort — never sinks the feed).
      // Only NEW items each cycle; known items get their metrics refreshed on
      // the every-2-hours full sweep — re-emitting all 40 every 5 minutes was
      // pure read/write bandwidth for cosmetic like-count updates.
      const emitCards = includeSlow ? cards : newCards;
      try {
        await ctx.runMutation(internal.feedItems.upsertBatch, {
          items: emitCards.map((c) => ({
            kind: "x-post" as const,
            externalId: externalIdFor("x-post", c.tweetId),
            feed: "early",
            text: c.text,
            link: c.permalink,
            imageUrl: c.media || undefined,
            source: "@" + c.username,
            authorUsername: c.username.toLowerCase(),
            authorName: c.name,
            authorAvatar: c.avatar || undefined,
            authorFollowers: c.followers,
            authorVerified: c.verified,
            replies: c.replies,
            reposts: c.reposts,
            likes: c.likes,
            views: c.views,
            draft: draftByTweetId.get(c.tweetId),
            draftKind: draftByTweetId.has(c.tweetId) ? ("reply" as const) : undefined,
            baseScore: earlyBaseScore(c.followers),
            halfLifeHours: HALF_LIFE_HOURS.early,
            scoreReason: `Fresh from @${c.username} — reply window open`,
            publishedAt: Date.parse(c.createdAt) || 0,
          })),
        });
        // Mark only after a successful emit — a failed upsert must retry next cycle.
        if (newCards.length > 0) {
          await ctx.runMutation(internal.earlyFeed.markSeenTweets, {
            tweetIds: newCards.map((c) => c.tweetId),
          });
        }
      } catch (err) {
        console.error(
          `Early queue emit failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Telegram-push the hottest genuinely-new items (best-effort).
      if (notify && telegramConfigured()) {
        try {
          const settings = await ctx.runQuery(internal.growthSettings.getInternal, {});
          const minFollowers = settings?.notifyMinFollowers ?? 0;
          const hot = newCards
            .filter((c) => c.followers >= minFollowers)
            .sort((a, b) => b.followers - a.followers)
            .slice(0, NOTIFY_PER_RUN);
          for (const c of hot) {
            const ageMin = Math.max(
              Math.round((nowMs - (Date.parse(c.createdAt) || nowMs)) / 60_000),
              1,
            );
            const draft = draftByTweetId.get(c.tweetId);
            const dash = siteUrl();
            const lines = [
              `🎯 <b>@${escapeHtml(c.username)}</b> · ${c.followers.toLocaleString()} followers · ${ageMin}m ago`,
              escapeHtml(c.text.slice(0, 300)),
              draft ? `\n💬 <i>${escapeHtml(draft.slice(0, 300))}</i>` : "",
              `\n<a href="${c.permalink}">Open on X</a>${dash ? ` · <a href="${dash}/admin/growth#queue">Queue</a>` : ""}`,
            ].filter(Boolean);
            await sendTelegram(lines.join("\n"));
          }
        } catch (err) {
          console.error(
            `Early notify failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      await reportCron(
        ctx,
        "early-feed",
        true,
        `count=${picked.length} polled=${handles.length}${includeSlow ? "" : " fastOnly"}`,
      );
      return { status, count: picked.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.earlyFeed.store, {
        generatedAt,
        html: "",
        status: "error",
        count: 0,
        error: message,
      });
      await reportCron(ctx, "early-feed", false, message);
      throw new Error(`Early feed refresh failed: ${message}`);
    }
  },
});

/** Internal: which of these tweets were already emitted (200-byte point reads). */
export const seenTweets = internalQuery({
  args: { tweetIds: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, { tweetIds }) => {
    const out: string[] = [];
    for (const tweetId of tweetIds.slice(0, 100)) {
      const row = await ctx.db
        .query("earlySeen")
        .withIndex("by_tweetId", (q) => q.eq("tweetId", tweetId))
        .first();
      if (row) out.push(tweetId);
    }
    return out;
  },
});

export const markSeenTweets = internalMutation({
  args: { tweetIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { tweetIds }) => {
    const now = Date.now();
    for (const tweetId of tweetIds.slice(0, 100)) {
      const existing = await ctx.db
        .query("earlySeen")
        .withIndex("by_tweetId", (q) => q.eq("tweetId", tweetId))
        .first();
      if (!existing) await ctx.db.insert("earlySeen", { tweetId, createdAt: now });
    }
    return null;
  },
});

/**
 * The 5-min cron entry: refresh fast (with drafts + notifications) inside the
 * configured active hours; outside them (or with no settings row) the tick is
 * a no-op. Off-hours polling was ~1,000 getXAPI calls/day for posts whose 2h
 * reply window would be dead before morning — posts from the 2h before the
 * window opens are still picked up by the first active tick.
 */
export const tick = internalAction({
  args: {},
  returns: v.object({ ran: v.boolean(), active: v.boolean() }),
  handler: async (ctx): Promise<{ ran: boolean; active: boolean }> => {
    const nowMs = Date.now();
    const settings: GrowthSettings | null = await ctx.runQuery(
      internal.growthSettings.getInternal,
      {},
    );
    const active: boolean = settings != null && inActiveHours(settings, nowMs);
    if (!active) return { ran: false, active };
    const notifyEnabled = settings?.notifyEnabled !== false;
    const draftReplies = settings?.draftReplies === true; // opt-in (Anthropic spend)
    // Slow-tier accounts join a full sweep every 2 hours (the first tick of
    // even UTC hours). The early window is 2h, so back-to-back sweeps still
    // see every post; halving sweep frequency halves the biggest search bill.
    const now = new Date(nowMs);
    const includeSlow = now.getUTCMinutes() < 5 && now.getUTCHours() % 2 === 0;
    const _result: { status: string; count: number } = await ctx.runAction(
      internal.earlyFeed.refreshInternal,
      { drafts: draftReplies, notify: notifyEnabled, includeSlow },
    );
    return { ran: true, active };
  },
});

/** Store a snapshot, pruning to the last 14. */
export const store = internalMutation({
  args: {
    generatedAt: v.string(),
    html: v.string(),
    posts: v.optional(v.string()),
    status: v.string(),
    count: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Keep the last 3 snapshots, but never prune the most recent "ok" one —
    // feed health reads it, so a run of failed refreshes must not delete it.
    const all = await ctx.db
      .query("earlySnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
    const latestOkId = [...all].reverse().find((s) => s.status === "ok")?._id;
    for (const snap of all
      .slice(0, Math.max(0, all.length - 3))
      .filter((s) => s._id !== latestOkId)) {
      await ctx.db.delete(snap._id);
    }
    return await ctx.db.insert("earlySnapshots", {
      generatedAt: args.generatedAt,
      html: args.html,
      posts: args.posts,
      status: args.status,
      count: args.count,
      error: args.error,
      createdAt: new Date().toISOString(),
    });
  },
});

export const _assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

/** Admin-only manual refresh (the cron handles frequent runs). */
export const refresh = action({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.string(), count: v.number() }),
  handler: async (ctx) => {
    const _admin: null = await ctx.runQuery(internal.earlyFeed._assertAdmin, {});
    const settings: GrowthSettings | null = await ctx.runQuery(
      internal.growthSettings.getInternal,
      {},
    );
    const result: { status: string; count: number } = await ctx.runAction(
      internal.earlyFeed.refreshInternal,
      { drafts: settings?.draftReplies === true, notify: false, includeSlow: true },
    );
    return { ok: true, status: result.status, count: result.count };
  },
});
