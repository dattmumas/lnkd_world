"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Markdown from "@/components/markdown";

export default function NowSection() {
  const now = useQuery(api.now.get);

  if (now === undefined) {
    return (
      <section className="mb-14">
        <div className="relative">
          <div className="absolute -left-3 top-0 bottom-0 w-px bg-gradient-to-b from-[var(--color-accent)] via-[var(--color-accent)]/40 to-transparent" />
          <div className="pl-5">
            <div className="animate-pulse space-y-3">
              <div className="h-3 bg-[var(--color-border)] rounded w-12" />
              <div className="h-4 bg-[var(--color-border)] rounded w-64" />
              <div className="h-4 bg-[var(--color-border)] rounded w-48" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!now) return null;

  const updatedDate = now.updatedAt
    ? new Date(now.updatedAt + "T00:00:00").toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <section className="mb-20">
      <div className="relative">
        {/* Accent line */}
        <div className="absolute -left-3 top-0 bottom-0 w-px bg-gradient-to-b from-[var(--color-accent)] via-[var(--color-accent)]/40 to-transparent" />

        <div className="pl-5">
          {/* Header */}
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
              Now
            </span>
            {updatedDate && (
              <span className="text-xs text-[var(--color-text-secondary)]/60">
                {updatedDate}
              </span>
            )}
          </div>

          {/* Content — rendered markdown, slightly larger and more spacious */}
          <div className="now-content text-[1.05rem] leading-[1.8] text-[var(--color-text)]/90">
            <Markdown content={now.content} />
          </div>
        </div>
      </div>
    </section>
  );
}
