import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

// Access is enforced client-side by <AuthGuard> on each gated page and at the
// data layer by Convex (`requireSubscriber` / `requireAdmin`). We do NOT gate in
// middleware: this app authenticates client-side (ConvexAuthProvider) and never
// sets the `convexAuthNextjsToken` cookie that `convexAuth.isAuthenticated()`
// reads, so the old server-side redirects bounced even logged-in users to
// /subscribe. Pass-through only.
export default convexAuthNextjsMiddleware();

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
