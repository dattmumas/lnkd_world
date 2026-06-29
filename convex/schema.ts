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
  }).index("by_createdAt", ["createdAt"]),

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
  }).index("by_createdAt", ["createdAt"]),

  // A saved "follower web" built from 2+ seed handles (convex/network.ts):
  // the accounts the seeds follow, deduped and ranked by seed-overlap.
  networkRuns: defineTable({
    seeds: v.array(v.string()), // normalized seed handles
    status: v.string(), // "ok" | "empty" | "error"
    count: v.number(), // distinct accounts in the web
    // JSON: [{id,username,name,description,followers,overlap,seeds:[handle]}]
    accounts: v.string(),
    truncated: v.optional(v.boolean()), // a seed's following list hit the page cap
    error: v.optional(v.string()),
    generatedAt: v.string(),
    createdAt: v.string(),
  }).index("by_createdAt", ["createdAt"]),

  // Cache of a seed's following list (convex/network.ts) so rebuilding a web —
  // re-running the same seeds, or adding one — reuses paid-for pulls instead of
  // re-charging. Keyed by the seed's X user id; refreshed past the TTL.
  seedFollows: defineTable({
    seedId: v.string(), // the seed's X user id
    handle: v.string(), // normalized handle (for display)
    followsJson: v.string(), // JSON of full follow objects (id/username/name/followers/…)
    count: v.number(), // number of accounts followed
    truncated: v.boolean(), // the pull hit the page cap / a rate limit
    fetchedAt: v.string(), // ISO timestamp — drives TTL freshness
  })
    .index("by_seedId", ["seedId"])
    .index("by_fetchedAt", ["fetchedAt"]),

  // Log of accounts followed via the mass-follow action (convex/xFollow.ts) —
  // powers dedup (don't re-follow) and the daily-cap counter.
  xFollows: defineTable({
    targetId: v.string(),
    username: v.optional(v.string()),
    status: v.string(), // "followed" | "failed"
    detail: v.optional(v.string()), // error text on failure
    followedAt: v.string(),
  })
    .index("by_followedAt", ["followedAt"])
    .index("by_targetId", ["targetId"]),
});
