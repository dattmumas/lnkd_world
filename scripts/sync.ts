import { config } from "dotenv";
import { createHash } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import matter from "gray-matter";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join, basename } from "path";

config({ path: ".env.local" });

const IS_PROD = process.argv.includes("--prod");
const DRY_RUN = process.argv.includes("--dry-run");
const CONVEX_URL = IS_PROD
  ? process.env.CONVEX_URL_PROD
  : (process.env.CONVEX_URL_DEV ?? process.env.NEXT_PUBLIC_CONVEX_URL);
const SYNC_SECRET = process.env.SYNC_SECRET;

if (!CONVEX_URL) {
  console.error(`Missing ${IS_PROD ? "CONVEX_URL_PROD" : "CONVEX_URL_DEV"} in .env.local`);
  process.exit(1);
}
if (!SYNC_SECRET) {
  console.error("Missing SYNC_SECRET in environment");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const vaultPath = process.argv.filter((a) => !a.startsWith("--"))[2];
if (!vaultPath) {
  console.error("Usage: npx tsx scripts/sync.ts <vault-path> [--dry-run] [--prod]");
  process.exit(1);
}

// ─── Utilities ───────────────────────────────────────────────

function slugFromFilename(filename: string): string {
  return basename(filename, ".md")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 32);
}

function extractWikilinksRaw(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g);
  return [...new Set(Array.from(matches, (m) => m[1].trim()))];
}

// ─── Slug Registry (handles ambiguity) ──────────────────────

interface FileEntry {
  slug: string;
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  contentType: "post" | "reading" | "bookmark";
}

function buildSlugRegistry(allFiles: FileEntry[]): Map<string, string[]> {
  const registry = new Map<string, string[]>();
  const add = (key: string, slug: string) => {
    const existing = registry.get(key) ?? [];
    if (!existing.includes(slug)) existing.push(slug);
    registry.set(key, existing);
  };
  for (const f of allFiles) {
    add(f.slug, f.slug);
    add(f.title.toLowerCase().trim(), f.slug);
    add(f.title.toLowerCase().replace(/\s+/g, "-"), f.slug);
  }
  return registry;
}

function resolveWikilinks(
  raw: string[],
  registry: Map<string, string[]>
): { resolved: string[]; broken: string[] } {
  const resolved: string[] = [];
  const broken: string[] = [];
  for (const target of raw) {
    const slug = target
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const normalized = target.toLowerCase().trim();
    const matches = registry.get(slug) ?? registry.get(normalized) ?? [];
    if (matches.length === 1) {
      resolved.push(matches[0]);
    } else if (matches.length > 1) {
      broken.push(target);
      console.warn(`  [ambiguous] [[${target}]] → ${matches.join(", ")}`);
    } else {
      broken.push(target);
      console.warn(`  [broken] [[${target}]] → no match`);
    }
  }
  return { resolved, broken };
}

// ─── Read Files ─────────────────────────────────────────────

function readMarkdownFiles(dir: string): { slug: string; frontmatter: Record<string, unknown>; content: string }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort() // deterministic ordering
    .map((f) => {
      const raw = readFileSync(join(dir, f), "utf-8");
      const { data, content } = matter(raw);
      return { slug: slugFromFilename(f), frontmatter: data, content };
    });
}

// ─── Sync Functions ─────────────────────────────────────────

interface SyncStats {
  total: number;
  created: number;
  updated: number;
  versions: number;
  errors: number;
}

