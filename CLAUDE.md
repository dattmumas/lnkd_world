# LNKD (lnkd.world)

Personal site focused on philosophy and politics. Branding is **LNKD**.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Backend**: Convex (deployment: `perfect-ox-364`)
- **Auth**: `@convex-dev/auth` with Password provider (email/password)
- **Deploy**: Cloudflare Workers via `@opennextjs/cloudflare`
- **DNS**: Cloudflare

## Domain Setup

- **lnkd.world** — Personal homepage (this project)
- **blog.lnkd.world** — Newsletter/publishing site (Ghost.org, untouched)

## Auth & Roles

- Admin email: `mttdumas@gmail.com` (auto-assigned on first sign-up)
- Everyone else gets `subscriber` role
- Role hierarchy: admin > subscriber
- `EnsureUser` component in provider auto-creates user record after auth
- Auth guard uses `Authenticated/Unauthenticated/AuthLoading` from `convex/react`

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Hero + dynamic links from Convex |
| `/subscribe` | Public | Email/password sign-up for subscribers |
| `/resources` | Subscriber+ | Gated content (expandable list) |
| `/admin` | Admin | Dashboard with links to management pages |
| `/admin/links` | Admin | CRUD for homepage links |
| `/admin/resources` | Admin | CRUD for subscriber resources |

## Package Manager

**pnpm only.** Never use npm. All commands use `pnpm` (not `npm run`).

## Commands

```bash
pnpm dev             # Local dev server (Turbopack)
pnpm build           # Next.js production build
pnpm build:worker    # Build for Cloudflare Workers
pnpm preview         # Local preview with Wrangler
pnpm deploy          # Deploy to Cloudflare Workers
pnpm lint            # ESLint
pnpm sync            # Sync Obsidian vault to Convex
```

## Key Files

- `convex/schema.ts` — DB schema (links, users, resources + auth tables)
- `convex/auth.ts` — Convex Auth config (Password provider)
- `convex/links.ts` — Link CRUD (auth-gated mutations)
- `convex/resources.ts` — Resource CRUD (admin-gated, `requireAdmin` helper)
- `convex/users.ts` — `currentUser` query, `ensureUser` mutation
- `components/convex-provider.tsx` — `ConvexAuthProvider` wrapper + `EnsureUser`
- `components/auth-guard.tsx` — Role-based access with hierarchy check
- `components/nav.tsx` — Header nav (auth-aware: Subscribe vs Sign Out)
- `open-next.config.ts` — OpenNext Cloudflare config
- `wrangler.toml` — Cloudflare Workers config

## Verified Mistakes to Avoid

- **NEVER run `pnpm ship` locally.** The local `.env.local` sets `NEXT_PUBLIC_CONVEX_URL` to the dev Convex deployment (`perfect-ox-364`). Next.js bakes env vars at build time, and `.env.local` overrides `.env.production`. Running `pnpm ship` locally deploys a build pointing at the dev database to production, breaking live data sync. All production deploys must go through the Cloudflare Pages CI pipeline (triggered by `git push`), which only sees `.env.production` with the correct prod URL (`steady-butterfly-270`).
- **NEVER run `npx convex deploy` without confirming the deployment target.** The Convex deploy pushes functions to prod. Careless deploys can break the live site's backend.

## Convex Notes

- `convex/` is excluded from `tsconfig.json` (has its own `convex/tsconfig.json`)
- Run `npx convex dev` in a separate terminal for local backend
- Seed data: `npx convex run seed:seedLinks`

## Implementation Status

- [x] Phase 1: Foundation (Next.js + Tailwind + Convex + editorial design)
- [x] Phase 2: Dynamic links + admin CRUD + auth
- [x] Phase 3: Subscriber tier (subscribe flow, gated resources, admin resources)
- [ ] Phase 4: Polish (OG image, meta tags, favicon, mobile responsiveness)
- [ ] Deployment: Cloudflare Workers (configured, not yet deployed)

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
