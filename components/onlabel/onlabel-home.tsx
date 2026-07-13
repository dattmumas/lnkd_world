"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import SubscribeForm from "@/components/onlabel/subscribe-form";
import LedgerMark from "@/components/ledger/mark";
import Tear from "@/components/ledger/tear";
import TypeLine from "@/components/ledger/type-line";

function issueDate(ms: number): string {
  return new Date(ms)
    .toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

/**
 * The On Label front door, on the landing's weight scale: the letter panel is
 * the single anchor (ink header bar, tan body, the page's one vermilion
 * shadow), latest entries are a filed box with a header strip ON it, and the
 * standing call drops to marginalia behind a dashed rule.
 */
export default function OnLabelHome() {
  const site = useQuery(api.beehiiv.archive);
  const latest = (site?.posts ?? []).slice(0, 4);

  return (
    <>
      {/* Masthead */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <LedgerMark size={48} className="shrink-0" interactive />
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight ol-misprint">
              ON LABEL
            </h1>
          </div>
          <p className="ol-mono text-xs font-bold text-[var(--color-text-secondary)] mt-4 uppercase">
            <TypeLine text="All things consumer — CPG · health · tech · Written weekly in Seattle" />
            {site !== undefined && site.subscriberCount > 0 && (
              <> · Read by {site.subscriberCount.toLocaleString()} operators</>
            )}
          </p>
        </div>

        {/* Filing meta — the receipt's corner */}
        <p className="ol-mono text-[10px] text-[var(--color-text-secondary)] text-right leading-relaxed uppercase shrink-0 hidden sm:block mt-2">
          Filed weekly
          <br />
          Free · Unsubscribe anytime
        </p>
      </div>

      <Tear className="mt-8 text-[var(--color-border)]" />

      {/* The anchor — ink header bar, tan body, the one vermilion shadow.
          Full-width band: pitch left, capture right on wide screens, so the
          panel never leaves a dead column beneath it. */}
      <section className="mt-10">
        <div className="ol-panel-anchor bg-[var(--color-fill-tan)]">
          <div className="flex items-baseline justify-between gap-4 bg-[var(--color-text)] text-[var(--color-bg)] px-5 py-2.5">
            <p className="ol-mono text-xs font-bold uppercase tracking-widest">
              The Weekly Letter
            </p>
            <span className="text-[var(--color-accent)] leading-none select-none">■</span>
          </div>

          <div className="px-5 py-5 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-12 lg:items-center">
            <div className="space-y-3 text-[15px] leading-relaxed max-w-xl">
              <p>
                I write about consumer companies — CPG, health, and technology. Who
                raised, what they&apos;re actually selling, and whether the
                numbers work.
              </p>
              <p>
                Most weeks that&apos;s a few funding rounds, one product or
                business model taken apart in detail, and a prediction I can
                be graded on later.
              </p>
            </div>
            <div>
              <p className="ol-mono text-xs font-bold text-[var(--color-text-secondary)]">
                FREE · WEEKLY · UNSUBSCRIBE ANYTIME
              </p>
              <div className="mt-3">
                <SubscribeForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The entry log — middle weight, label as a header strip ON the box.
          Cards run in a row and wrap down as the viewport narrows. */}
      <section className="mt-10">
        <div className="ol-box">
          <div className="ol-box-head flex items-baseline justify-between gap-4">
            <span>Latest entries</span>
            <Link
              href="/onlabel/archive"
              className="text-[var(--color-accent)] hover:underline underline-offset-4 shrink-0"
            >
              Full archive →
            </Link>
          </div>
          <div className="px-5 py-4">
            {site === undefined ? (
              <p className="ol-mono text-sm text-[var(--color-text-secondary)]">
                LOADING LEDGER…
              </p>
            ) : latest.length === 0 ? (
              <p className="ol-mono text-sm text-[var(--color-text-secondary)]">
                NO ENTRIES YET — ISSUE Nº 001 IS IN THE PRINTER.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {latest.map((p) => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
                  >
                    {p.thumbnail && (
                      <span className="block aspect-[1200/630] overflow-hidden border-b border-[var(--color-border)]">
                        <img
                          src={p.thumbnail}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </span>
                    )}
                    <span className="flex flex-col flex-1 px-4 py-3.5">
                      <span className="ol-mono text-[10px] font-bold text-[var(--color-text-secondary)] tracking-widest">
                        {issueDate(p.publishedAt)}
                      </span>
                      <span
                        className="text-[17px] font-bold leading-snug mt-1.5 group-hover:text-[var(--color-accent)]"
                        style={{ fontFamily: "var(--font-display), Helvetica, sans-serif" }}
                      >
                        {p.title}
                      </span>
                      {p.subtitle && (
                        <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-1.5 line-clamp-2">
                          {p.subtitle}
                        </span>
                      )}
                      <span className="ol-mono text-xs font-bold text-[var(--color-accent)] mt-auto pt-3">
                        READ →
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* The standing call — marginalia, as a standing convention should be */}
      <section className="mt-8">
        <hr className="ol-rule-dashed" />
        <p className="ol-mono text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mt-3">
          The standing call
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
          One prediction per issue, with a deadline. Results get logged here,
          right or wrong.
        </p>
      </section>
    </>
  );
}
