import {
  action,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { tweetIdFromLink } from "./lib/queueScore";
import {
  draftSystemPrompt,
  type Pillar,
  type VoiceProfileData,
} from "./lib/xvoice";
import { STALE_MS } from "./voiceProfile";

/**
 * The content pipeline for the tracked X account (growth dashboard, Pipeline
 * tab): idea → draft → scheduled → posted. Posting is HUMAN — the dashboard
 * surfaces due posts with copy + an X intent link; the user posts from a real
 * session and pastes the tweet URL back so metrics tracking (convex/xMetrics.ts)
 * can attach. Nothing here writes to X.
 */

const pillarValidator = v.union(
  v.literal("health"),
  v.literal("finance"),
  v.literal("startup"),
);
const editableStatus = v.union(v.literal("idea"), v.literal("draft"));
const kindValidator = v.union(v.literal("single"), v.literal("thread"));

/** Admin: the whole pipeline board (everything non-archived). */
export const board = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const ideas = await ctx.db
      .query("xPosts")
      .withIndex("by_status_scheduledAt", (q) => q.eq("status", "idea"))
      .order("desc")
      .take(100);
    const drafts = await ctx.db
      .query("xPosts")
      .withIndex("by_status_scheduledAt", (q) => q.eq("status", "draft"))
      .order("desc")
      .take(100);
    const scheduled = await ctx.db
      .query("xPosts")
      .withIndex("by_status_scheduledAt", (q) => q.eq("status", "scheduled"))
      .order("asc") // soonest due first
      .take(100);
    const posted = await ctx.db
      .query("xPosts")
      .withIndex("by_status_postedAt", (q) => q.eq("status", "posted"))
      .order("desc")
      .take(100);
    return [...ideas, ...drafts, ...scheduled, ...posted];
  },
});

/** Admin: archived posts, behind a toggle. */
export const archived = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("xPosts")
      .withIndex("by_status_scheduledAt", (q) => q.eq("status", "archived"))
      .order("desc")
      .take(100);
  },
});

