import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listBySlug = query({
  args: {
    slug: v.string(),
    contentType: v.union(v.literal("post"), v.literal("reading"), v.literal("bookmark")),
  },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("versions")
      .withIndex("by_slug_and_type", (q) =>
        q.eq("slug", args.slug).eq("contentType", args.contentType)
      )
      .collect();
    return versions
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ content: _, ...rest }) => rest);
  },
});

export const getVersionPair = query({
  args: {
    currentId: v.id("versions"),
    previousId: v.optional(v.id("versions")),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.currentId);
    const previous = args.previousId ? await ctx.db.get(args.previousId) : null;
    return { current, previous };
  },
});

export const createVersion = mutation({
  args: {
    secret: v.string(),
    slug: v.string(),
    contentType: v.union(v.literal("post"), v.literal("reading"), v.literal("bookmark")),
    contentHash: v.string(),
    content: v.string(),
    title: v.string(),
    changeType: v.optional(v.union(
      v.literal("edit"), v.literal("restructure"), v.literal("expand"), v.literal("restore")
    )),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const syncSecret = process.env.SYNC_SECRET;
    if (!syncSecret || args.secret !== syncSecret) {
      throw new Error("Unauthorized: invalid sync secret");
    }

    const existing = await ctx.db
      .query("versions")
      .withIndex("by_slug_and_type", (q) =>
        q.eq("slug", args.slug).eq("contentType", args.contentType)
      )
      .collect();

    const latest = existing.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (latest && latest.contentHash === args.contentHash) {
      return { action: "unchanged" as const };
    }

    const { secret: _, ...fields } = args;
    const id = await ctx.db.insert("versions", fields);
    return { action: "created" as const, id };
  },
});

export const restore = mutation({
  args: {
    secret: v.string(),
    slug: v.string(),
    contentType: v.union(v.literal("post"), v.literal("reading"), v.literal("bookmark")),
    versionId: v.id("versions"),
  },
  handler: async (ctx, args) => {
    const syncSecret = process.env.SYNC_SECRET;
    if (!syncSecret || args.secret !== syncSecret) {
      throw new Error("Unauthorized: invalid sync secret");
    }

    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");

    // Find current document
    const table = args.contentType === "post" ? "posts"
      : args.contentType === "reading" ? "readings" : "bookmarks";
    const current = await ctx.db
      .query(table)
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!current) throw new Error("Document not found");

    // Patch the document with restored content
    await ctx.db.patch(current._id, {
      content: version.content,
      title: version.title,
    });

    // Create a new version entry for the restore (audit trail)
    await ctx.db.insert("versions", {
      slug: args.slug,
      contentType: args.contentType,
      contentHash: version.contentHash,
      content: version.content,
      title: version.title,
      changeType: "restore",
      createdAt: new Date().toISOString(),
    });

    return { action: "restored" as const };
  },
});
