"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import ActivityHeatmap from "./activity-heatmap";
import ReadingStats from "./reading-stats";

export default function Sidebar() {
  const stats = useQuery(api.stats.activity);

  if (stats === undefined) {
    return (
      <aside className="space-y-8">
        <div className="animate-pulse space-y-4">
          <div className="h-3 bg-[var(--color-border)] rounded w-20" />
          <div className="h-24 bg-[var(--color-border)] rounded" />
          <div className="h-3 bg-[var(--color-border)] rounded w-24" />
          <div className="h-16 bg-[var(--color-border)] rounded" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="space-y-8">
      <ActivityHeatmap dates={stats.dates} />

      {/* Content counts */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
          Content
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
              {stats.counts.posts}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              Posts
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
              {stats.counts.readings}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              Readings
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
              {stats.counts.bookmarks}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              Bookmarks
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)]" />

      <ReadingStats stats={stats.readingStats} />
    </aside>
  );
}
