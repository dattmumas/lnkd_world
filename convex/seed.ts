import { mutation } from "./_generated/server";

export const seedProjects = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("projects").collect();
    if (existing.length > 0) return "Already seeded";

    await ctx.db.insert("projects", {
      title: "LNKD",
      description: "Personal site built with Next.js, Convex, and Cloudflare Workers",
      href: "https://lnkd.world",
      order: 1,
    });

    return "Seeded initial projects";
  },
});
