"use client";

import { useEffect, useState } from "react";
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
 */
export default function GrowthDashboard() {
  const [active, setActive] = useState("overview");

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
    <main className="max-w-[1400px] mx-auto px-6 pb-16">
      <Nav />
      <h1 className="text-3xl font-semibold mt-8 mb-4">Growth</h1>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] mb-5">
        {TABS.map((t) => (
          <button
            key={t.slug}
            onClick={() => select(t.slug)}
            className={`shrink-0 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === t.slug
                ? "border-[var(--color-accent)] text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "overview" && <OverviewTab />}
      {active === "queue" && <QueueFeed />}
      {active === "deals" && <DealsFeed />}
      {active === "pipeline" && <PipelineTab />}
      {active === "analytics" && <AnalyticsTab />}
    </main>
  );
}
