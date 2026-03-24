import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import matter from "gray-matter";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join, basename } from "path";

config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SYNC_SECRET = process.env.SYNC_SECRET;

if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in environment");
  process.exit(1);
}
if (!SYNC_SECRET) {
  console.error("Missing SYNC_SECRET in environment");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const vaultPath = process.argv[2];
if (!vaultPath) {
  console.error("Usage: npx tsx scripts/sync.ts <vault-path>");
  console.error("Example: npx tsx scripts/sync.ts ~/Obsidian/publish");
  process.exit(1);
}

function slugFromFilename(filename: string): string {
  return basename(filename, ".md")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readMarkdownFiles(dir: string) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = readFileSync(join(dir, f), "utf-8");
      const { data, content } = matter(raw);
      return { slug: slugFromFilename(f), frontmatter: data, content };
    });
}

async function syncPosts(dir: string) {
  const files = readMarkdownFiles(dir);
  let created = 0,
    updated = 0,
    errors = 0;

  for (const file of files) {
    try {
      const result = await client.mutation(api.posts.upsertBySlug, {
        secret: SYNC_SECRET!,
        slug: file.slug,
        title: file.frontmatter.title ?? file.slug,
        description: file.frontmatter.description ?? "",
        content: file.content.trim(),
        tags: file.frontmatter.tags ?? [],
        published: file.frontmatter.published ?? false,
        gated: file.frontmatter.gated ?? undefined,
        publishedAt: file.frontmatter.publishedAt
          ? String(file.frontmatter.publishedAt)
          : undefined,
      });
      if (result.action === "created") created++;
      else updated++;
    } catch (e) {
      errors++;
      console.error(`  Error syncing post ${file.slug}:`, e);
    }
  }

  return { total: files.length, created, updated, errors };
}

async function syncReadings(dir: string) {
  const files = readMarkdownFiles(dir);
  let created = 0,
    updated = 0,
    errors = 0;

  for (const file of files) {
    try {
      const result = await client.mutation(api.readings.upsertBySlug, {
        secret: SYNC_SECRET!,
        slug: file.slug,
        title: file.frontmatter.title ?? file.slug,
        author: file.frontmatter.author ?? "Unknown",
        type: file.frontmatter.type ?? "book",
        rating: file.frontmatter.rating ?? undefined,
        content: file.content.trim(),
        tags: file.frontmatter.tags ?? [],
        published: file.frontmatter.published ?? false,
        gated: file.frontmatter.gated ?? undefined,
        publishedAt: file.frontmatter.publishedAt
          ? String(file.frontmatter.publishedAt)
          : undefined,
        url: file.frontmatter.url ?? undefined,
      });
      if (result.action === "created") created++;
      else updated++;
    } catch (e) {
      errors++;
      console.error(`  Error syncing reading ${file.slug}:`, e);
    }
  }

  return { total: files.length, created, updated, errors };
}

async function syncBookmarks(dir: string) {
  const files = readMarkdownFiles(dir);
  let created = 0,
    updated = 0,
    errors = 0;

  for (const file of files) {
    try {
      const result = await client.mutation(api.bookmarks.upsertBySlug, {
        secret: SYNC_SECRET!,
        slug: file.slug,
        title: file.frontmatter.title ?? file.slug,
        url: file.frontmatter.url ?? "",
        description: file.content.trim() || file.frontmatter.description || "",
        tags: file.frontmatter.tags ?? [],
        published: file.frontmatter.published ?? false,
        gated: file.frontmatter.gated ?? undefined,
        publishedAt: file.frontmatter.publishedAt
          ? String(file.frontmatter.publishedAt)
          : undefined,
      });
      if (result.action === "created") created++;
      else updated++;
    } catch (e) {
      errors++;
      console.error(`  Error syncing bookmark ${file.slug}:`, e);
    }
  }

  return { total: files.length, created, updated, errors };
}

function report(label: string, stats: { total: number; created: number; updated: number; errors: number }) {
  const parts = [`${stats.total} files`];
  if (stats.created) parts.push(`${stats.created} created`);
  if (stats.updated) parts.push(`${stats.updated} updated`);
  if (stats.errors) parts.push(`${stats.errors} errors`);
  console.log(`  ${label}: ${parts.join(", ")}`);
}

async function syncNow(vaultDir: string) {
  const nowFile = join(vaultDir, "now.md");
  if (!existsSync(nowFile)) return null;

  const raw = readFileSync(nowFile, "utf-8");
  const { content } = matter(raw);

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

async function main() {
  console.log(`Syncing from ${vaultPath}...\n`);

  const postsDir = join(vaultPath, "posts");
  const readingsDir = join(vaultPath, "readings");
  const bookmarksDir = join(vaultPath, "bookmarks");

  const [posts, readings, bookmarks, nowResult] = await Promise.all([
    syncPosts(postsDir),
    syncReadings(readingsDir),
    syncBookmarks(bookmarksDir),
    syncNow(vaultPath),
  ]);

  console.log("");
  report("Posts", posts);
  report("Readings", readings);
  report("Bookmarks", bookmarks);
  if (nowResult) {
    console.log(`  Now: ${nowResult}`);
  }

  const totalErrors = posts.errors + readings.errors + bookmarks.errors + (nowResult === "error" ? 1 : 0);
  if (totalErrors > 0) {
    console.log(`\n${totalErrors} error(s) occurred.`);
    process.exit(1);
  } else {
    console.log("\nSync complete.");
  }
}

main();