export const create = mutation({
  args: {
    pillar: pillarValidator,
    kind: kindValidator,
    body: v.string(),
    threadParts: v.optional(v.array(v.string())),
    status: editableStatus,
    isEvergreen: v.optional(v.boolean()),
    source: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    autoPost: v.optional(v.boolean()),
    sourceText: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  returns: v.id("xPosts"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { scheduledAt, status, ...rest } = args;
    return await ctx.db.insert("xPosts", {
      ...rest,
      status: scheduledAt != null ? "scheduled" : status,
      scheduledAt: scheduledAt ?? undefined,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("xPosts"),
    pillar: v.optional(pillarValidator),
    kind: v.optional(kindValidator),
    body: v.optional(v.string()),
    threadParts: v.optional(v.array(v.string())),
    isEvergreen: v.optional(v.boolean()),
    sourceText: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { id, pillar, kind, body, threadParts, isEvergreen, sourceText, sourceUrl },
  ) => {
    await requireAdmin(ctx);
    const patch: Partial<Doc<"xPosts">> = { updatedAt: Date.now() };
    if (pillar !== undefined) patch.pillar = pillar;
    if (kind !== undefined) patch.kind = kind;
    if (body !== undefined) patch.body = body;
    if (isEvergreen !== undefined) patch.isEvergreen = isEvergreen;
    if (sourceText !== undefined) patch.sourceText = sourceText || undefined;
    if (sourceUrl !== undefined) patch.sourceUrl = sourceUrl || undefined;
    // threadParts: [] clears the field (single posts store no parts).
    if (threadParts !== undefined) {
      patch.threadParts = threadParts.length > 0 ? threadParts : undefined;
    }
    await ctx.db.patch(id, patch);
    return null;
  },
});

/** Kanban moves. Moving back off the calendar clears the schedule. */
export const setStatus = mutation({
  args: {
    id: v.id("xPosts"),
    status: v.union(
      v.literal("idea"),
      v.literal("draft"),
      v.literal("archived"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { id, status }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, {
      status,
      scheduledAt: undefined,
      postError: undefined,
      postedThreadIds: undefined, // moving off the calendar resets thread progress
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const schedule = mutation({
  args: {
    id: v.id("xPosts"),
    scheduledAt: v.number(),
    autoPost: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { id, scheduledAt, autoPost }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, {
      status: "scheduled",
      scheduledAt,
      autoPost,
      postError: undefined, // rescheduling clears a failed attempt
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * The human posted it on X. The tweet URL is optional but is what lets the
 * metrics cron attach public metrics — nudge for it in the UI.
 */
export const markPosted = mutation({
  args: { id: v.id("xPosts"), tweetUrl: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, tweetUrl }) => {
    await requireAdmin(ctx);
    const post = await ctx.db.get(id);
    if (!post) throw new Error("Post not found.");
    const url = tweetUrl?.trim() || undefined;
    const tweetId = url ? (tweetIdFromLink(url) ?? undefined) : undefined;
    await ctx.db.patch(id, {
      status: "posted",
      // Attaching a URL to an already-posted item keeps the original post time.
      postedAt: post.postedAt ?? Date.now(),
      tweetUrl: url ?? post.tweetUrl,
      tweetId: tweetId ?? post.tweetId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Duplicate an evergreen posted item as a fresh draft. */
export const recycle = mutation({
  args: { id: v.id("xPosts") },
  returns: v.id("xPosts"),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const post = await ctx.db.get(id);
    if (!post) throw new Error("Post not found.");
    return await ctx.db.insert("xPosts", {
      pillar: post.pillar,
      status: "draft",
      kind: post.kind,
      body: post.body,
      threadParts: post.threadParts,
      isEvergreen: true,
      source: `recycle:${id}`,
      updatedAt: Date.now(),
    });
  },
});

/** Evergreen posted items old enough to re-run (client passes day-rounded cutoff). */
export const recycleCandidates = query({
  args: { beforeMs: v.number() },
  handler: async (ctx, { beforeMs }) => {
    await requireAdmin(ctx);
    const posted = await ctx.db
      .query("xPosts")
      .withIndex("by_status_postedAt", (q) => q.eq("status", "posted"))
      .order("desc")
      .take(200);
    return posted.filter(
      (p) => p.isEvergreen && p.postedAt != null && p.postedAt < beforeMs,
    );
  },
});

export const remove = mutation({
  args: { id: v.id("xPosts") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const metrics = await ctx.db
      .query("xPostMetrics")
      .withIndex("by_post_fetchedAt", (q) => q.eq("postId", id))
      .take(200);
    for (const m of metrics) await ctx.db.delete(m._id);
    await ctx.db.delete(id);
    return null;
  },
});

/**
 * Turn a queue item into a pipeline idea without retiring it (you may still
 * reply). Logs a "captured" action and nudges the author/source affinity
 * "opened" counter — interest short of engagement.
 */
export const captureFromQueue = mutation({
  args: {
    itemId: v.id("feedItems"),
    pillar: v.optional(pillarValidator),
  },
  returns: v.id("xPosts"),
  handler: async (ctx, { itemId, pillar }) => {
    await requireAdmin(ctx);
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Queue item not found.");

    const inferredPillar =
      pillar ??
      (item.primaryFeed === "biz" ? ("finance" as const) : ("health" as const));
    const title = item.title ?? item.text.split("\n")[0].slice(0, 120);
    const sourceParts = [
      item.title,
      item.text !== item.title ? item.text : "",
      item.angle ? `Angle: ${item.angle}` : "",
      item.authorUsername ? `From @${item.authorUsername}` : `From ${item.source}`,
      item.link,
    ].filter(Boolean);

    const now = Date.now();
    const ideaId = await ctx.db.insert("xPosts", {
      pillar: inferredPillar,
      status: "idea",
      kind: "single",
      body: title,
      sourceText: sourceParts.join("\n\n").slice(0, 4000),
      sourceUrl: item.link,
      source: `queue:${item.externalId}`,
      updatedAt: now,
    });

    await ctx.db.insert("itemActions", {
      itemId,
      externalId: item.externalId,
      action: "captured",
      kind: item.kind,
      primaryFeed: item.primaryFeed,
      authorUsername: item.authorUsername,
      source: item.source,
      createdAt: now,
    });
    // Interest short of engagement — same treatment as open/copy_draft.
    const subjects: ["author" | "source", string][] = [];
    if (item.authorUsername) subjects.push(["author", item.authorUsername.toLowerCase()]);
    subjects.push(["source", item.source.toLowerCase()]);
    for (const [subjectType, subject] of subjects) {
      const row = await ctx.db
        .query("affinities")
        .withIndex("by_subject", (q) =>
          q.eq("subjectType", subjectType).eq("subject", subject),
        )
        .first();
      if (row) {
        await ctx.db.patch(row._id, { opened: row.opened + 1, updatedAt: now });
      } else {
        await ctx.db.insert("affinities", {
          subjectType,
          subject,
          engaged: 0,
          skipped: 0,
          opened: 1,
          updatedAt: now,
        });
      }
    }
    return ideaId;
  },
});

/** Internal: best posted bodies per pillar, for drafting few-shot. */
export const topPerformersInternal = internalQuery({
  args: { pillar: pillarValidator },
  returns: v.array(v.string()),
  handler: async (ctx, { pillar }) => {
    const posted = await ctx.db
      .query("xPosts")
      .withIndex("by_pillar_status", (q) =>
        q.eq("pillar", pillar).eq("status", "posted"),
      )
      .take(50);
    const score = (p: (typeof posted)[number]) =>
      27 * (p.latestReplies ?? 0) +
      15 * (p.latestQuotes ?? 0) +
      2 * (p.latestReposts ?? 0) +
      2 * (p.latestBookmarks ?? 0) +
      (p.latestLikes ?? 0);
    return posted
      .filter((p) => score(p) > 0)
      .sort((a, b) => score(b) - score(a))
      .slice(0, 3)
      .map((p) => p.body);
  },
});

/** Internal: posted-with-tweetId posts newer than `sinceMs`, for the metrics cron. */
export const recentPostedInternal = internalQuery({
  args: { sinceMs: v.number() },
  returns: v.array(v.object({ id: v.id("xPosts"), tweetId: v.string() })),
  handler: async (ctx, { sinceMs }) => {
    const posted = await ctx.db
      .query("xPosts")
      .withIndex("by_status_postedAt", (q) =>
        q.eq("status", "posted").gt("postedAt", sinceMs),
      )
      .take(100);
    return posted.flatMap((p) =>
      p.tweetId ? [{ id: p._id, tweetId: p.tweetId }] : [],
    );
  },
});

/**
 * Draft a post with Claude in the pillar's voice, few-shot on the account's own
 * best performers once there are any. Returns the draft for the composer — the
 * human reviews and saves; nothing is inserted here.
 */
export const draftWithClaude = action({
  args: {
    pillar: pillarValidator,
    kind: kindValidator,
    topic: v.string(),
    sourceMaterial: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      body: v.string(),
      threadParts: v.optional(v.array(v.string())),
      altHooks: v.optional(v.array(v.string())),
    }),
    v.null(),
  ),
  handler: async (ctx, { pillar, kind, topic, sourceMaterial }) => {
    await ctx.runQuery(internal.growth._assertAdmin, {});
    const key = process.env.anthropic_api_key;
    if (!key) throw new Error("anthropic_api_key is not set.");

    // Real-tweet grounding: refresh the pillar's voice profile when missing or
    // stale, then build the prompt from it (convex/voiceProfile.ts).
    let profileRow: { dataJson: string; refreshedAt: number } | null =
      await ctx.runQuery(internal.voiceProfile.getInternal, { pillar });
    if (!profileRow || Date.now() - profileRow.refreshedAt > STALE_MS) {
      try {
        await ctx.runAction(internal.voiceProfile.refreshInternal, { pillar });
        profileRow = await ctx.runQuery(internal.voiceProfile.getInternal, {
          pillar,
        });
      } catch (e) {
        console.error(
          `Voice refresh failed, drafting with stale/no profile: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    const profile: VoiceProfileData | null = profileRow
      ? (JSON.parse(profileRow.dataJson) as VoiceProfileData)
      : null;

    const topPerformers: string[] = await ctx.runQuery(
      internal.xPosts.topPerformersInternal,
      { pillar },
    );
    const system = draftSystemPrompt(pillar as Pillar, profile, topPerformers);
    const user = [
      kind === "thread"
        ? "Draft a THREAD (4-7 parts)."
        : "Draft a SINGLE post.",
      `Topic / angle: ${topic}`,
      sourceMaterial ? `Source material:\n"""${sourceMaterial}"""` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

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
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]) as {
        body?: string;
        threadParts?: string[];
        altHooks?: string[];
      };
      if (!parsed.body) return null;
      const altHooks = Array.isArray(parsed.altHooks)
        ? parsed.altHooks.map(String).filter((h) => h.length > 0 && h.length <= 280).slice(0, 3)
        : [];
      return {
        body: parsed.body,
        threadParts:
          Array.isArray(parsed.threadParts) && parsed.threadParts.length > 0
            ? parsed.threadParts.map(String)
            : undefined,
        altHooks: altHooks.length > 0 ? altHooks : undefined,
      };
    } catch {
      return null;
    }
  },
});
