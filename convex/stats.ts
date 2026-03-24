import { query } from "./_generated/server";

function wordCount(text: string): number {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_~`>|]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

/** Return all published dates + word counts for the heatmap and stats sidebar. */
export const activity = query({
  handler: async (ctx) => {
    // Heatmap includes ALL content (published + unpublished) to track writing volume
    const [allPosts, allReadings, allBookmarks] = await Promise.all([
      ctx.db.query("posts").collect(),
      ctx.db.query("readings").collect(),
      ctx.db.query("bookmarks").collect(),
    ]);

    // Stats only use published content
    const posts = allPosts.filter((p) => p.published);
    const readings = allReadings.filter((r) => r.published);
    const bookmarks = allBookmarks.filter((b) => b.published);

    // Collect dates + word counts for heatmap (ALL content, not just published)
    const dates: { date: string; type: "post" | "reading" | "bookmark"; words: number }[] = [];

    for (const p of allPosts) {
      // Use publishedAt if available, otherwise fall back to Convex creation time
      const date = p.publishedAt?.slice(0, 10) ?? new Date(p._creationTime).toISOString().slice(0, 10);
      dates.push({ date, type: "post", words: wordCount(p.content) });
    }
    for (const r of allReadings) {
      const date = r.publishedAt?.slice(0, 10) ?? new Date(r._creationTime).toISOString().slice(0, 10);
      dates.push({ date, type: "reading", words: wordCount(r.content) });
    }
    for (const b of allBookmarks) {
      const date = b.publishedAt?.slice(0, 10) ?? new Date(b._creationTime).toISOString().slice(0, 10);
      dates.push({ date, type: "bookmark", words: wordCount(b.description) });
    }

    // Reading stats
    const readingStats = {
      total: readings.length,
      byType: {} as Record<string, number>,
      byRating: {} as Record<number, number>,
      avgRating: 0,
      tags: {} as Record<string, number>,
    };

    let ratingSum = 0;
    let ratingCount = 0;
    for (const r of readings) {
      readingStats.byType[r.type] = (readingStats.byType[r.type] ?? 0) + 1;
      if (r.rating) {
        readingStats.byRating[r.rating] = (readingStats.byRating[r.rating] ?? 0) + 1;
        ratingSum += r.rating;
        ratingCount++;
      }
      for (const t of r.tags) {
        readingStats.tags[t] = (readingStats.tags[t] ?? 0) + 1;
      }
    }
    readingStats.avgRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;

    return {
      dates,
      counts: {
        posts: posts.length,
        readings: readings.length,
        bookmarks: bookmarks.length,
      },
      readingStats,
    };
  },
});
