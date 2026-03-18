"use client";

import { ConvexReactClient } from "convex/react";
import { Authenticated } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ReactNode, useMemo } from "react";
import EnsureUser from "./ensure-user";

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convex = useMemo(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
    []
  );

  return (
    <ConvexAuthProvider client={convex}>
      <Authenticated>
        <EnsureUser />
      </Authenticated>
      {children}
    </ConvexAuthProvider>
  );
}
