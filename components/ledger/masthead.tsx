"use client";

import { useEffect, useState } from "react";
import LedgerMark from "@/components/ledger/mark";
import TypeLine from "@/components/ledger/type-line";

function filingMeta(now: Date): { date: string; edition: number } {
  // Day-of-year from the local CALENDAR date via UTC math — a floored
  // millisecond difference drifts an hour on DST days and shows yesterday's
  // edition for the first hour after midnight.
  const edition = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(now.getFullYear(), 0, 0)) /
      86_400_000,
  );
  return {
    date: now
      .toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
      .toUpperCase(),
    edition,
  };
}

/**
 * The masthead — the landing's loud register. The wordmark runs at newspaper
 * scale while its red plate visibly registers (ol-plate-register), and the
 * dateline row reads like a press docket: edition left, coordinates right.
 * The date and edition are computed at render so they exist in server HTML
 * (crawlers, previews, no-JS readers get a dated edition line, not a "———"
 * placeholder); the effect then re-files them in the visitor's local
 * calendar, and suppressHydrationWarning absorbs the server/client clock
 * difference in between.
 */
export default function Masthead() {
  const [today, setToday] = useState(() => filingMeta(new Date()));

  useEffect(() => {
    // The re-render is the point: swap the server-rendered date for the
    // visitor's local calendar after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(filingMeta(new Date()));
  }, []);

  return (
    <div>
      <div className="flex items-end justify-between gap-6">
        <div className="flex items-end gap-4 md:gap-6 min-w-0">
          <LedgerMark
            size={64}
            interactive
            className="shrink-0 mb-2 md:mb-3"
          />
          <h1 className="ol-plate-register font-bold leading-[0.85] tracking-tight text-[clamp(4.5rem,13vw,11rem)] select-none">
            LNKD
          </h1>
        </div>
        <div className="text-right shrink-0 hidden sm:block pb-2">
          <p
            suppressHydrationWarning
            className="ol-mono text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]"
          >
            {today.date}
          </p>
        </div>
      </div>

      <p className="ol-mono text-xs font-bold uppercase text-[var(--color-text-secondary)] mt-4 md:mt-5">
        <TypeLine text="Applications, writing, and the weekly letter — filed by Matthew Dumas" />
      </p>

      {/* The dateline: edition left, coordinates right. Its bottom rule is
          shared with the wire ticker directly beneath it. */}
      <div className="mt-6 flex items-center justify-between gap-4 border-y-2 border-[var(--color-border)] py-2">
        <p
          suppressHydrationWarning
          className="ol-mono text-[11px] font-bold uppercase tracking-widest"
        >
          Edition Nº {today.edition} · Ledger balanced daily
        </p>
        <p className="ol-mono text-[11px] uppercase tracking-widest text-[var(--color-text-secondary)] hidden sm:block">
          47.60°N · 122.33°W — Seattle WA
        </p>
      </div>
    </div>
  );
}
