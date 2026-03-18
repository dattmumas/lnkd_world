import { mutation } from "./_generated/server";

export const seedLinks = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("links").collect();
    if (existing.length > 0) return "Already seeded";

    await ctx.db.insert("links", {
      title: "Blog",
      description: "Writing on tech, building, and thinking out loud",
      href: "https://blog.lnkd.world",
      order: 1,
    });

    return "Seeded initial links";
  },
});
