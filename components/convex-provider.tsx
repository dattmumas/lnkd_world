"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ReactNode, useMemo } from "react";

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convex = useMemo(
    () => {
      const url = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!url) {
        throw new Error(
          "NEXT_PUBLIC_CONVEX_URL is not set. " +
          "Check .env.local (dev) or .env.production (prod)."
        );
      }
      return new ConvexReactClient(url);
    },
    []
  );

  return (
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}
