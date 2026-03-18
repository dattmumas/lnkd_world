"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const ConvexClientProvider = dynamic(
  () => import("@/components/convex-provider"),
  { ssr: false }
);

export default function ClientLayout({ children }: { children: ReactNode }) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
