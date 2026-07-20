"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * THE WIRE — the applications as filings. Middle weight: a tan-headed box
 * with a vermilion plate-stripe down its left edge; each entry carries a
 * small misregistered plate-square, the same press run as the masthead mark.
 */
export default function AppsLedger() {
  const projects = useQuery(api.projects.list);

  return (
    <section className="h-full">
      <div className="ol-box border-l-4 border-l-[var(--color-accent)] h-full flex flex-col">
        <div className="ol-box-head flex items-baseline justify-between gap-4">
          <span>
            The Wire
            <span className="text-[var(--color-text-secondary)] font-normal">
              &nbsp;&nbsp;·&nbsp;&nbsp;Applications
            </span>
          </span>
        </div>

        {/* Entries and the open line share the column's full height:
            justify-between spreads them, gap-4 is the floor when the box
            is short (mobile, or a busy projects list). */}
        <div className="px-5 py-4 flex-1 flex flex-col justify-between gap-4">
          <Link href="/bonds" className="block group">
            <span className="ol-leader-row">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 bg-[var(--color-border)] shadow-[2px_2px_0_0_var(--color-accent)]"
                  aria-hidden
                />
                <span className="ol-mono text-sm font-bold group-hover:text-[var(--color-accent)]">
                  BONDS TERMINAL
                </span>
              </span>
              <span className="ol-leader" />
              <span className="ol-mono text-xs font-bold text-[var(--color-accent)]">LIVE</span>
            </span>
            <span className="block text-sm text-[var(--color-text-secondary)] mt-0.5">
              A Bloomberg-style terminal for the bond market — curves, spreads, auctions.
            </span>
          </Link>

          <Link href="/deals" className="block group">
            <span className="ol-leader-row">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 bg-[var(--color-border)] shadow-[2px_2px_0_0_var(--color-accent)]"
                  aria-hidden
                />
                <span className="ol-mono text-sm font-bold group-hover:text-[var(--color-accent)]">
                  DEAL RADAR
                </span>
              </span>
              <span className="ol-leader" />
              <span className="ol-mono text-xs font-bold text-[var(--color-accent)]">LIVE</span>
            </span>
            <span className="block text-sm text-[var(--color-text-secondary)] mt-0.5">
              Venture funding deals, gathered and extracted automatically — sortable, filterable.
            </span>
          </Link>

          {(projects ?? []).map((p) => (
            <a
              key={p._id}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <span className="ol-leader-row">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 bg-[var(--color-border)] shadow-[2px_2px_0_0_var(--color-accent)]"
                    aria-hidden
                  />
                  <span className="ol-mono text-sm font-bold uppercase group-hover:text-[var(--color-accent)]">
                    {p.title}
                  </span>
                </span>
                <span className="ol-leader" />
                <span className="ol-mono text-xs text-[var(--color-text-secondary)]">↗</span>
              </span>
              <span className="block text-sm text-[var(--color-text-secondary)] mt-0.5">
                {p.description}
              </span>
            </a>
          ))}

          {/* The ledger convention for an open line */}
          <p className="ol-mono text-[10px] text-[var(--color-leader)] text-center uppercase tracking-widest select-none">
            — Remainder of this wire intentionally left open —
          </p>
        </div>
      </div>
    </section>
  );
}
