# LNKD (lnkd.world)

Personal site + private growth-operations system. Branding is **LNKD**. Two halves:

1. **Public site** — a ledger-style landing for applications + **On Label** (the Beehiiv newsletter, headless: lnkd.world is the front door, Beehiiv keeps only platform utilities — post pages, subscribe/unsub/preferences, referral attribution). On Label's beat is **all things consumer — CPG, health, and technology** (not just consumer health). Plus writing, reading log, bookmarks, resources, and the bond-market dashboard. Content is authored in Obsidian and synced to Convex.
2. **Growth system (admin-only)** — an X (Twitter) audience-growth machine: curated feeds, a unified engagement queue, an auto-poster, follower attribution, and a consumer deal radar. Runs on ~15 Convex crons. NO AI tweet/reply drafting anywhere — it was removed 2026-07-21 at the owner's request (never spend on drafting tweets); don't reintroduce it.

**Public identity ("stone register")**: bone `#F3F0E9`, ink `#141210`, stone mid-tones (`--color-stone*`), vermilion `#C7331D` demoted to an interaction/live signal only (link hovers, LIVE chips, live-data markers — never structure); Space Grotesk display / Space Mono data / Georgia body; zero border-radius. The one engraved surface is the footer's stone slab with the carved `LNKD` wordmark (`.ol-stone-field` / `.ol-carved`); the rest of the sheet stays flat. Tokens live in `app/globals.css` (`--color-*`, `ol-*` utilities). The On Label email template (`convex/dealsBlock.ts`) keeps its vermilion as the surviving brand thread. Admin keeps its scoped `gc-*` theme; /bonds keeps its dark terminal theme. The old 3D knowledge-graph hero is parked (components + `pnpm graph:layout` kept, unreferenced by the home page).

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Backend**: Convex (dev deployment: `perfect-ox-364` · **prod deployment: `steady-butterfly-270`**)
- **Auth**: `@convex-dev/auth` Password provider; password reset via Resend OTP
- **Deploy**: Cloudflare Workers via `@opennextjs/cloudflare` (custom domain `lnkd.world` in `wrangler.toml`)
- **3D/graph**: three.js + @react-three/fiber/drei, d3-force for layout
- **AI**: Anthropic API from Convex actions (drafting, curation, deal extraction, weekly review)
- **X data**: GetXAPI (`api.getxapi.com`) for cheap reads; official X API OAuth 1.0a for posting + own-tweet metrics

## Domain Setup

- **lnkd.world** — this project
- **blog.lnkd.world** — newsletter site (Ghost.org, untouched)

## Auth & Roles

- Admin email: `mttdumas@gmail.com` (role assigned in `convex/auth.ts` callback); everyone else is `subscriber`
- `middleware.ts` is a pass-through (`convexAuthNextjsMiddleware`) — it does NOT gate routes. Access is enforced client-side by `<AuthGuard>` and server-side by `requireAdmin`/`requireSubscriber` in `convex/lib/auth.ts`
- External sync mutations (Obsidian plugin, scripts) authenticate with `SYNC_SECRET` via `verifySyncSecret`

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Broadsheet landing: masthead (plain-ink wordmark), live wire ticker (`bonds.tenors` + `deals.landingSummary` + `readings.latest`), then The Lead (On Label) / The Wire (bonds + `projects` rows) / Markets (deal-flow column) band, and a Second Section of editorial columns (`posts`/`readings`/`bookmarks.latest`); footer is the carved stone slab. Landing reads purpose-built small queries, never the full content lists |
| `/onlabel`, `/onlabel/archive` | Public | On Label front door + full issue archive (reads `beehiiv.archive` cache; issue links open Beehiiv post pages) |
| `/writing`, `/writing/[slug]` | Public (posts can be gated) | Blog posts, markdown w/ wikilinks + backlinks |
| `/writing/[slug]/history` | Subscriber+ | Version-diff timeline for a post |
| `/reading` | Public | Reading log (books/articles/papers, ratings, tags) |
| `/bookmarks` | Public | Curated links |
| `/bonds` | Public | Bond-market terminal (snapshots pushed from an external Python pipeline) |
| `/deals` | Public | Deal Radar ledger on AG-Grid (`deals.publicList` — dataset minus operator surface) |
| `/resources` | Subscriber+ | Gated resources |
| `/subscribe`, `/forgot-password` | Public | Auth flows |
| `/growth` | — | Redirects to `/admin/growth` (preserves tab hash) |
| `/admin` | Admin | Dashboard hub |
| `/admin/posts` `/readings` `/bookmarks` `/resources` `/projects` | Admin | Content CRUD |
| `/admin/growth` | Admin | Growth dashboard — tabs: Overview, Queue, Deals, Pipeline, Analytics (hash deep-links) |
| `/admin/creators` | Admin | X watchlist manager (pillar, fast-poll, bulk ops, cost estimate) |
| `/admin/sources` | Admin | RSS/X source management + feed health (science, business, deals) |
| `/admin/network` | Admin | "Follower web" discovery from seed handles |

