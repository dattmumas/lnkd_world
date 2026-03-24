/**
 * Estimate reading time for markdown content.
 * ~238 WPM (average adult reading speed for non-fiction).
 */
export function readingTime(content: string): number {
  // Strip markdown syntax, HTML tags, and frontmatter
  const plain = content
    .replace(/^---[\s\S]*?---/m, "") // frontmatter
    .replace(/```[\s\S]*?```/g, "") // code blocks (still count, but less)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
    .replace(/[#*_~`>|]/g, "") // markdown chars
    .replace(/<[^>]+>/g, "") // HTML tags
    .replace(/\s+/g, " ")
    .trim();

  const words = plain.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 238));
}
