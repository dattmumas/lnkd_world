import { App, TFile } from "obsidian";

/**
 * Detects files created by the obsidian-book-search-plugin and
 * auto-transforms them into the LNKD readings format.
 *
 * Book-search files have frontmatter like:
 *   title, author, publisher, isbn, cover, totalPage, etc.
 *
 * LNKD readings need:
 *   title, author, type, rating, tags, published, publishedAt, coverUrl
 */

interface BookSearchFrontmatter {
  title?: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  isbn13?: string;
  cover?: string;
  totalPage?: number;
  publishDate?: string;
  categories?: string[];
  [key: string]: unknown;
}

function isBookSearchFile(frontmatter: Record<string, unknown>): boolean {
  // Book-search files have isbn or publisher — regular readings don't
  return !!(frontmatter.isbn || frontmatter.isbn13 || frontmatter.publisher);
}

function hasLnkdFields(frontmatter: Record<string, unknown>): boolean {
  // Already transformed if it has our fields
  return frontmatter.type !== undefined && frontmatter.published !== undefined;
}

export async function transformBookSearchFile(
  app: App,
  file: TFile,
  frontmatter: Record<string, unknown>,
  readingsFolder: string
): Promise<boolean> {
  if (!isBookSearchFile(frontmatter)) return false;
  if (hasLnkdFields(frontmatter)) return false;

  const bsData = frontmatter as BookSearchFrontmatter;

  // Build the new frontmatter
  const today = new Date().toISOString().split("T")[0];
  const coverUrl = (bsData as any).coverUrl ?? bsData.cover ?? "";
  const rawCategories = bsData.categories ?? [];
  const categories = Array.isArray(rawCategories) ? rawCategories
    : typeof rawCategories === "string" ? [rawCategories] : [];
  const tags = categories
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean);

  // Read current file content
  const raw = await app.vault.read(file);

  // Find the end of frontmatter
  const fmEnd = raw.indexOf("---", 4);
  if (fmEnd === -1) return false;

  const existingFm = raw.slice(0, raw.indexOf("\n", fmEnd) + 1);
  const body = raw.slice(raw.indexOf("\n", fmEnd) + 1);

  // Build new frontmatter preserving book-search fields + adding ours
  const newFmLines = [
    "---",
    `title: "${(bsData.title ?? "").replace(/"/g, '\\"')}"`,
    `author: "${(bsData.author ?? "Unknown").replace(/"/g, '\\"')}"`,
    `type: book`,
    `rating: `,
    `tags: [${tags.join(", ")}]`,
    `published: false`,
    `publishedAt: "${today}"`,
  ];

  if (coverUrl) {
    newFmLines.push(`coverUrl: "${coverUrl}"`);
  }
  if (bsData.isbn) newFmLines.push(`isbn: "${bsData.isbn}"`);
  if (bsData.isbn13) newFmLines.push(`isbn13: "${bsData.isbn13}"`);
  if (bsData.publisher) newFmLines.push(`publisher: "${bsData.publisher}"`);
  if (bsData.totalPage) newFmLines.push(`totalPage: ${bsData.totalPage}`);

  newFmLines.push("---");

  // Add a notes section if the body is empty
  const newBody = body.trim()
    ? body
    : "\n## Notes\n\n\n";

  const newContent = newFmLines.join("\n") + "\n" + newBody;

  // Write the transformed file
  await app.vault.modify(file, newContent);

  // Move to readings folder if not already there
  if (!file.path.startsWith(readingsFolder + "/")) {
    const newPath = `${readingsFolder}/${file.name}`;
    try {
      await app.fileManager.renameFile(file, newPath);
    } catch (e) {
      console.warn(`LNKD: could not move ${file.name} to ${readingsFolder}/`, e);
    }
  }

  console.log(`LNKD: transformed book-search file "${bsData.title}" → readings format`);
  return true;
}
