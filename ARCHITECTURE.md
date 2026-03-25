# LNKD — Architecture & Technical Overview

**Site**: [lnkd.world](https://lnkd.world)
**Author**: Matthew Dumas
**Last updated**: March 2026

---

## Executive Summary

LNKD is a personal knowledge site that treats content as a **graph**, not a feed. Posts, readings, and bookmarks are nodes; wikilinks and shared tags form edges. The site renders an interactive knowledge graph as its hero, tracks version history of every piece of content, and syncs from an Obsidian vault via a CLI pipeline. The architecture prioritizes **write-once authoring** (Obsidian) with **read-many publishing** (Convex + Cloudflare Workers).

### Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router, Turbopack) | Pages, routing, SSR |
| Backend | Convex (`perfect-ox-364` / `steady-butterfly-270`) | Real-time DB, serverless functions, auth |
| Auth | `@convex-dev/auth` (Password provider) | Email/password, role-based access |
| Styling | Tailwind CSS v4 + CSS variables | Theming, responsive layout |
| Animation | Framer Motion | Graph node animations, transitions |
| Graph layout | d3-force (server-side only) | Deterministic node positioning |
| Deploy | Cloudflare Workers via `@opennextjs/cloudflare` | Edge compute, global CDN |
| DNS | Cloudflare | Custom domain routing |
| CMS | Obsidian vault + CLI sync script | Local-first authoring |
| Diff | `diff` (jsdiff) | Version history comparison |

### Key Numbers

- **~4,000 lines** of application code (convex + components + app + scripts)
- **12 Convex tables** (3 content + versions + graphLayout + auth + users + resources + projects + now)
- **~40 Convex functions** (queries + mutations)
- **15 React components** (excluding admin CRUD)
- **3 CLI scripts** (sync, layout, readwise)

---

## 1. Data Architecture

### Schema Overview

The database has three primary content tables that share a common shape, plus supporting tables for versioning, graph layout, and site metadata.

#### Content Tables (posts, readings, bookmarks)

All three share:
```
slug: string                    — URL-safe identifier, derived from filename
title: string                   — Display title
tags: string[]                  — Freeform tags for filtering and graph edges
published: boolean              — Controls visibility
gated: boolean?                 — Subscriber-only when true
publishedAt: string?            — ISO date for sorting
featured: boolean?              — Editorial override for graph prominence
wikilinksRaw: string[]?         — Raw [[target]] strings from markdown
wikilinksResolved: string[]?    — Successfully resolved slugs
wikilinksBroken: string[]?      — Unresolvable targets (preserved for debugging)
backlinks: string[]?            — Precomputed reverse index (slugs linking TO this)
```

**posts** additionally has: `description`, `content`
**readings** additionally has: `author`, `type`, `rating`, `content`, `url`
**bookmarks** additionally has: `url`, `description` (no `content` field)

All three indexed on `by_slug` and `by_published`.

#### versions

```
slug: string
contentType: "post" | "reading" | "bookmark"
contentHash: string             — SHA-256 first 32 chars, deduplication key
content: string                 — Full content snapshot (not a diff)
title: string
changeType: "edit" | "restructure" | "expand" | "restore"
createdAt: string               — ISO datetime
```
Indexed on `by_slug` and `by_slug_and_type`.

**Design decision**: Full content snapshots rather than diffs. At personal-site scale (<500 posts), storage is cheap and rendering diffs requires both versions anyway. The `contentHash` prevents duplicate versions — calling `createVersion` with unchanged content is a no-op.

#### graphLayout

```
layoutHash: string              — SHA-256 of sorted slug set (invalidation key)
nodes: Array<{ slug, x, y }>   — Normalized [0,1] positions
createdAt: string
```

**Design decision**: Layout is precomputed server-side via d3-force and stored. The client receives positioned nodes — zero simulation at render time. Layout only recomputes when the slug set changes (detected via hash comparison). This ensures **deterministic, stable positioning** across page loads. Users build spatial memory of where nodes are.

#### Supporting tables

- **users**: email, role (`admin` | `subscriber`), auth metadata
- **resources**: title, description, content, published (subscriber-gated)
- **projects**: title, description, href, order
- **now**: content, updatedAt (singleton — only one row)
- **authTables**: Standard `@convex-dev/auth` session/verification tables

---

## 2. Wikilink System

### Problem

Obsidian uses `[[wikilinks]]` for internal linking. These need to:
1. Resolve to actual site routes
2. Power the knowledge graph
3. Handle renames, ambiguity, and broken references gracefully

### Solution: Three-Field Model

Each content document stores three arrays:
- **wikilinksRaw**: The literal `[[target]]` strings from the markdown (preserves author intent)
- **wikilinksResolved**: Successfully resolved slugs (powers graph edges)
- **wikilinksBroken**: Targets that couldn't be resolved (enables debugging UI)

### Resolution Algorithm

During sync, a **slug registry** maps multiple representations to canonical slugs:

```
Map<string, string[]>
  "some-post"           → ["some-post"]         // exact slug
  "some post"           → ["some-post"]         // normalized title (lowercase, trimmed)
  "some-post"           → ["some-post"]         // hyphenated title
```

Resolution strategy:
1. Try exact slug match
2. Fall back to normalized title match
3. If >1 match → **ambiguous** (pushed to broken, logged)
4. If 0 matches → **broken** (pushed to broken, logged)

**Why ambiguity = broken**: Silent mis-linking (resolving to the wrong target) is worse than a broken link. Ambiguous references are surfaced for manual resolution.

### Backlinks (Precomputed Reverse Index)

After all content is synced, the script computes backlinks:
```
Forward: post-a → [post-b, reading-c]
Reverse: post-b.backlinks = [post-a], reading-c.backlinks = [post-a]
```

Stored directly on each document via `setBacklinks` mutations. This avoids O(n×k) computation on every graph query — backlinks are a simple field read.

### Rendering

In the markdown renderer, `[[wikilinks]]` are converted to Next.js `<Link>` elements:
```
[[Some Post]]         → <Link href="/writing/some-post">Some Post</Link>
[[Some Post|custom]]  → <Link href="/writing/some-post">custom</Link>
```

On post pages, a "Referenced by" section shows all backlinks as navigable links.

---

## 3. Knowledge Graph

### Data Flow

```
Obsidian vault
    ↓ (sync.ts)
Convex DB (nodes + wikilinksResolved)
    ↓ (compute-layout.ts)
d3-force simulation (server-side, seeded RNG)
    ↓
graphLayout table (normalized [0,1] positions)
    ↓ (graph.ts query)
Frontend receives: scored nodes + edges + precomputed positions
    ↓ (hero-graph.tsx)
SVG render with Framer Motion animations
```

### Node Scoring

Nodes are ranked for the hero subset (top 20 desktop, 10 mobile):

```ts
score = Math.log(1 + inDegree + outDegree) * 2  // damped degree
      + recencyBonus                              // min(3, 3 - ageDays/30)
      + (type === "post" ? 1 : 0)                // posts rank higher
      + (featured ? 10 : 0)                       // editorial override
```

**Log damping** prevents hub nodes from dominating. **Featured flag** gives editorial control — always included regardless of score.

### Edge Strategy

**V1: Wikilinks only** (no tag-based edges). Rationale:
- Wikilinks are **intentional** references — the author explicitly linked two pieces
- Tag edges create O(n²) noise in dense tag clusters
- Keeps the graph readable at small scale

Tag edges are planned for Phase 3 (full graph page) with threshold: ≥2 shared tags, capped at 5 edges per node.

### Layout Computation

Uses d3-force with seeded RNG (`seedrandom("lnkd-graph-layout-v1")`):
- `forceLink`: distance 60
- `forceManyBody`: strength -80 (repulsion)
- `forceCenter`: (0, 0)
- `forceCollide`: radius 12

300 ticks → normalize to [0, 1] with 5% padding → store in Convex.

**Invalidation**: `layoutHash = SHA256(sorted slugs joined by "|")`. Only recomputes when the slug set changes.

### Frontend Rendering

- **SVG** with viewBox scaling (responsive)
- **Framer Motion**: Staggered node entrance, edge draw-in, pulse on most recent
- **Interaction**: Hover shows tooltip (HTML overlay near cursor) + connected edges; click navigates
- **Mobile**: Larger hit areas (2.5× radius invisible circle), tap-to-reveal then tap-to-navigate
- **Edges hidden by default** — only appear on hover to prevent visual clutter
- **d3-force is NOT in the client bundle** — only used in the server-side script

### Node Type Differentiation

| Type | Color | Desktop radius | Mobile radius |
|------|-------|---------------|---------------|
| Post | `#1B3A5C` (navy) | 6px | 10px |
| Reading | `#4A7B6F` (green) | 5px | 8px |
| Bookmark | `#8B6B4A` (amber) | 4px | 7px |

---

## 4. Version History

### Design Philosophy

Content evolution is treated as **intellectual narrative**, not git log. The UI uses editorial language ("Revised on March 15") rather than technical terminology ("commit abc123").

### Storage

Full content snapshots per version. Deduplication via `contentHash` (SHA-256, first 32 chars) — the `createVersion` mutation compares against the latest version's hash before inserting.

### Diff Rendering

Uses `diffLines` from the `diff` (jsdiff) library. The UI:
- Collapses unchanged sections beyond 3 lines of context
- Shows additions with `bg-green-50/50` and `+` prefix
- Shows removals with `bg-red-50/50`, strikethrough, and `−` prefix
- Monospace font for diff clarity

### Restore Capability

`versions.restore` mutation:
1. Fetches the target version's content
2. Patches the live document
3. Creates a new version entry with `changeType: "restore"` (audit trail)

This ensures every restore is tracked — you can't silently overwrite content.

---

## 5. Sync Pipeline

### Architecture

```
Obsidian vault (local filesystem)
    ↓
scripts/sync.ts (Node.js CLI)
    ↓ ConvexHttpClient
Convex backend (mutations)
    ↓
scripts/compute-layout.ts (d3-force)
    ↓ ConvexHttpClient
graphLayout table
```

### Sync Process (sync.ts)

1. **Read** all `.md` files from `posts/`, `readings/`, `bookmarks/` dirs (sorted by path for determinism)
2. **Parse** frontmatter with `gray-matter`
3. **Build slug registry** from all files (multi-strategy: exact slug, normalized title, hyphenated)
4. **For each file**:
   a. Extract wikilinks (`/\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g`)
   b. Resolve against registry (1 match = resolved, >1 = ambiguous/broken, 0 = broken)
   c. Upsert content via `*.upsertBySlug` mutation
   d. Create version via `versions.createVersion` (hash-deduplicated)
5. **Compute backlinks** (reverse forward-link map)
6. **Set backlinks** on each document via `*.setBacklinks` mutations
7. **Sync `now.md`** if present

### Robustness Features

- **`--dry-run`**: Preview what would change without writing
- **Partial failure**: Continues syncing other files if one fails
- **Summary report**: Total synced, versions created, broken links, errors
- **Deterministic ordering**: Files sorted by path before processing
- **Idempotent versioning**: Hash comparison prevents duplicate versions

### Security

All sync mutations require `SYNC_SECRET` environment variable. The secret is set in both `.env.local` (local dev) and Convex environment (production).

---

## 6. Auth & Access Control

### Provider

`@convex-dev/auth` with `Password` provider (email/password).

### Role Assignment

On first authentication, `ensureUser` mutation checks:
- If email === `mattdumas3@gmail.com` → role `"admin"`
- Otherwise → role `"subscriber"`

### Access Hierarchy

```
admin (2) > subscriber (1) > public (0)
```

### Enforcement Layers

1. **Component level**: `<AuthGuard role="admin">` wraps admin pages
2. **Query level**: `getBySlug` returns empty content if gated + unauthenticated
3. **Mutation level**: `requireAdmin(ctx)` helper checks identity + role
4. **Sync level**: `SYNC_SECRET` env var protects all sync mutations

### Auth Flow

```
User → /subscribe → SignInForm → signIn("password", formData)
  → Convex auth session created
  → ConvexAuthProvider detects authenticated state
  → EnsureUser component calls ensureUser mutation
  → User record created/verified in users table
  → AuthGuard components now allow access based on role
```

---

## 7. Markdown Rendering

### Preprocessor (Obsidian Syntax → Standard Markdown)

The `preprocessObsidian` function transforms Obsidian-specific syntax before passing to `react-markdown`:

| Input | Output |
|-------|--------|
| `==highlighted==` | `<mark>highlighted</mark>` |
| `[[target]]` | `[target](/writing/slug)` |
| `[[target\|display]]` | `[display](/writing/slug)` |
| `` ```multicol ... ``` `` | `<div class="multicol">` grid |
| `> [!type] title` | `<div class="callout callout-type">` |

### Plugin Chain

```
react-markdown
  ├── remarkGfm          (tables, strikethrough, task lists)
  ├── remarkMath          (LaTeX: $inline$ and $$block$$)
  ├── rehypeRaw           (raw HTML pass-through)
  ├── rehypeKatex         (math rendering)
  └── rehypeHighlight     (syntax highlighting)
```

### Custom Renderers

Every HTML element has a custom renderer for consistent styling:
- Headings: Playfair Display font, graduated sizes, anchor links
- Links: Internal (accent color, underline) vs external (new tab indicator)
- Code: Inline (monospace, background) vs block (border, rounded, overflow)
- Tables: Full-width, bordered, striped
- Images: Rounded, full-width
- Blockquotes: Left border, italic
- Details/summary: Styled disclosure widget
- Mark: Yellow highlight
- Kbd: Keyboard key styling
- Footnotes: Separated section with smaller text

---

## 8. Frontend Architecture

### Layout Structure (Homepage)

```
<div max-w-5xl>
  <Nav />
  <main>
    <Hero />                          // Name + tagline + social + HeroGraph
    <NowSection />                    // Full-width, above the grid
    <div xl:grid [1fr_240px] gap-16>  // Two-column on xl+
      <div>                           // Left column
        <WritingSection />
        <ReadingSection />
        <BookmarksSection />
        <ProjectList />
      </div>
      <div xl:sticky top-8>           // Right column (sticky)
        <Sidebar />
          ├── ActivityHeatmap
          ├── Content counts
          └── ReadingStats
      </div>
    </div>
  </main>
  <Footer />
</div>
```

### Client vs Server Components

| Component | Type | Reason |
|-----------|------|--------|
| `layout.tsx` | Server | Static shell, fonts, metadata |
| `page.tsx` (home) | Server | Composes client components |
| `hero.tsx` | Client | Dynamic import of HeroGraph |
| `hero-graph.tsx` | Client (dynamic, ssr: false) | Browser-only SVG + d3 |
| `now-section.tsx` | Client | Convex `useQuery` |
| `writing-section.tsx` | Client | Convex `useQuery` |
| `sidebar.tsx` | Client | Convex `useQuery` |
| `version-history.tsx` | Client | Interactive diff viewer |
| `markdown.tsx` | Client | Third-party markdown plugins |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| < 768px (mobile) | Single column, stacked, graph shows 10 nodes |
| 768px–1279px (tablet) | Single column, wider content |
| ≥ 1280px (xl) | Two-column with sticky sidebar |

### Spacing System

Sections use generous vertical spacing (whitespace as primary separator, no border lines):
- Hero → Now: `mb-20` (80px)
- Now → Content grid: `mb-20` (80px)
- Between sections: `mb-16` (64px)
- Within sections: `space-y-5` (20px)
- Sidebar gap: `gap-16` (64px)

---

## 9. Activity Heatmap

### Data Source

`stats.activity` query aggregates all content by `publishedAt` date:
- Counts words per document (strips code blocks, markdown syntax, HTML tags)
- Returns array of `{ date, type, words }`

### Rendering

SVG-based GitHub-style contribution grid:
- 22 weeks of data (5 months rolling window)
- Color intensity: 5 levels based on word count thresholds
- Month labels across top, day labels (Mon/Wed/Fri) on left
- Total word count displayed in corner
- Cell size: 10px with 2px gap

---

## 10. Deployment

### Pipeline

```
pnpm ship
  ↓
find .open-next -type d -name node_modules -exec rm -rf {} +
  ↓
rm -rf .open-next
  ↓
pnpm build:worker (opennextjs-cloudflare build → next build → bundle)
  ↓
pnpm run deploy (opennextjs-cloudflare deploy → wrangler deploy)
  ↓
Cloudflare Workers (lnkd.world)
```

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.production` (build-time) | Convex endpoint inlined into client JS |
| `NEXT_PUBLIC_CONVEX_URL` | `wrangler.toml [vars]` (runtime) | Available to server-side code |
| `SYNC_SECRET` | `.env.local` + Convex env | Protects sync mutations |
| `CONVEX_DEPLOYMENT` | `.env.local` | Local dev deployment target |

### CI/CD

Cloudflare auto-deploys on git push to main:
- Build command: `pnpm build:worker`
- Deploy command: `npx wrangler deploy`
- `.env.production` committed to repo → ensures `NEXT_PUBLIC_CONVEX_URL` is available in CI

### Convex Deployments

| Environment | Deployment ID | URL |
|-------------|--------------|-----|
| Dev | `perfect-ox-364` | `https://perfect-ox-364.convex.cloud` |
| Production | `steady-butterfly-270` | `https://steady-butterfly-270.convex.cloud` |

---

## 11. Scalability Considerations

### Current Scale

- ~5 content items, ~1 user
- Graph: 4 nodes, 0 edges
- Versions: ~5 entries
- Total Convex storage: <1MB

### Scaling Ceilings

| Component | Current | Ceiling | Mitigation |
|-----------|---------|---------|-----------|
| Graph layout (d3-force) | 4 nodes | ~300 nodes (O(n²) collision) | Precomputed server-side; hero shows top 20 |
| Graph query (nodes) | Fetches all published content | ~1000 items before query slowdown | Add pagination; cache result |
| Version storage | Full snapshots | Linear growth (~10KB/version) | Acceptable at personal scale; add retention policy if needed |
| Sync script | Sequential upserts | ~200 files before timeout risk | Batch mutations; parallelize |
| Backlinks computation | O(n×k) during sync | Scales with content × links | Already precomputed; only runs during sync |
| Wikilink resolution | Registry in memory | Scales with total content count | Fine for thousands of items |

### What Would Break First

1. **Graph layout computation** at >300 nodes (d3-force performance)
   - Fix: Cluster nodes, only simulate subgraphs
2. **Convex query for all published content** at >1000 items
   - Fix: Paginate `graph.nodes`, add server-side caching
3. **Sync script runtime** at >200 files (sequential HTTP mutations)
   - Fix: Batch mutations, parallel processing

### What Scales Well

- **Cloudflare Workers**: Edge compute, auto-scales globally
- **Convex real-time subscriptions**: Handles concurrent readers efficiently
- **Precomputed graph layout**: Zero client-side computation regardless of graph size
- **Version deduplication**: Hash comparison prevents storage bloat from repeated syncs
- **Backlink precomputation**: Read path is O(1) field access, not O(n) graph traversal

---

## 12. Notable Design Decisions

### Content as Graph, Not Feed

The knowledge graph isn't decoration — it's the primary organizing principle. Content is connected by intentional `[[wikilinks]]`, not algorithmic similarity. This means:
- The graph reflects **author intent**, not computed relevance
- Backlinks enable bidirectional discovery
- The hero graph serves as both wayfinding and visual identity

### Obsidian as CMS

No admin dashboard for content creation. The author writes in Obsidian (local-first, markdown, works offline) and syncs to the site via CLI. This means:
- Content authoring happens in the best writing tool, not a web form
- Version history is automatic (every sync checks for changes)
- Wikilinks work the same in Obsidian and on the site

### Precomputed Everything

Graph layout, backlinks, and activity stats are all computed during sync — not at query time. This trades write-time computation for read-time simplicity:
- Graph positions are deterministic and cached
- Backlinks are a field read, not a reverse traversal
- The client receives pre-positioned, pre-scored data

### No Tag Edges (V1)

Deliberately omitted tag-based graph edges. Tags create dense, noisy connections (every "philosophy" post connects to every other "philosophy" post). Wikilinks are sparse, intentional, and high-signal.

### Full Version Snapshots

Storing complete content per version rather than diffs. At personal scale, storage is cheap (~10KB per version), and rendering diffs requires both old and new content anyway. Simplifies the restore flow — just copy the snapshot back.

### Editorial Graph Ranking

The `featured` boolean gives editorial control over which nodes appear in the hero graph. Algorithmic ranking (`log(degree) + recency`) fills the remaining slots. This prevents the graph from being purely mechanical — the author curates the visual representation of their thinking.

---

## 13. Future Architecture (Phase 3)

Planned but not yet implemented:

- **Full interactive graph page** (`/graph`): All nodes, zoom/pan via CSS transforms, type filters, search, URL-persisted state
- **Tag edges**: Weight threshold (≥2 shared tags), capped at 5 per node
- **Readwise integration**: Auto-sync Kindle highlights into readings
- **Incremental sync**: Only reprocess changed files
- **Graph caching**: Edge-cache the graph query result, invalidate on sync
