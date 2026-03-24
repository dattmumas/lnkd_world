/**
 * Sync Readwise highlights and books to the Obsidian vault as reading entries.
 *
 * Usage:
 *   npx tsx scripts/readwise-sync.ts <vault-path>
 *
 * Requires READWISE_TOKEN in .env.local
 * Fetches all books/highlights from Readwise, creates markdown files
 * in <vault-path>/readings/ with proper frontmatter, then run the
 * normal sync script to push to Convex.
 */
import { config } from "dotenv";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

config({ path: ".env.local" });

const READWISE_TOKEN = process.env.READWISE_TOKEN;

if (!READWISE_TOKEN) {
  console.error("Missing READWISE_TOKEN in .env.local");
  console.error("Get your token from https://readwise.io/access_token");
  process.exit(1);
}

const vaultPath = process.argv[2];
if (!vaultPath) {
  console.error("Usage: npx tsx scripts/readwise-sync.ts <vault-path>");
  process.exit(1);
}

const readingsDir = join(vaultPath, "readings");
if (!existsSync(readingsDir)) {
  mkdirSync(readingsDir, { recursive: true });
}

interface ReadwiseBook {
  id: number;
  title: string;
  author: string;
  category: string; // "books" | "articles" | "tweets" | "podcasts" | "supplementals"
  source: string;
  num_highlights: number;
  cover_image_url: string;
  highlights_url: string;
  source_url: string | null;
  asin: string;
}

interface ReadwiseHighlight {
  id: number;
  text: string;
  note: string;
  location: number;
  location_type: string;
  book_id: number;
  highlighted_at: string;
  tags: { name: string }[];
}

async function fetchPaginated<T>(url: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Token ${READWISE_TOKEN}` },
    });

    if (!res.ok) {
      console.error(`Readwise API error: ${res.status} ${res.statusText}`);
      process.exit(1);
    }

    const data = await res.json();
    results.push(...data.results);
    nextUrl = data.next;
  }

  return results;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapCategory(category: string): string {
  switch (category) {
    case "books":
      return "book";
    case "articles":
      return "article";
    case "podcasts":
      return "podcast";
    default:
      return "article";
  }
}

async function main() {
  console.log("Fetching books from Readwise...");
  const books = await fetchPaginated<ReadwiseBook>(
    "https://readwise.io/api/v2/books/"
  );
  console.log(`Found ${books.length} books/sources`);

  // Filter to books and articles only (skip tweets, supplementals)
  const relevant = books.filter(
    (b) => b.category === "books" || b.category === "articles"
  );
  console.log(`${relevant.length} relevant (books + articles)`);

  console.log("Fetching highlights...");
  const highlights = await fetchPaginated<ReadwiseHighlight>(
    "https://readwise.io/api/v2/highlights/"
  );
  console.log(`Found ${highlights.length} highlights`);

  // Group highlights by book
  const highlightsByBook = new Map<number, ReadwiseHighlight[]>();
  for (const h of highlights) {
    const list = highlightsByBook.get(h.book_id) ?? [];
    list.push(h);
    highlightsByBook.set(h.book_id, list);
  }

  let created = 0;
  let skipped = 0;

  for (const book of relevant) {
    const slug = slugify(book.title);
    const filePath = join(readingsDir, `${slug}.md`);

    // Don't overwrite existing files (user may have edited them)
    if (existsSync(filePath)) {
      skipped++;
      continue;
    }

    const bookHighlights = highlightsByBook.get(book.id) ?? [];
    const tags = new Set<string>();

    // Collect tags from highlights
    for (const h of bookHighlights) {
      for (const t of h.tags) {
        tags.add(t.name);
      }
    }

    const type = mapCategory(book.category);
    const tagArray = tags.size > 0 ? Array.from(tags) : [type];

    // Build frontmatter
    const frontmatter = [
      "---",
      `title: "${book.title.replace(/"/g, '\\"')}"`,
      `author: "${book.author.replace(/"/g, '\\"')}"`,
      `type: ${type}`,
      `tags: [${tagArray.join(", ")}]`,
      `published: true`,
      `publishedAt: "${new Date().toISOString().split("T")[0]}"`,
    ];

    if (book.source_url) {
      frontmatter.push(`url: "${book.source_url}"`);
    }

    frontmatter.push("---");

    // Build content from highlights
    const lines: string[] = [];
    if (bookHighlights.length > 0) {
      lines.push("## Highlights\n");
      for (const h of bookHighlights) {
        lines.push(`> ${h.text}\n`);
        if (h.note) {
          lines.push(`${h.note}\n`);
        }
        lines.push("");
      }
    }

    const content = frontmatter.join("\n") + "\n\n" + lines.join("\n");
    writeFileSync(filePath, content.trim() + "\n");
    created++;
  }

  console.log(
    `\nDone: ${created} created, ${skipped} skipped (already exist)`
  );
  console.log(
    `\nNow run: npx tsx scripts/sync.ts ${vaultPath}`
  );
}

main();
