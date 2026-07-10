import {
  action,
  internalAction,
  internalMutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { reportCron } from "./lib/cronReport";

/**
 * beehiiv → pipeline: a daily cron pulls the newsletter's latest posts and
 * seeds each unseen recent one as a thread idea in the content pipeline
 * (xPosts, status "idea") with title/subtitle/URL as source material for the
 * composer's Claude drafting. Every fetched id is marked seen — including old
 * ones on the first run — so the archive never backfills.
 *
 * Env (Convex): beehiiv_api_key, beehiiv_publication_id. No-ops until set.
 */

const RECENT_DAYS = 14; // only seed ideas for posts published in this window
const FETCH_LIMIT = 10;

interface BeehiivPost {
  id?: string;
  title?: string;
  subtitle?: string;
  preview_text?: string;
  web_url?: string;
  publish_date?: number; // unix seconds
  status?: string;
}

export const pullInternal = internalAction({
  args: {},
  returns: v.object({ status: v.string(), created: v.number() }),
  handler: async (ctx) => {
    const key = process.env.beehiiv_api_key;
    const pubId = process.env.beehiiv_publication_id;
    if (!key || !pubId) return { status: "no-config", created: 0 };

    try {
      const url =
        `https://api.beehiiv.com/v2/publications/${encodeURIComponent(pubId)}/posts` +
        `?limit=${FETCH_LIMIT}&order_by=publish_date&direction=desc&status=confirmed`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        throw new Error(
          `beehiiv ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as { data?: BeehiivPost[] };
      const posts = (json.data ?? []).filter((p) => p.id && p.title);

      const cutoff = Date.now() - RECENT_DAYS * 86_400_000;
      let created = 0;
      for (const p of posts) {
        const publishedMs = (p.publish_date ?? 0) * 1000;
        const wasCreated: boolean = await ctx.runMutation(
          internal.beehiiv.captureIdea,
          {
            postId: p.id as string,
            title: (p.title as string).slice(0, 200),
            subtitle: (p.subtitle || p.preview_text || "").slice(0, 1000),
            url: p.web_url ?? "",
            // Old posts are marked seen but never seeded as ideas.
            seedIdea: publishedMs > cutoff,
          },
        );
        if (wasCreated) created++;
      }

      // Refresh the public-site cache (archive + subscriber count) in the
      // same cron — the landing and /onlabel read this single row.
      const archive = await fetchArchive(key, pubId);
      const subscriberCount = await fetchSubscriberCount(key, pubId);
      await ctx.runMutation(internal.beehiiv.storeSite, {
        postsJson: JSON.stringify(archive),
        subscriberCount,
      });

      await reportCron(
        ctx,
        "beehiiv",
        true,
        `created=${created} archived=${archive.length} subs=${subscriberCount}`,
      );
      return { status: "ok", created };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await reportCron(ctx, "beehiiv", false, message);
      throw e;
    }
  },
});

// ---- Public site (lnkd.world landing + /onlabel) ---------------------------

export interface SitePost {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  publishedAt: number; // ms
}

const ARCHIVE_PAGE_LIMIT = 100;
const ARCHIVE_MAX_PAGES = 5; // 500 issues is years of runway

async function fetchArchive(key: string, pubId: string): Promise<SitePost[]> {
  const out: SitePost[] = [];
  for (let page = 1; page <= ARCHIVE_MAX_PAGES; page++) {
    const url =
      `https://api.beehiiv.com/v2/publications/${encodeURIComponent(pubId)}/posts` +
      `?limit=${ARCHIVE_PAGE_LIMIT}&page=${page}&order_by=publish_date&direction=desc&status=confirmed`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      throw new Error(`beehiiv posts ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: BeehiivPost[]; total_pages?: number };
    for (const p of json.data ?? []) {
      if (!p.id || !p.title || !p.web_url) continue;
      out.push({
        id: p.id,
        title: p.title.slice(0, 200),
        subtitle: (p.subtitle || p.preview_text || "").slice(0, 300),
        url: p.web_url,
        publishedAt: (p.publish_date ?? 0) * 1000,
      });
    }
    if (!json.total_pages || page >= json.total_pages) break;
  }
  return out;
}

async function fetchSubscriberCount(key: string, pubId: string): Promise<number> {
  const url =
    `https://api.beehiiv.com/v2/publications/${encodeURIComponent(pubId)}?expand[]=stats`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    throw new Error(`beehiiv stats ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: { stats?: { active_subscriptions?: number } };
  };
  return json.data?.stats?.active_subscriptions ?? 0;
}

export const storeSite = internalMutation({
  args: { postsJson: v.string(), subscriberCount: v.number() },
  returns: v.null(),
  handler: async (ctx, { postsJson, subscriberCount }) => {
    const existing = await ctx.db.query("beehiivSite").first();
    const patch = { postsJson, subscriberCount, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("beehiivSite", patch);
    return null;
  },
});

/** Public: the newsletter archive + subscriber count for the site. */
export const archive = query({
  args: {},
  returns: v.object({
    posts: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        subtitle: v.string(),
        url: v.string(),
        publishedAt: v.number(),
      }),
    ),
    subscriberCount: v.number(),
  }),
  handler: async (ctx) => {
    const row = await ctx.db.query("beehiivSite").first();
    if (!row) return { posts: [], subscriberCount: 0 };
    return {
      posts: JSON.parse(row.postsJson) as SitePost[],
      subscriberCount: row.subscriberCount,
    };
  },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Public: subscribe an email to On Label from the site. `company` is a
 * honeypot — humans never see the field, so a non-empty value gets a fake
 * success and no API call.
 */
export const subscribe = action({
  args: { email: v.string(), company: v.optional(v.string()) },
  returns: v.object({ ok: v.boolean(), error: v.optional(v.string()) }),
  handler: async (_ctx, { email, company }) => {
    if (company) return { ok: true };
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed) || trimmed.length > 254) {
      return { ok: false, error: "That doesn't scan as an email address." };
    }
    const key = process.env.beehiiv_api_key;
    const pubId = process.env.beehiiv_publication_id;
    if (!key || !pubId) {
      return { ok: false, error: "Signups are down — email me instead." };
    }
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${encodeURIComponent(pubId)}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmed,
          reactivate_existing: true,
          send_welcome_email: true,
          utm_source: "lnkd-world",
        }),
      },
    );
    if (!res.ok) {
      console.error(`beehiiv subscribe ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return { ok: false, error: "The printer jammed — try again in a minute." };
    }
    return { ok: true };
  },
});

/** Dedup-check, mark seen, and (for recent posts) create the thread idea. */
export const captureIdea = internalMutation({
  args: {
    postId: v.string(),
    title: v.string(),
    subtitle: v.string(),
    url: v.string(),
    seedIdea: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, { postId, title, subtitle, url, seedIdea }) => {
    const seen = await ctx.db
      .query("beehiivSeen")
      .withIndex("by_postId", (q) => q.eq("postId", postId))
      .first();
    if (seen) return false;
    await ctx.db.insert("beehiivSeen", { postId, createdAt: Date.now() });
    if (!seedIdea) return false;

    await ctx.db.insert("xPosts", {
      pillar: "health", // On Label is the health/longevity pillar
      status: "idea",
      kind: "thread", // newsletters repurpose best as threads
      body: title,
      sourceText: [subtitle, url].filter(Boolean).join("\n\n"),
      sourceUrl: url || undefined,
      source: `newsletter:${postId}`,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/** Admin: manual pull button. */
export const pull = action({
  args: {},
  returns: v.object({ status: v.string(), created: v.number() }),
  handler: async (ctx) => {
    await ctx.runQuery(internal.growth._assertAdmin, {});
    const result: { status: string; created: number } = await ctx.runAction(
      internal.beehiiv.pullInternal,
      {},
    );
    return result;
  },
});
