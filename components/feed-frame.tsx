"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

const REFRESHABLE = new Set(["x-trends", "creators", "teardown", "science"]);

/** Renders a snapshot feed (HTML in an iframe) + an admin refresh button. */
export function FeedFrame({ slug }: { slug: string }) {
  const page = useQuery(api.feed.getPage, { slug });
  const user = useQuery(api.users.currentUser);
  const refreshXTrends = useAction(api.xTrends.refresh);
  const refreshCreators = useAction(api.creators_feed.refresh);
  const refreshTeardown = useAction(api.teardown.refresh);
  const refreshScience = useAction(api.scienceFeed.refresh);
  const [state, setState] = useState("");

  const canRefresh = user?.role === "admin" && REFRESHABLE.has(slug);

  const onRefresh = async () => {
    setState("Refreshing…");
    try {
      const fn =
        slug === "creators"
          ? refreshCreators
          : slug === "teardown"
            ? refreshTeardown
            : slug === "science"
              ? refreshScience
              : refreshXTrends;
      const r = await fn();
      setState(`Updated — ${r.count} item${r.count === 1 ? "" : "s"}`);
    } catch {
      setState("Refresh failed — check logs.");
    }
  };

  return (
    <div>
      {canRefresh && (
        <div className="flex items-center justify-end gap-3 mb-3">
          {state && (
            <span className="text-xs text-[var(--color-text-secondary)]">{state}</span>
          )}
          <button
            onClick={() => void onRefresh()}
            disabled={state === "Refreshing…"}
            className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 hover:bg-[var(--color-border)]/30 disabled:opacity-60"
          >
            Refresh
          </button>
        </div>
      )}
      {page === undefined ? (
        <p className="text-[var(--color-text-secondary)] text-sm">Loading…</p>
      ) : page === null ? (
        <p className="text-[var(--color-text-secondary)] text-sm">
          That feed doesn&apos;t exist.
        </p>
      ) : (
        <iframe
          srcDoc={page.html}
          title={page.title}
          allow="clipboard-write"
          className="w-full rounded-lg border border-[var(--color-border)] bg-white"
          style={{ height: "calc(100vh - 230px)", minHeight: 600 }}
        />
      )}
    </div>
  );
}
