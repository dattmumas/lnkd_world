"use client";

import dynamic from "next/dynamic";

// Client-only: AG-Grid is a large module graph and needs the DOM — evaluating
// it during SSR risks the Workers CPU budget (same treatment as Markdown).
const DealsGrid = dynamic(() => import("@/components/deals-grid"), {
  ssr: false,
  loading: () => (
    <p className="ol-mono text-sm text-[var(--color-text-secondary)]">
      PRINTING THE LEDGER…
    </p>
  ),
});

export default function DealsGridLoader() {
  return <DealsGrid />;
}
