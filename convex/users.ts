import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get the current authenticated user.
 *
 * Uses getAuthUserId() from @convex-dev/auth — this returns the userId
 * from the auth session, which maps directly to a record in our `users` table.
 * No dual-lookup, no email resolution, no fallback chains.
 *
 * The user record is populated by the afterUserCreatedOrUpdated callback
 * in convex/auth.ts, which fires server-side on sign-in/sign-up.
 */
export const currentUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});


