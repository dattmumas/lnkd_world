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
    // Which pillar this account belongs to — reply drafts ground in this
    // pillar's voice profile; attribution groups by it. undefined = health.
    pillar: v.optional(
      v.union(v.literal("health"), v.literal("finance"), v.literal("startup")),
    ),
    // Fast poll = included in every 5-min early-feed cycle (true reply
    // targets). false = hourly sweep only (VC firms, outlets, low-priority).
    // undefined = fast, so existing rows keep their behavior.
    fastPoll: v.optional(v.boolean()),
    // News orgs are not reply targets: the early feed never polls them and
    // the engagement queue drops their tweets no matter which feed found them.
    newsOrg: v.optional(v.boolean()),
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
  // Unified engagement queue: normalized cross-feed candidates, one row per
  // unique tweet/article (convex/feedItems.ts). Every feed pipeline emits its
  // picks here in addition to its HTML snapshot; the queue (convex/queue.ts)
  // serves them priority-ordered. Ms-epoch timestamps (decay arithmetic).
  feedItems: defineTable({
    kind: v.union(v.literal("x-post"), v.literal("article")),
    externalId: v.string(), // "x:<tweetId>" | "url:<normalized link>" — dedup key
    sourceFeeds: v.array(v.string()), // feeds that emitted it — merged on dedup
    primaryFeed: v.string(), // feed whose scoring currently governs this row

    title: v.optional(v.string()), // articles only
    text: v.string(), // tweet text or article synopsis
    link: v.string(),
    imageUrl: v.optional(v.string()),
    source: v.string(), // RSS source name or "@handle"

    authorUsername: v.optional(v.string()), // lowercased, no @
    authorName: v.optional(v.string()),
    authorAvatar: v.optional(v.string()),
    authorFollowers: v.optional(v.number()),
    authorVerified: v.optional(v.boolean()),
    authorNiche: v.optional(v.string()),

    replies: v.optional(v.number()),
    reposts: v.optional(v.number()),
    likes: v.optional(v.number()),
    quotes: v.optional(v.number()),
    bookmarkCount: v.optional(v.number()),
    views: v.optional(v.number()),

    draft: v.optional(v.string()), // drafted tweet or reply from the models
    draftKind: v.optional(v.union(v.literal("reply"), v.literal("post"))),
    angle: v.optional(v.string()), // "why share" line (science feed)

    // priority = baseScore × 2^(−age/halfLife) × affinityMult (lib/queueScore.ts)
    baseScore: v.number(),
    halfLifeHours: v.number(),
    affinityMult: v.number(),
    scoreReason: v.string(), // human-readable "why it's here"

    status: v.union(
      v.literal("queued"),
      v.literal("engaged"),
      v.literal("skipped"),
      v.literal("expired"),
    ),
    publishedAt: v.number(), // decay anchor (falls back to first-seen when unknown)
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_status_publishedAt", ["status", "publishedAt"])
    .index("by_publishedAt", ["publishedAt"]),

  // Queue actions — insert-only event log (convex/queue.ts). Author/source are
  // denormalized so affinity aggregation never needs a join.
  itemActions: defineTable({
    itemId: v.id("feedItems"),
    externalId: v.string(),
    action: v.union(
      v.literal("open"),
      v.literal("copy_draft"),
      v.literal("engaged"),
      v.literal("skipped"),
      v.literal("captured"), // turned into a pipeline idea (item stays queued)
    ),
    kind: v.string(),
    primaryFeed: v.string(),
    authorUsername: v.optional(v.string()),
    source: v.string(),
    createdAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_action_createdAt", ["action", "createdAt"]),

  // Per-author / per-source behavior aggregates (convex/queue.ts) — smoothed
  // into a score multiplier by lib/queueScore.affinityMultiplier. Counters are
  // decayed daily (exponential forgetting) so old behavior fades.
  affinities: defineTable({
    subjectType: v.union(v.literal("author"), v.literal("source")),
    subject: v.string(), // lowercased handle or source name
    engaged: v.number(),
    skipped: v.number(),
    opened: v.number(),
    updatedAt: v.number(),
  }).index("by_subject", ["subjectType", "subject"]),

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

  // Content pipeline for the tracked X account (convex/xPosts.ts) — the growth
  // dashboard's kanban. NOT the blog `posts` table. Ms-epoch timestamps.
  xPosts: defineTable({
    pillar: v.union(v.literal("health"), v.literal("finance"), v.literal("startup")),
    status: v.union(
      v.literal("idea"),
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("posted"),
      v.literal("archived"),
    ),
    kind: v.union(v.literal("single"), v.literal("thread")),
    body: v.string(), // the tweet, or a thread's hook (part 1)
    threadParts: v.optional(v.array(v.string())), // parts 2..n
    scheduledAt: v.optional(v.number()),
    postedAt: v.optional(v.number()),
    tweetId: v.optional(v.string()),
    tweetUrl: v.optional(v.string()),
    isEvergreen: v.optional(v.boolean()),
    source: v.optional(v.string()), // "manual" | "claude" | "recycle:<id>"
    // Auto-posting (convex/xPoster.ts): scheduled posts fire via the X API
    // unless autoPost === false. undefined = on (the default when scheduling).
    autoPost: v.optional(v.boolean()),
    postError: v.optional(v.string()), // last API failure; cron skips until cleared
    postedThreadIds: v.optional(v.array(v.string())), // thread resume state: [root, part2, ...]
    // Captured source material (queue→idea, beehiiv) — prefills the composer.
    sourceText: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    // Latest public metrics, denormalized by the xMetrics snapshot so the board
    // and pillar comparison never join against the time series.
    latestLikes: v.optional(v.number()),
    latestReplies: v.optional(v.number()),
    latestReposts: v.optional(v.number()),
    latestQuotes: v.optional(v.number()),
    latestBookmarks: v.optional(v.number()),
    latestViews: v.optional(v.number()),
    // non_public_metrics (official X API, own tweets only). Profile clicks are
    // the strongest pre-follow signal.
    latestProfileClicks: v.optional(v.number()),
    latestUrlClicks: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_status_scheduledAt", ["status", "scheduledAt"])
    .index("by_status_postedAt", ["status", "postedAt"])
    .index("by_tweetId", ["tweetId"])
    .index("by_pillar_status", ["pillar", "status"]),

  // Daily public-metrics snapshots per posted xPost (convex/xMetrics.ts).
  // One row/post/day for ~14 days after posting; pruned past 90 days.
  xPostMetrics: defineTable({
    postId: v.id("xPosts"),
    tweetId: v.string(),
    fetchedAt: v.number(),
    likes: v.number(),
    replies: v.number(),
    reposts: v.number(),
    quotes: v.number(),
    bookmarks: v.number(),
    views: v.number(),
    profileClicks: v.optional(v.number()), // non_public_metrics, when available
    urlClicks: v.optional(v.number()),
  })
    .index("by_post_fetchedAt", ["postId", "fetchedAt"])
    .index("by_fetchedAt", ["fetchedAt"]),

  // Claude-written Sunday growth summaries (convex/weeklyReview.ts).
  weeklyReviews: defineTable({
    weekOf: v.string(), // ISO date of the run
    markdown: v.string(),
    statsJson: v.string(), // the computed inputs, for debugging/re-render
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  // Polling/notification settings for the growth system (convex/growthSettings.ts).
  // Single row. Fast (5-min) watchlist polling and Telegram pushes only run
  // inside the active-hours window; no row = legacy 20-min polling, no pushes.
  growthSettings: defineTable({
    activeStartHour: v.number(), // 0-23, local; start > end = overnight window
    activeEndHour: v.number(),
    tzOffsetMinutes: v.number(), // -new Date().getTimezoneOffset(), rewritten on save
    notifyEnabled: v.optional(v.boolean()), // default true
    notifyMinFollowers: v.optional(v.number()), // default 0 (whole watchlist)
    draftReplies: v.optional(v.boolean()), // AI reply drafts (early + trending); default OFF
    updatedAt: v.number(),
  }),

  // Attribution: one row per follower gained, persisted from the daily snapshot
  // diff (convex/growth.ts store). Joined against itemActions.authorUsername to
  // answer "which reply targets convert" (convex/attribution.ts).
  followerGains: defineTable({
    xUserId: v.string(),
    username: v.string(), // lowercased — matches itemActions.authorUsername
    name: v.string(),
    followers: v.number(),
    gainedAt: v.number(),
    day: v.string(), // "YYYY-MM-DD"
  })
    .index("by_gainedAt", ["gainedAt"])
    .index("by_username", ["username"]),

  // Ground truth of every reply the tracked account posts on X — on-system or
  // not (convex/ownReplies.ts, hourly cron). Feeds the daily reply counts,
  // reply ROI, and attribution; replies to self (thread parts) are excluded.
  ownReplies: defineTable({
    tweetId: v.string(), // the reply's own tweet id — dedup key
    repliedToUsername: v.optional(v.string()), // leading @mention, lowercased
    repliedToUserId: v.optional(v.string()), // exact join vs followerGains.xUserId
    inReplyToTweetId: v.optional(v.string()),
    text: v.string(),
    likes: v.optional(v.number()), // refreshed while the reply stays in the window
    views: v.optional(v.number()),
    createdAt: v.number(), // when the reply was posted (ms)
    firstSeenAt: v.number(),
  })
    .index("by_tweetId", ["tweetId"])
    .index("by_createdAt", ["createdAt"]),

  // Cron health — one row per cron name, upserted every run (convex/cronHealth.ts).
  // Powers the Overview health strip and throttled Telegram failure alerts.
  cronHealth: defineTable({
    name: v.string(),
    lastRunAt: v.number(),
    ok: v.boolean(),
    lastOkAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastErrorAt: v.optional(v.number()),
    lastAlertAt: v.optional(v.number()),
    meta: v.optional(v.string()),
  }).index("by_name", ["name"]),

  // Tweets the early feed has already emitted to the queue (convex/earlyFeed.ts).
  // Tiny marker docs — answering "is this new?" against these costs ~8KB/cycle
  // vs re-reading full feedItems docs (~50KB, twice). Pruned with feedItems.
  earlySeen: defineTable({
    tweetId: v.string(),
    createdAt: v.number(),
  })
    .index("by_tweetId", ["tweetId"])
    .index("by_createdAt", ["createdAt"]),

  // Materialized active-creator list (convex/creators.ts rebuildCache) — one
  // ~20KB doc read per 5-min poll instead of .collect()ing 400 full docs.
  creatorsCache: defineTable({
    json: v.string(), // [{handle, pillar?, fastPoll?}]
    updatedAt: v.number(),
  }),

  // Consumer Deal Radar: one row per unique (company, round) funding event
  // (convex/deals.ts), fused from RSS deal digests + X announcements
  // (convex/dealsFeed.ts). Multiple tellings of one deal merge into one row.
  deals: defineTable({
    company: v.string(), // display name as extracted
    companyKey: v.string(), // normalized for dedup (deals.ts normalizeCompanyKey)
    round: v.string(), // "pre-seed"|"seed"|"series-a".."series-e"|"growth"|"unknown"
    dedupKey: v.string(), // `${companyKey}|${round}`
    amountUsd: v.union(v.number(), v.null()), // null = undisclosed
    amountNote: v.optional(v.string()), // original figure if non-USD, e.g. "€12M"
    investors: v.array(v.string()),
    leadInvestor: v.optional(v.string()),
    category: v.string(), // consumer-health | wellness | cpg | consumer-fintech | ...
    isConsumer: v.boolean(),
    confidence: v.number(), // 0..1 from extraction
    summary: v.string(),
    companyDesc: v.optional(v.string()), // 1-line what-the-company-does
    leadDesc: v.optional(v.string()), // 1-line who-the-lead-VC-is
    // Capture-time enrichment (extraction provides these when the item states them)
    founders: v.optional(
      v.array(v.object({ name: v.string(), xHandle: v.optional(v.string()) })),
    ),
    hqCountry: v.optional(v.string()), // short name: "US", "UK", "India"
    website: v.optional(v.string()),
    valuationUsd: v.optional(v.number()),
    totalRaisedUsd: v.optional(v.number()),
    sources: v.array(v.object({ name: v.string(), url: v.string() })),
    announcementTweetId: v.optional(v.string()),
    // On-demand AI research report (deals.deepDive action): Claude + web
    // search, markdown. Admin-triggered per deal from the Deals tab.
    deepDive: v.optional(v.string()),
    deepDiveAt: v.optional(v.number()),
    deepDiveStatus: v.optional(
      v.union(v.literal("running"), v.literal("ok"), v.literal("error")),
    ),
    deepDiveError: v.optional(v.string()),
    status: v.union(v.literal("new"), v.literal("seen"), v.literal("dismissed")),
    notified: v.boolean(), // Telegram push sent (individually or in a digest)
    announcedAt: v.optional(v.number()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_dedupKey", ["dedupKey"])
    .index("by_companyKey", ["companyKey"])
    .index("by_firstSeenAt", ["firstSeenAt"])
    .index("by_isConsumer_firstSeenAt", ["isConsumer", "firstSeenAt"]),

  // Admin-managed RSS sources for the deal radar (convex/dealSources.ts).
  dealSources: defineTable({
    name: v.string(),
    url: v.string(),
    active: v.optional(v.boolean()),
    order: v.number(),
  }).index("by_order", ["order"]),

  // Candidate items already run through deal extraction (convex/dealsFeed.ts).
  // Hourly runs re-fetch overlapping windows; this makes them near-free.
  // Keyed like feedItems.externalId. Pruned at 14d.
  dealSeen: defineTable({
    externalId: v.string(),
    createdAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_createdAt", ["createdAt"]),

  // Weekly "WHO RAISED" newsletter block, rendered from deals every Sunday
  // (convex/dealsBlock.ts). Working buffer — last 8 weeks kept.
  dealsBlocks: defineTable({
    html: v.string(),
    dealCount: v.number(),
    generatedAt: v.number(),
  }).index("by_generatedAt", ["generatedAt"]),

  // Creators explicitly removed by the admin (convex/creators.ts) — the follow
  // sync must not resurrect them. Re-adding by hand clears the tombstone.
  creatorTombstones: defineTable({
    handle: v.string(),
    createdAt: v.number(),
  }).index("by_handle", ["handle"]),

  // beehiiv posts already turned into ideas (convex/beehiiv.ts) — dedup.
  beehiivSeen: defineTable({
    postId: v.string(),
    createdAt: v.number(),
  }).index("by_postId", ["postId"]),

  // Public-site cache of the On Label newsletter (convex/beehiiv.ts): the
  // confirmed-post archive + subscriber count, refreshed by the daily
  // pull-beehiiv cron. Single row, JSON payload (bondsSnapshots pattern) —
  // the landing and /onlabel pages read it with one doc read.
  beehiivSite: defineTable({
    postsJson: v.string(), // [{id,title,subtitle,url,publishedAt}]
    subscriberCount: v.number(),
    updatedAt: v.number(),
  }),

  // Real-tweet voice grounding for post drafting (convex/voiceProfile.ts):
  // per pillar, the account's own top posts + the niche's current winners,
  // refreshed daily. draftWithClaude builds its prompt from these instead of
  // hand-written style rules.
  voiceProfiles: defineTable({
    pillar: v.string(),
    dataJson: v.string(), // { ownPosts: [...], nicheWinners: [...] }
    refreshedAt: v.number(),
  }).index("by_pillar", ["pillar"]),

  // Compact daily follower counts for the growth chart (convex/growth.ts).
  // followerSnapshots rows carry the full follower list JSON (hundreds of KB),
  // so the chart reads this one-tiny-row-per-day table instead.
  followerCounts: defineTable({
    handle: v.string(),
    count: v.number(),
    fetchedAt: v.string(), // ISO, matches followerSnapshots.fetchedAt
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
