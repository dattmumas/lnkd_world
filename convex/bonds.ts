import {
  query,
  action,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";

/**
 * Get the latest bonds dashboard snapshot.
 * Public query — dashboard data is not gated.
 */
export const latest = query({
  handler: async (ctx) => {
    const snapshot = await ctx.db
      .query("bondsSnapshots")
      .withIndex("by_createdAt")
      .order("desc")
      .first();

    if (!snapshot) return null;

    return {
      _id: snapshot._id,
      generatedAt: snapshot.generatedAt,
      version: snapshot.version,
      status: snapshot.status,
      data: snapshot.data, // Client will JSON.parse this
      createdAt: snapshot.createdAt,
    };
  },
});

/**
 * Get snapshot history (last N snapshots, metadata only — no data blob).
 */
export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const n = limit ?? 7;
    const snapshots = await ctx.db
      .query("bondsSnapshots")
      .withIndex("by_createdAt")
      .order("desc")
      .take(n);

    return snapshots.map((s) => ({
      _id: s._id,
      generatedAt: s.generatedAt,
      version: s.version,
      status: s.status,
      createdAt: s.createdAt,
    }));
  },
});

/**
 * Internal mutation to ingest a new snapshot (called from HTTP action).
 */
export const ingest = internalMutation({
  args: {
    generatedAt: v.string(),
    version: v.string(),
    status: v.string(),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    // Keep only last 30 snapshots to manage storage
    const old = await ctx.db
      .query("bondsSnapshots")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);

    if (old.length > 30) {
      const toDelete = old.slice(0, old.length - 30);
      for (const snap of toDelete) {
        await ctx.db.delete(snap._id);
      }
    }

    return await ctx.db.insert("bondsSnapshots", {
      generatedAt: args.generatedAt,
      version: args.version,
      status: args.status,
      data: args.data,
      createdAt: new Date().toISOString(),
    });
  },
});

/**
 * Internal admin gate for the trigger action (actions have no db access, so the
 * role check runs as a query). Throws if the caller is not an authenticated admin.
 */
export const _assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

/**
 * Kick off a fresh dashboard build. Admin-only — it spends GitHub Actions minutes.
 * Fires a repository_dispatch at the bonds pipeline repo; the workflow regenerates
 * the snapshot and POSTs it back to /api/bonds/ingest, after which the `latest`
 * query updates reactively and the page re-renders.
 */
export const triggerRefresh = action({
  args: {},
  returns: v.object({ ok: v.boolean(), requestedAt: v.string() }),
  handler: async (ctx) => {
    // Gate on admin (annotation works around same-file runQuery circularity).
    const _admin: null = await ctx.runQuery(internal.bonds._assertAdmin, {});

    const token = process.env.GITHUB_DISPATCH_TOKEN;
    const repo = process.env.GITHUB_REPO; // "owner/repo"
    if (!token || !repo) {
      throw new Error(
        "Refresh not configured: set GITHUB_DISPATCH_TOKEN and GITHUB_REPO in the Convex environment."
      );
    }

    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "lnkd-world-bonds-refresh",
      },
      body: JSON.stringify({ event_type: "refresh-dashboard" }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(
        `GitHub dispatch failed (${res.status}): ${detail.slice(0, 200)}`
      );
    }

    return { ok: true, requestedAt: new Date().toISOString() };
  },
});
