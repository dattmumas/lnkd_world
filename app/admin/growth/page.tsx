"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Nav from "@/components/nav";
import { QueueFeed } from "@/components/queue-feed";
import { DealsFeed } from "@/components/deals-feed";
import { OverviewTab } from "@/components/growth/overview-tab";
import { PipelineTab } from "@/components/growth/pipeline-tab";
import { AnalyticsTab } from "@/components/growth/analytics-tab";

const TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "queue", label: "Queue" },
  { slug: "deals", label: "Deals" },
  { slug: "pipeline", label: "Pipeline" },
  { slug: "analytics", label: "Analytics" },
];

/**
 * The X growth dashboard: follower curve and daily targets (Overview), the
 * content pipeline (Pipeline), performance + reply ROI + weekly review
 * (Analytics), and the engagement queue (Queue). All engagement and posting is
 * human — the system preps, times, drafts, and measures.
 *
 * Wrapped in .growth-console (globals.css): a scoped light ops theme that
 * remaps the site's CSS variables, so child components restyle without edits.
 */
export default function GrowthDashboard() {
  const [active, setActive] = useState("overview");
  // Same subscriptions the tabs hold — Convex dedupes, so the count is free.
  const queue = useQuery(api.queue.getQueue);
  const crons = useQuery(api.cronHealth.list);
  const machine =
    crons === undefined || crons.length === 0
      ? "idle"
      : crons.every((c) => c.ok)
        ? "ok"
        : "fault";

  // Deep-link / persist via the URL hash (no page nav — instant switching).
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "");
      if (TABS.some((t) => t.slug === h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const select = (slug: string) => {
    setActive(slug);
    history.replaceState(null, "", `#${slug}`);
  };

  return (
    <div className="growth-console">
      <main className="max-w-[1400px] mx-auto px-6 pb-16">
        <Nav />
        <div className="flex items-center gap-2.5 mt-8 mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Growth</h1>
          <span
            className={`gc-live-dot ${machine}`}
            title={
              machine === "fault"
                ? "A cron failed — details in the health strip on Overview"
                : machine === "ok"
                  ? "All crons reporting ok"
                  : "Waiting for cron reports"
            }
          />
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] mb-5">
          {TABS.map((t) => (
            <button
              key={t.slug}
              onClick={() => select(t.slug)}
              className={`gc-tab ${active === t.slug ? "gc-tab-active" : ""}`}
            >
              {t.label}
              {t.slug === "queue" && (queue?.length ?? 0) > 0 && (
                <span className="gc-tab-count">{queue!.length}</span>
              )}
            </button>
          ))}
        </div>

        {active === "overview" && <OverviewTab />}
        {active === "queue" && <QueueFeed />}
        {active === "deals" && <DealsFeed />}
        {active === "pipeline" && <PipelineTab />}
        {active === "analytics" && <AnalyticsTab />}
      </main>
    </div>
  );
}
