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
