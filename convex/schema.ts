import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  projects: defineTable({
    title: v.string(),
    description: v.string(),
    href: v.string(),
    order: v.number(),
  }).index("by_order", ["order"]),

  users: defineTable({
    email: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("subscriber"))),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.float64()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.float64()),
    isAnonymous: v.optional(v.boolean()),
  }).index("by_email", ["email"])
    .index("by_token", ["tokenIdentifier"]),

  resources: defineTable({
    title: v.string(),
    description: v.string(),
    content: v.string(),
    published: v.boolean(),
  }),

  posts: defineTable({
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    wikilinksRaw: v.optional(v.array(v.string())),
    wikilinksResolved: v.optional(v.array(v.string())),
    wikilinksBroken: v.optional(v.array(v.string())),
    backlinks: v.optional(v.array(v.string())),
  })
    .index("by_slug", ["slug"])
    .index("by_published", ["published"]),

  readings: defineTable({
    title: v.string(),
    slug: v.string(),
    author: v.string(),
    type: v.string(),
    rating: v.optional(v.number()),
    content: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
    url: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    wikilinksRaw: v.optional(v.array(v.string())),
    wikilinksResolved: v.optional(v.array(v.string())),
    wikilinksBroken: v.optional(v.array(v.string())),
    backlinks: v.optional(v.array(v.string())),
  })
    .index("by_slug", ["slug"])
    .index("by_published", ["published"]),

  now: defineTable({
    content: v.string(),
    updatedAt: v.string(),
  }),

  bookmarks: defineTable({
    title: v.string(),
    slug: v.string(),
    url: v.string(),
    description: v.string(),
    tags: v.array(v.string()),
    published: v.boolean(),
    gated: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    wikilinksRaw: v.optional(v.array(v.string())),
    wikilinksResolved: v.optional(v.array(v.string())),
    wikilinksBroken: v.optional(v.array(v.string())),
    backlinks: v.optional(v.array(v.string())),
  })
    .index("by_slug", ["slug"])
    .index("by_published", ["published"]),

  versions: defineTable({
    slug: v.string(),
    contentType: v.union(v.literal("post"), v.literal("reading"), v.literal("bookmark")),
    contentHash: v.string(),
    content: v.string(),
    title: v.string(),
    changeType: v.optional(v.union(
      v.literal("edit"), v.literal("restructure"), v.literal("expand"), v.literal("restore")
    )),
    createdAt: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_slug_and_type", ["slug", "contentType"]),

  graphLayout: defineTable({
    layoutHash: v.string(),
    nodes: v.array(v.object({
      slug: v.string(),
      x: v.number(),
      y: v.number(),
    })),
    createdAt: v.string(),
  }),

  // Bond market analysis dashboard snapshots (pushed daily from Python pipeline)
  bondsSnapshots: defineTable({
    generatedAt: v.string(),
    version: v.string(),
    status: v.string(),
    data: v.string(), // JSON-stringified snapshot (too complex for Convex value types)
    createdAt: v.string(),
  }).index("by_createdAt", ["createdAt"]),

  // "Trending on X" snapshots — rendered HTML from the daily X API refresh
  // (convex/xTrends.ts). Served by feed.getPage for slug "x-trends".
  xTrendsSnapshots: defineTable({
    generatedAt: v.string(),
    html: v.string(),
    status: v.string(), // "ok" | "empty" | "error"
    count: v.number(),
    error: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  // Tweet IDs already surfaced in the Trending on X feed — excluded on refresh
  // so the same post isn't shown twice (convex/xTrends.ts). Pruned by age.
  seenXPosts: defineTable({
    tweetId: v.string(),
    createdAt: v.string(),
  })
    .index("by_tweetId", ["tweetId"])
    .index("by_createdAt", ["createdAt"]),

  // Admin-curated list of X creators for the "Creators" feed (convex/creators.ts).
  creators: defineTable({
    handle: v.string(), // X username, no leading @
    note: v.optional(v.string()),
    order: v.number(),
    active: v.optional(v.boolean()),
  }).index("by_order", ["order"]),

  // "Creators" feed snapshots — rendered HTML from the daily refresh
  // (convex/creators_feed.ts). Served by feed.getPage for slug "creators".
  creatorsSnapshots: defineTable({
    generatedAt: v.string(),
    html: v.string(),
    status: v.string(), // "ok" | "empty" | "error"
    count: v.number(),
    error: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  // "Early Engagement" snapshots — newest posts from the Creators list, refreshed
  // frequently (convex/earlyFeed.ts) so you can reply early. Served at "early".
  earlySnapshots: defineTable({
    generatedAt: v.string(),
    html: v.string(),
    posts: v.optional(v.string()), // JSON cards for the native /feed/early view
    status: v.string(), // "ok" | "empty" | "error"
    count: v.number(),
    error: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  // Admin-managed RSS sources for the Science News feed (convex/newsSources.ts).
  newsSources: defineTable({
    name: v.string(),
    url: v.string(), // RSS/Atom feed URL
    active: v.optional(v.boolean()),
    order: v.number(),
  }).index("by_order", ["order"]),

  // Last news-refresh per-source health (convex/scienceFeed.ts) — which sources
  // returned items vs failed/blocked. Single latest row; shown in /admin/sources.
  feedHealth: defineTable({
    data: v.string(), // JSON { checkedAt, sources:{url:{name,ok,items,error?}}, accounts:{handle:count} }
    checkedAt: v.string(),
  }).index("by_checkedAt", ["checkedAt"]),

  // General business RSS sources for the Business column (convex/bizSources.ts).
  bizSources: defineTable({
    name: v.string(),
    url: v.string(),
    active: v.optional(v.boolean()),
    order: v.number(),
  }).index("by_order", ["order"]),

  // Business X accounts whose posts feed the Business column (convex/bizAccounts.ts).
  bizAccounts: defineTable({
    handle: v.string(),
    note: v.optional(v.string()),
    active: v.optional(v.boolean()),
    order: v.number(),
  }).index("by_order", ["order"]),

  // "Science News" snapshots — now the combined two-column Science + Business feed
  // (convex/scienceFeed.ts). Served by feed.getPage for "science".
  scienceSnapshots: defineTable({
    generatedAt: v.string(),
    html: v.string(),
    status: v.string(), // "ok" | "empty" | "error"
    count: v.number(),
    error: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  // "Content Teardown" snapshots — top-performing posts from your list + niche
  // (convex/teardown.ts). Served by feed.getPage for slug "teardown".
  teardownSnapshots: defineTable({
    generatedAt: v.string(),
    html: v.string(),
    status: v.string(), // "ok" | "empty" | "error"
    count: v.number(),
    error: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  // A saved "follower web" built from 2+ seed handles (convex/network.ts):
  // the accounts the seeds follow, deduped and ranked by seed-overlap.
  networkRuns: defineTable({
    seeds: v.array(v.string()), // normalized seed handles
    mode: v.optional(v.string()), // "following" | "followers"
    excludeHandle: v.optional(v.string()), // "but not me" account, if set
    status: v.string(), // "ok" | "empty" | "error"
    count: v.number(), // distinct accounts in the web
    // JSON: [{id,username,name,description,followers,overlap,seeds:[handle]}]
    accounts: v.string(),
    truncated: v.optional(v.boolean()), // a seed's following list hit the page cap
    error: v.optional(v.string()),
    generatedAt: v.string(),
    createdAt: v.string(),
  }).index("by_createdAt", ["createdAt"]),

  // Which X account growth tracking follows (convex/growth.ts). Single row.
  growthConfig: defineTable({
    handle: v.string(), // the account whose follower growth we snapshot
    updatedAt: v.string(),
  }),

  // Daily snapshot of the tracked account's followers, for day-over-day diffs
  // (convex/growth.ts). Compact follower objects so we can show who joined/left.
  followerSnapshots: defineTable({
    handle: v.string(),
    followsJson: v.string(), // JSON [{id,username,name,followers}]
    count: v.number(),
    truncated: v.boolean(),
    fetchedAt: v.string(),
  }).index("by_fetchedAt", ["fetchedAt"]),

  // Cache of a seed's following list (convex/network.ts) so rebuilding a web —
  // re-running the same seeds, or adding one — reuses paid-for pulls instead of
  // re-charging. Keyed by the seed's X user id; refreshed past the TTL.
  seedFollows: defineTable({
    seedId: v.string(), // the seed's X user id
    handle: v.string(), // normalized handle (for display)
    kind: v.optional(v.string()), // "following" | "followers" (default following)
    followsJson: v.string(), // JSON of full connection objects (id/username/name/followers/…)
    count: v.number(), // number of accounts in the list
    truncated: v.boolean(), // the pull hit the page cap / a rate limit
    fetchedAt: v.string(), // ISO timestamp — drives TTL freshness
  })
    .index("by_seedId", ["seedId"])
    .index("by_fetchedAt", ["fetchedAt"]),
});
