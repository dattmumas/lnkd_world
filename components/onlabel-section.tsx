"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import SubscribeForm from "@/components/onlabel/subscribe-form";

function cardDate(ms: number): string {
  return new Date(ms)
    .toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

/**
 * EXHIBIT B — the page's anchor. Ink header bar, tan body, the one vermilion
 * shadow on the page. The latest issues nest inside it: they're FROM the
 * letter, so they live in the letter's box.
 */
export default function OnLabelSection() {
  const site = useQuery(api.beehiiv.archive);
  const latest = (site?.posts ?? []).slice(0, 2);

  return (
    <section className="mt-10">
      <div className="ol-panel-anchor bg-[var(--color-fill-tan)]">
        {/* Header bar — ink, the loudest label on the page */}
        <div className="flex items-baseline justify-between gap-4 bg-[var(--color-text)] text-[var(--color-bg)] px-5 py-2.5">
          <p className="ol-mono text-xs font-bold uppercase tracking-widest">
            Exhibit B&nbsp;&nbsp;·&nbsp;&nbsp;The Weekly Letter
          </p>
          <span className="text-[var(--color-accent)] leading-none select-none">■</span>
        </div>

        <div className="px-5 py-5">
          <h2
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display), Helvetica, sans-serif" }}
          >
            ON LABEL
          </h2>
          <p className="text-[15px] leading-relaxed mt-2 max-w-xl">
            A weekly letter on all things consumer — CPG, health, and technology. Who
            raised, what they&apos;re actually selling, and whether the numbers
            work.
          </p>
          {site !== undefined && site.subscriberCount > 0 && (
            <p className="ol-mono text-xs text-[var(--color-text-secondary)] mt-2">
              {`READ BY ${site.subscriberCount.toLocaleString()} FOUNDERS, OPERATORS & INVESTORS`}
            </p>
          )}
          <div className="mt-4">
            <SubscribeForm />
          </div>
        </div>

        {/* From the letter — nested filings on paper */}
        {latest.length > 0 && (
          <div className="px-5 pb-5">
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <p className="ol-mono text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
                From the letter
              </p>
              <Link
                href="/onlabel/archive"
                className="ol-mono text-[11px] font-bold text-[var(--color-accent)] hover:underline underline-offset-4 shrink-0"
              >
                FULL ARCHIVE →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {latest.map((post) => (
                <a
                  key={post.id}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col px-4 py-3.5 bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
                >
                  <span className="ol-mono text-[10px] font-bold text-[var(--color-text-secondary)] tracking-widest">
                    {cardDate(post.publishedAt)}
                  </span>
                  <span
                    className="text-[17px] font-bold leading-snug mt-1.5 group-hover:text-[var(--color-accent)]"
                    style={{ fontFamily: "var(--font-display), Helvetica, sans-serif" }}
                  >
                    {post.title}
                  </span>
                  {post.subtitle && (
                    <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-1.5 line-clamp-2">
                      {post.subtitle}
                    </span>
                  )}
                  <span className="ol-mono text-xs font-bold text-[var(--color-accent)] mt-auto pt-3">
                    READ →
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