async function syncContent(
  allFiles: FileEntry[],
  registry: Map<string, string[]>
): Promise<{ stats: Record<string, SyncStats>; forwardLinks: Map<string, string[]>; brokenCount: number }> {
  const stats: Record<string, SyncStats> = {
    posts: { total: 0, created: 0, updated: 0, versions: 0, errors: 0 },
    readings: { total: 0, created: 0, updated: 0, versions: 0, errors: 0 },
    bookmarks: { total: 0, created: 0, updated: 0, versions: 0, errors: 0 },
  };

  const forwardLinks = new Map<string, string[]>();
  let brokenCount = 0;

  for (const file of allFiles) {
    const s = stats[file.contentType + "s"];
    s.total++;

    const raw = extractWikilinksRaw(file.content);
    const { resolved, broken } = resolveWikilinks(raw, registry);
    forwardLinks.set(file.slug, resolved);
    brokenCount += broken.length;

    if (DRY_RUN) {
      console.log(`  [dry-run] ${file.contentType}: ${file.slug} (${raw.length} links, ${broken.length} broken)`);
      continue;
    }

    try {
      const commonArgs = {
        secret: SYNC_SECRET!,
        slug: file.slug,
        title: (file.frontmatter.title as string) ?? file.slug,
        content: file.content.trim(),
        tags: (file.frontmatter.tags as string[]) ?? [],
        published: (file.frontmatter.published as boolean) ?? false,
        gated: (file.frontmatter.gated as boolean) ?? undefined,
        publishedAt: file.frontmatter.publishedAt
          ? String(file.frontmatter.publishedAt)
          : undefined,
        wikilinksRaw: raw,
        wikilinksResolved: resolved,
        wikilinksBroken: broken.length > 0 ? broken : undefined,
      };

      let result;
      if (file.contentType === "post") {
        result = await client.mutation(api.posts.upsertBySlug, {
          ...commonArgs,
          description: (file.frontmatter.description as string) ?? "",
        });
      } else if (file.contentType === "reading") {
        result = await client.mutation(api.readings.upsertBySlug, {
          ...commonArgs,
          author: (file.frontmatter.author as string) ?? "Unknown",
          type: (file.frontmatter.type as string) ?? "book",
          rating: (file.frontmatter.rating as number) ?? undefined,
          url: (file.frontmatter.url as string) ?? undefined,
        });
      } else {
        const { content: _content, ...bookmarkArgs } = commonArgs;
        result = await client.mutation(api.bookmarks.upsertBySlug, {
          ...bookmarkArgs,
          url: (file.frontmatter.url as string) ?? "",
          description: file.content.trim() || (file.frontmatter.description as string) || "",
        });
      }

      if (result.action === "created") s.created++;
      else s.updated++;

      // Create version (hash includes content + metadata to detect all changes)
      const title = (file.frontmatter.title as string) ?? file.slug;
      const tags = (file.frontmatter.tags as string[]) ?? [];
      const hash = contentHash(
        file.content.trim() + "\0" + title + "\0" + JSON.stringify(tags)
      );
      const vResult = await client.mutation(api.versions.createVersion, {
        secret: SYNC_SECRET!,
        slug: file.slug,
        contentType: file.contentType,
        contentHash: hash,
        content: file.content.trim(),
        title: (file.frontmatter.title as string) ?? file.slug,
        changeType: "edit",
        createdAt: new Date().toISOString(),
      });
      if (vResult.action === "created") s.versions++;
    } catch (e) {
      s.errors++;
      console.error(`  Error syncing ${file.contentType} ${file.slug}:`, e);
    }
  }

  return { stats, forwardLinks, brokenCount };
}

async function computeBacklinks(forwardLinks: Map<string, string[]>): Promise<Map<string, string[]>> {
  const backlinks = new Map<string, string[]>();
  for (const [source, targets] of forwardLinks) {
    for (const target of targets) {
      const existing = backlinks.get(target) ?? [];
      if (!existing.includes(source)) existing.push(source);
      backlinks.set(target, existing);
    }
  }
  return backlinks;
}

async function syncBacklinks(
  allFiles: FileEntry[],
  backlinks: Map<string, string[]>
) {
  if (DRY_RUN) {
    for (const [slug, links] of backlinks) {
      if (links.length > 0) console.log(`  [dry-run] backlinks: ${slug} ← ${links.join(", ")}`);
    }
    return;
  }

  for (const file of allFiles) {
    const bl = backlinks.get(file.slug) ?? [];
    try {
      if (file.contentType === "post") {
        await client.mutation(api.posts.setBacklinks, {
          secret: SYNC_SECRET!,
          slug: file.slug,
          backlinks: bl,
        });
      } else if (file.contentType === "reading") {
        await client.mutation(api.readings.setBacklinks, {
          secret: SYNC_SECRET!,
          slug: file.slug,
          backlinks: bl,
        });
      } else {
        await client.mutation(api.bookmarks.setBacklinks, {
          secret: SYNC_SECRET!,
          slug: file.slug,
          backlinks: bl,
        });
      }
    } catch (e) {
      console.error(`  Error setting backlinks for ${file.slug}:`, e);
    }
  }
}