## Database (convex/schema.ts)

**Public content** (synced from Obsidian; wikilink/backlink fields throughout):
- `posts`, `readings`, `bookmarks` — slug-indexed content with `published`/`gated`/`featured`
- `versions` — content history per slug (hash-deduped, changeType)
- `now`, `resources`, `projects`, `graphLayout` (precomputed d3-force positions), `users` + auth tables

**Feeds → unified queue**:
- `feedItems` — one row per unique tweet/article across all feeds; dedup by `externalId` (`x:<id>` / `url:<link>`); priority = `baseScore × 2^(−age/halfLife) × affinityMult` (`convex/lib/queueScore.ts`)
- `itemActions` — insert-only event log (open/copy_draft/engaged/skipped/captured)
- `affinities` — per-author/per-source behavior counters, decayed daily (~30-day half-life)
- Snapshot tables per feed: `xTrendsSnapshots`, `creatorsSnapshots`, `earlySnapshots`, `scienceSnapshots`
- Dedup/seen markers: `seenXPosts`, `earlySeen`, `dealSeen`, `beehiivSeen`, `creatorTombstones`
- Source lists: `creators` (watchlist w/ pillar + fastPoll), `newsSources`, `bizSources`, `bizAccounts`, `dealSources`; `creatorsCache` (materialized active list, one doc read per poll)

**Growth / X posting**:
- `xPosts` — content pipeline kanban (idea→draft→scheduled→posted→archived; pillar: health/finance/startup; threads; autoPost; denormalized latest metrics). NOT the blog `posts` table
- `xPostMetrics` — daily metric snapshots per posted tweet (~14d tracked, 90d retained)
- `growthConfig` (tracked handle), `followerSnapshots` (full follower JSON), `followerCounts` (compact daily counts for the chart), `followerGains` (per-follower attribution rows)
- `ownReplies` — ground truth of every reply posted on X (hourly cron), feeds reply ROI + attribution
- `weeklyReviews` — Claude-written Sunday summaries; `growthSettings` — active-hours window + Telegram toggles (single row)
- `networkRuns`, `seedFollows` — follower-web runs + cached following lists (TTL)

**Deals**: `deals` — one row per (company, round), fused from RSS + X, Claude-extracted, status new/seen/dismissed; capture-time enrichment (founders + X handles, hqCountry, website, valuationUsd, totalRaisedUsd). `dealsBlocks` — weekly "WHO RAISED" newsletter HTML (last 8 kept)

**Infra**: `cronHealth` (per-cron last run/error, Telegram alerting), `bondsSnapshots` (JSON-stringified dashboard data)

## Convex Modules

