import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

const ADMIN_EMAIL = "mttdumas@gmail.com";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, profile }) {
      // This fires server-side on every sign-in/sign-up
      // profile.email comes directly from the Password provider — canonical source
      const email = profile.email;
      if (!email) return;

      const user = await ctx.db.get(userId);
      if (!user) return;

      // Set role based on email (admin detection)
      const role = email === ADMIN_EMAIL ? "admin" : "subscriber";
      const patches: Record<string, unknown> = {};

      // Always ensure email is stored on the user record
      if (!user.email || user.email !== email) {
        patches.email = email;
      }

      // Set or fix role
      if (!user.role || (email === ADMIN_EMAIL && user.role !== "admin")) {
        patches.role = role;
      }

      // First sign-up: set initial role
      if (!user.role) {
        patches.role = role;
      }

      if (Object.keys(patches).length > 0) {
        await ctx.db.patch(userId, patches);
      }
    },
  },
});
