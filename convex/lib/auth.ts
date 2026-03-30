import { QueryCtx, MutationCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Constant-time string comparison to prevent timing attacks on secret comparison */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Require authenticated user with admin role.
 * Uses getAuthUserId() for direct user lookup — no email resolution needed.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");

  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized: admin required");
  }
  return user;
}

/**
 * Require any authenticated user (subscriber or admin).
 */
export async function requireSubscriber(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");

  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Unauthorized: no user record");
  return user;
}

/** Verifies the sync secret using constant-time comparison */
export function verifySyncSecret(provided: string): void {
  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret || !timingSafeEqual(provided, syncSecret)) {
    throw new Error("Unauthorized: invalid sync secret");
  }
}