async function syncNow(vaultDir: string) {
  const nowFile = join(vaultDir, "now.md");
  if (!existsSync(nowFile)) return null;

  const raw = readFileSync(nowFile, "utf-8");
  const { content } = matter(raw);

  if (DRY_RUN) {
    console.log(`  [dry-run] now.md (${content.trim().length} chars)`);
    return "dry-run";
  }

  try {
    const result = await client.mutation(api.now.upsert, {
      secret: SYNC_SECRET!,
      content: content.trim(),
      updatedAt: new Date().toISOString().split("T")[0],
    });
    return result.action;
  } catch (e) {
    console.error("  Error syncing now:", e);
    return "error";
  }
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log("[DRY RUN MODE]\n");
  console.log(`Syncing from ${vaultPath}...\n`);

  // Read all files (sorted for determinism)
  const postsDir = join(vaultPath, "posts");
  const readingsDir = join(vaultPath, "readings");
  const bookmarksDir = join(vaultPath, "bookmarks");

  const allFiles: FileEntry[] = [
    ...readMarkdownFiles(postsDir).map((f) => ({
      ...f, title: (f.frontmatter.title as string) ?? f.slug, contentType: "post" as const,
    })),
    ...readMarkdownFiles(readingsDir).map((f) => ({
      ...f, title: (f.frontmatter.title as string) ?? f.slug, contentType: "reading" as const,
    })),
    ...readMarkdownFiles(bookmarksDir).map((f) => ({
      ...f, title: (f.frontmatter.title as string) ?? f.slug, contentType: "bookmark" as const,
    })),
  ];

  // Build registry + sync content
  const registry = buildSlugRegistry(allFiles);
  const { stats, forwardLinks, brokenCount } = await syncContent(allFiles, registry);

  // Compute + sync backlinks
  const backlinks = await computeBacklinks(forwardLinks);
  console.log("\n  Computing backlinks...");
  await syncBacklinks(allFiles, backlinks);

  // Post-sync validation
  if (!DRY_RUN) {
    console.log("  Validating...");
    const allSlugs = new Set(allFiles.map((f) => f.slug));
    let validationErrors = 0;

    // 1. All wikilinksResolved point to existing slugs
    for (const file of allFiles) {
      const raw = extractWikilinksRaw(file.content);
      const { resolved } = resolveWikilinks(raw, registry);
      for (const target of resolved) {
        if (!allSlugs.has(target)) {
          console.error(`  [validation] ${file.slug} links to "${target}" which doesn't exist`);
          validationErrors++;
        }
      }
    }

    // 2. Backlinks are symmetric (if A→B exists, B.backlinks includes A)
    for (const [source, targets] of forwardLinks) {
      for (const target of targets) {
        const targetBacklinks = backlinks.get(target) ?? [];
        if (!targetBacklinks.includes(source)) {
          console.error(`  [validation] ${source}→${target} but ${target}.backlinks missing ${source}`);
          validationErrors++;
        }
      }
    }

    if (validationErrors > 0) {
      console.error(`  ${validationErrors} validation error(s)`);
    } else {
      console.log("  ✓ Validation passed");
    }
  }

  // Sync now.md
  const nowResult = await syncNow(vaultPath);

  // Report
  console.log("");
  for (const [label, s] of Object.entries(stats)) {
    const parts = [`${s.total} files`];
    if (s.created) parts.push(`${s.created} created`);
    if (s.updated) parts.push(`${s.updated} updated`);
    if (s.versions) parts.push(`${s.versions} new versions`);
    if (s.errors) parts.push(`${s.errors} errors`);
    console.log(`  ${label.charAt(0).toUpperCase() + label.slice(1)}: ${parts.join(", ")}`);
  }
  if (nowResult) console.log(`  Now: ${nowResult}`);
  if (brokenCount > 0) console.log(`\n  ${brokenCount} broken/ambiguous wikilink(s)`);

  const totalErrors = Object.values(stats).reduce((sum, s) => sum + s.errors, 0)
    + (nowResult === "error" ? 1 : 0);
  if (totalErrors > 0) {
    console.log(`\n${totalErrors} error(s) occurred.`);
    process.exit(1);
  } else {
    console.log("\nSync complete.");
  }
}

main();