- **Content**: `posts.ts`, `readings.ts`, `bookmarks.ts`, `resources.ts`, `projects.ts`, `now.ts`, `versions.ts`, `graph.ts`/`graphLayout.ts`, `seed.ts`, `stats.ts`
- **Feeds/queue**: `feedItems.ts` (upsertBatch + prune), `queue.ts` (getQueue/act/decayAffinities), `earlyFeed.ts` (5-min watchlist poll), `xTrends.ts`, `creators_feed.ts`, `scienceFeed.ts` (science+business columns, Sonnet-ranked), `dealsFeed.ts` + `deals.ts` (deal radar), `dealsBlock.ts` (weekly "WHO RAISED" newsletter block → Beehiiv Weekly Signal template's htmlSnippet, pushed via MCP or copied from the Deals tab)
- **Growth**: `growth.ts` (follower snapshots), `xPosts.ts` (pipeline), `xPoster.ts` (auto-poster), `xMetrics.ts`, `ownReplies.ts`, `weeklyReview.ts`, `attribution.ts`, `growthSettings.ts`, `network.ts`, `creators.ts` (watchlist + follow sync), `beehiiv.ts` (newsletter→ideas; also the public-site layer: `beehiivSite` archive/subscriber cache refreshed by the daily pull, public `archive` query + `subscribe` action for the landing and /onlabel)
- **Infra**: `crons.ts`, `cronHealth.ts`, `http.ts` (POST `/api/bonds/ingest`, SYNC_SECRET bearer), `auth.ts`, `users.ts`, `bonds.ts` (ingest + GitHub Actions dispatch trigger)
- **lib/**: `queueScore.ts` (decay + affinity math), `getxapi.ts` (gxSearch/gxUserTweets/gxFollowers — ~$0.001/call), `xoauth.ts` (postTweet/getTweets, OAuth 1.0a via Web Crypto), `xvoice.ts` (pillars + weekly-review prompt), `rss.ts`, `telegram.ts`, `auth.ts`, `cronReport.ts`

## Crons (convex/crons.ts)

- Every 5 min: `refresh-early` (active hours ONLY — off-hours ticks are no-ops; fast tier ~2 queries/cycle, full-watchlist sweep every 2h), `fire-scheduled-posts`
- Hourly: `deal-radar` (:20; RSS-only overnight), `track-own-replies`
- Daily: `prune-feed-items` 10:00, `decay-affinities` 10:15, `prune-deals` 10:05, `pull-beehiiv` 11:00, `growth-snapshot` 12:00, `pull-x-metrics` 12:30, `sync-follows` 12:45, `refresh-x-trends` 13:00, `refresh-creators` 13:30; `refresh-science` 3×/day (11,17,23 UTC)
- Weekly: `weekly-deals-block` Sunday 14:45 UTC, `weekly-review` Sunday 15:00 UTC

All crons report to `cronHealth` via `lib/cronReport.ts`; failures alert through Telegram (throttled). Cron times are staggered to avoid concurrent getXAPI calls.

## Convex Env Vars (set on the deployment, not in .env files)

- `anthropic_api_key` — all Claude calls
- `production` — GetXAPI key (yes, it's named "production")
- `x_consumer`, `x_consumer_secret`, `x_access`, `x_access_secret` — X OAuth 1.0a (posting + own metrics)
- `SYNC_SECRET` — Obsidian/script sync + bonds ingest
- Optional (graceful no-op): `telegram_bot_token`/`telegram_chat_id`, `beehiiv_api_key`/`beehiiv_publication_id`, `GITHUB_DISPATCH_TOKEN`/`GITHUB_REPO` (bonds rebuild), `resend_api`/`RESEND_FROM`, `public_site_url`

## Content Sync (Obsidian → Convex)

- `scripts/sync.ts` — parses vault markdown (frontmatter, wikilinks, mentions), upserts posts/readings/bookmarks/now, writes `versions` on content change; `--prod` targets prod
- `scripts/watch.ts` — debounced file watcher that runs sync
- `scripts/readwise-sync.ts` — Readwise → vault reading files
- `scripts/compute-layout.ts` — d3-force layout for the hero graph → `graphLayout`
- `obsidian-plugin/` — "LNKD Sync" Obsidian plugin (esbuild, has its own package.json + tests): live-syncs watched folders to Convex via CONVEX_URL + SYNC_SECRET

## Package Manager

**pnpm only.** Never use npm. All commands use `pnpm` (not `npm run`).

## Commands

```bash
pnpm dev             # Local dev server (Turbopack)
pnpm build           # Next.js production build
pnpm build:worker    # Build for Cloudflare Workers (required before deploy)
pnpm preview         # Local preview with Wrangler
pnpm run deploy      # Deploy to Cloudflare Workers — MUST use `run`; bare
                     # `pnpm deploy` hits pnpm's built-in workspace command
                     # and fails with ERR_PNPM_NOTHING_TO_DEPLOY
pnpm ship            # clean + build:worker + deploy
pnpm lint            # ESLint 9 flat config (eslint.config.mjs)
pnpm sync            # Sync Obsidian vault to Convex (dev); sync:prod for prod
pnpm graph:layout    # Recompute hero-graph layout (":prod" variant exists)
```

## Environment Files

| File | Loaded during | Contains |
|------|--------------|----------|
| `.env.production` | `pnpm build` / `pnpm ship` | `NEXT_PUBLIC_CONVEX_URL` (prod) |
| `.env.development.local` | `pnpm dev` | `NEXT_PUBLIC_CONVEX_URL` (dev) |
| `.env.local` | Always (secrets only) | `CONVEX_DEPLOYMENT`, `SYNC_SECRET`, sync script URLs |

**NEVER put `NEXT_PUBLIC_*` vars in `.env.local`** — it overrides `.env.production` during builds, which bakes the wrong Convex URL into production deploys.

## Verified Mistakes to Avoid

- **NEVER put `NEXT_PUBLIC_CONVEX_URL` in `.env.local`.** It overrides `.env.production` at build time and points the prod site at the dev database. This broke the live site on 2026-04-03. (Note: `npx convex dev` re-adds it — strip it afterward.)
- **NEVER run `npx convex deploy` without confirming the deployment target.** The Convex deploy pushes functions to prod. Careless deploys can break the live site's backend.
- **Cost discipline is a design constraint** in the feed/growth code: seen-marker tables instead of re-reading full docs, `creatorsCache` instead of `.collect()`, staggered crons, GetXAPI over the official API for reads. Don't add polling or `.collect()` loops casually.
- **GetXAPI budget is ~1,000 calls/day (30k/month).** The early feed is the dominant spender; its fast tier must stay ≤~30 accounts (`creators:retierFastPollInternal` re-tiers by affinity; the follow sync adds new creators as `fastPoll: false` — an unset `fastPoll` counts as FAST). In 2026-07 a 380-account fast tier + off-hours full sweeps burned ~5,000+ calls/day and drained the credits in days. The dev deployment has NO GetXAPI key (its 24/7 crons were burning ~100–200 calls/day) — re-set `production` on dev only while testing feeds, then remove it.

## Convex Notes

- `convex/` is excluded from the root `tsconfig.json` (has its own `convex/tsconfig.json`)
- Run `npx convex dev` in a separate terminal for local backend
- Feed pipelines all follow the same shape: gather (RSS/getXAPI) → rank/curate (Claude) → HTML snapshot table + `feedItems.upsertBatch` → served by the queue

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
