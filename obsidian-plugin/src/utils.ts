import { createHash } from "crypto";
import { TFile } from "obsidian";

export function slugFromPath(filePath: string): string {
  const name = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function contentHash(content: string, title: string, tags: string[]): string {
  return createHash("sha256")
    .update(content + "\0" + title + "\0" + JSON.stringify(tags))
    .digest("hex")
    .slice(0, 32);
}

export function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const yamlBlock = match[1];
  const content = match[2];
  const data: Record<string, unknown> = {};

  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    // Parse arrays: [item1, item2]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
    // Parse booleans
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    // Parse numbers
    else if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
      value = Number(value);
    }
    // Strip quotes
    else if (typeof value === "string") {
      value = value.replace(/^["']|["']$/g, "");
    }

    if (key) data[key] = value;
  }

  return { data, content };
}

export type ContentType = "post" | "reading" | "bookmark" | "now";

export function getContentType(
  file: TFile,
  folders: { posts: string; readings: string; bookmarks: string },
  nowFile: string
): ContentType | null {
  const path = file.path;
  if (path === nowFile) return "now";
  if (path.startsWith(folders.posts + "/")) return "post";
  if (path.startsWith(folders.readings + "/")) return "reading";
  if (path.startsWith(folders.bookmarks + "/")) return "bookmark";
  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
