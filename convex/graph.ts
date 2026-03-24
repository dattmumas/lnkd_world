import { query } from "./_generated/server";
import { v } from "convex/values";

export const nodes = query({
  handler: async (ctx) => {
    const [posts, readings, bookmarks] = await Promise.all([
      ctx.db.query("posts").withIndex("by_published", (q) => q.eq("published", true)).collect(),
      ctx.db.query("readings").withIndex("by_published", (q) => q.eq("published", true)).collect(),
      ctx.db.query("bookmarks").withIndex("by_published", (q) => q.eq("published", true)).collect(),
    ]);

    const nodes = [
      ...posts.map((p) => ({
        id: p.slug,
        type: "post" as const,
        title: p.title,
        slug: p.slug,
        tags: p.tags,
        wikilinksResolved: p.wikilinksResolved ?? [],
        backlinks: p.backlinks ?? [],
        href: `/writing/${p.slug}`,
        publishedAt: p.publishedAt,
        featured: p.featured ?? false,
      })),
      ...readings.map((r) => ({
        id: r.slug,
        type: "reading" as const,
        title: r.title,
        slug: r.slug,
        tags: r.tags,
        wikilinksResolved: r.wikilinksResolved ?? [],
        backlinks: r.backlinks ?? [],
        href: `/reading`,
        publishedAt: r.publishedAt,
        featured: r.featured ?? false,
      })),
      ...bookmarks.map((b) => ({
        id: b.slug,
        type: "bookmark" as const,
        title: b.title,
        slug: b.slug,
        tags: b.tags,
        wikilinksResolved: b.wikilinksResolved ?? [],
        backlinks: b.backlinks ?? [],
        href: `/bookmarks`,
        publishedAt: b.publishedAt,
        featured: b.featured ?? false,
      })),
    ];

    // Build edges from wikilinks only (high-signal, intentional connections)
    const edges: { source: string; target: string }[] = [];
    const slugSet = new Set(nodes.map((n) => n.id));
    const edgeSet = new Set<string>();

    for (const n of nodes) {
      for (const link of n.wikilinksResolved) {
        if (slugSet.has(link) && link !== n.id) {
          const key = [n.id, link].sort().join("|");
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push({ source: n.id, target: link });
          }
        }
      }
    }

    // Compute node scores for ranking
    const inDegree: Record<string, number> = {};
    const outDegree: Record<string, number> = {};
    for (const n of nodes) {
      inDegree[n.id] = n.backlinks.length;
      outDegree[n.id] = n.wikilinksResolved.length;
    }

    const now = Date.now();
    const scoredNodes = nodes.map((n) => {
      const degree = (inDegree[n.id] ?? 0) + (outDegree[n.id] ?? 0);
      const ageMs = n.publishedAt
        ? now - new Date(n.publishedAt).getTime()
        : Infinity;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyBonus = Math.min(3, Math.max(0, 3 - ageDays / 30));
      const typeBoost = n.type === "post" ? 1 : 0;
      const featuredBoost = n.featured ? 10 : 0;
      const score = Math.log(1 + degree) * 2 + recencyBonus + typeBoost + featuredBoost;

      return { ...n, score };
    });

    return { nodes: scoredNodes, edges };
  },
});

export const layout = query({
  handler: async (ctx) => {
    const layouts = await ctx.db.query("graphLayout").collect();
    if (layouts.length === 0) return null;
    return layouts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  },
});

export const backlinksForSlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    // Check all three tables for the document
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (post) return post.backlinks ?? [];

    const reading = await ctx.db
      .query("readings")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (reading) return reading.backlinks ?? [];

    const bookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (bookmark) return bookmark.backlinks ?? [];

    return [];
  },
});
