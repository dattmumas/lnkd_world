"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { fmtAmount } from "@/components/deals-feed";
import { utcDayStartMs } from "@/lib/format";

/**
 * MARKETS — the deal radar reduced to a broadsheet column: the five latest
 * filings as ledger rows (by announcement date — backfills never top the
 * column), and a 7-day raise histogram at the foot. All bucketing happens
 * server-side in UTC (deals.landingSummary), matching announcedAt's
 * UTC-midnight convention; the column subscribes to that small payload, not
 * the full deals table.
 */
export default function MarketsColumn() {
  const summary = useQuery(api.deals.landingSummary, {
    todayStartMs: utcDayStartMs(),
  });

  const latest = summary?.latest ?? [];
  const week = summary?.dayCounts ?? [];
  const maxCount = Math.max(1, ...week.map((d) => d.count));

  return (
    <section className="h-full">
      <div className="ol-box h-full flex flex-col">
        <div className="ol-box-head flex items-baseline justify-between gap-4">
          <span>
            Markets
            <span className="text-[var(--color-text-secondary)] font-normal">
              &nbsp;&nbsp;·&nbsp;&nbsp;Deal flow
            </span>
          </span>
          <Link
            href="/deals"
            className="text-[var(--color-accent)] hover:underline underline-offset-4 shrink-0"
          >
            Radar →
          </Link>
        </div>

        <div className="px-5 py-4 flex-1 flex flex-col">
          {summary === undefined ? (
            <p className="ol-mono text-sm text-[var(--color-text-secondary)]">
              RECEIVING TICKER…
            </p>
          ) : latest.length === 0 ? (
            <p className="ol-mono text-sm text-[var(--color-text-secondary)]">
              NO FILINGS ON THE WIRE.
            </p>
          ) : (
            <ul className="space-y-3">
              {latest.map((d) => (
                <li key={d.id}>
                  <span className="ol-leader-row">
                    <span className="ol-mono text-xs font-bold uppercase truncate">
                      {d.company}
                    </span>
                    <span className="ol-leader" />
                    <span className="ol-mono text-xs font-bold text-[var(--color-accent)] shrink-0">
                      {fmtAmount(d)}
                    </span>
                  </span>
                  <span className="block ol-mono text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] mt-0.5">
                    {d.round}
                    {d.leadInvestor ? ` · led by ${d.leadInvestor}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* The week's raises, set as a histogram (UTC days, today last).
              Bars live in a fixed-height row: a percentage height against an
              auto-height parent resolves to zero and the bar collapses. */}
          {week.length > 0 && (
            <div className="mt-auto pt-4 border-t border-[var(--color-border-soft)]">
              <p className="ol-mono text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
                Raises · last 7 days
              </p>
              <div className="mt-2 flex items-end gap-1.5 h-10">
                {week.map((d, i) => (
                  <span
                    key={i}
                    title={`${d.count} raised`}
                    className={`flex-1 ${i === week.length - 1 ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"}`}
                    style={{
                      height: `${Math.max(d.count > 0 ? 10 : 3, (d.count / maxCount) * 100)}%`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-1 flex gap-1.5">
                {week.map((d, i) => (
                  <span
                    key={i}
                    className="flex-1 text-center ol-mono text-[9px] text-[var(--color-text-secondary)] select-none"
                  >
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
