import { QueryCtx, MutationCtx } from "../_generated/server";

/** Constant-time string comparison to prevent timing attacks on secret comparison */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .first();

  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized: admin required");
  }
  return user;
}

export async function requireSubscriber(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .first();

  if (!user) throw new Error("Unauthorized: subscriber required");
  return user;
}

/** Verifies the sync secret using constant-time comparison */
export function verifySyncSecret(provided: string): void {
  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret || !timingSafeEqual(provided, syncSecret)) {
    throw new Error("Unauthorized: invalid sync secret");
  }
}
