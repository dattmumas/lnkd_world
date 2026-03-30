# lnkd.world — Personal Homepage & Project Hub

## Context

Building the homepage for lnkd.world — a personal site that serves as a link-in-bio style landing page, connecting to a Ghost blog (blog.lnkd.world) and personal projects. Needs a backend for future tools and two auth tiers (admin + subscriber).

## Stack

- **Framework**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend**: **Convex** (recommended over Supabase — see rationale below)
- **Auth**: Convex Auth with role-based access (admin + subscriber)
- **Deploy**: Vercel + Cloudflare DNS
- **Design**: Light editorial — serif fonts, generous whitespace, magazine aesthetic

### Why Convex over Supabase

- **DX**: TypeScript end-to-end, no SQL/migrations/RLS to manage for a solo project
- **Real-time**: Every query is reactive by default — useful for future tools/dashboards
- **Extensibility**: Adding a new tool = adding a new TypeScript file in `convex/`
- **Auth simplicity**: Built-in auth with a simple `role` field vs. Supabase RLS policies
- **Cost**: Free tier (1M function calls/mo) is more than enough for a personal site

## Design Direction

- **Background**: White or warm off-white (`#FAFAF8`)
- **Text**: Near-black (`#1A1A1A`), lighter for secondary
- **Accent**: Single muted color (deep blue `#1B3A5C` or warm terracotta `#C4704A`)
- **Fonts**: Playfair Display (headings), Source Serif 4 / Lora (body)
- **Style**: Generous spacing, text-based links with subtle hover underlines, no cards/boxes

## Project Structure

```
lnkd_world/
├── next.config.ts
├── convex/
│   ├── schema.ts            # links, users, resources tables
│   ├── auth.ts              # Convex Auth config
│   ├── links.ts             # Link CRUD queries/mutations
│   ├── users.ts             # Role management
│   └── resources.ts         # Subscriber-gated content
├── app/
│   ├── layout.tsx           # Root layout (ConvexProvider, fonts)
│   ├── page.tsx             # Homepage — link-in-bio
│   ├── globals.css
│   ├── admin/
│   │   ├── layout.tsx       # Auth guard (admin only)
│   │   ├── page.tsx         # Admin dashboard
│   │   └── links/page.tsx   # Manage links
│   ├── subscribe/page.tsx   # Subscriber sign-up
│   └── resources/page.tsx   # Subscriber-gated content
├── components/
│   ├── hero.tsx             # Name, bio, avatar
│   ├── link-list.tsx        # Link list component
│   ├── nav.tsx              # Minimal nav
│   └── auth-guard.tsx       # Role-checking wrapper
└── lib/
    └── fonts.ts             # Font configuration
```

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Hero (name, bio, photo) + list of links |
| `/subscribe` | Public | Email sign-up / OAuth for subscribers |
| `/resources` | Subscriber | Gated content, tools, downloads |
| `/admin` | Admin | Dashboard, quick actions |
| `/admin/links` | Admin | CRUD for homepage links |

## Auth Approach

1. Convex Auth with email/password + optional Google OAuth
2. Users table has `role` field: `"admin"` or `"subscriber"`
3. Admin bootstrapped by hardcoded email check on first sign-up
4. `requireAdmin(ctx)` helper in Convex functions for server-side enforcement
5. `<AuthGuard role="admin">` component for client-side routing

## Deployment

1. **Vercel**: Connect GitHub repo, auto-deploy on push
2. **Cloudflare DNS**: `lnkd.world` → CNAME `cname.vercel-dns.com`
3. **Convex Cloud**: Deployed separately, connected via `NEXT_PUBLIC_CONVEX_URL` env var
4. `blog.lnkd.world` stays on Ghost (untouched)

## Implementation Phases

### Phase 1: Foundation
- Init Next.js + Tailwind + Convex
- Define schema (links, users tables)
- Configure editorial fonts
- Build homepage: hero + static link list
- Deploy to Vercel, configure DNS

### Phase 2: Dynamic Links + Admin
- Wire links to Convex (queries/mutations)
- Set up Convex Auth
- Build `/admin` with auth guard + link management UI
- Bootstrap admin account, seed initial links

### Phase 3: Subscriber Tier
- Build `/subscribe` sign-up flow
- Build `/resources` gated area
- Role-checking auth guard component

### Phase 4: Polish
- OG image + meta tags
- Favicon + mobile responsiveness
- End-to-end flow test

## Verification

1. `npm run dev` — homepage renders with hero + links
2. Sign up as subscriber → can access `/resources`, blocked from `/admin`
3. Admin login → can access `/admin/links`, CRUD works, changes reflect on homepage
4. Deploy to Vercel → `lnkd.world` resolves and serves the site
5. `blog.lnkd.world` still works (no DNS changes to it)
