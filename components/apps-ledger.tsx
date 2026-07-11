"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * EXHIBIT A on the landing: everything Matthew runs, as ledger line items.
 * Bonds is first-party (hardcoded); the rest streams from the projects table
 * so a future app is a data row, not a code change.
 */
export default function AppsLedger() {
  const projects = useQuery(api.projects.list);

  return (
    <section className="mt-10">
      <p className="ol-label">
        <span className="text-[var(--color-text)]">EXHIBIT A</span>
        <span className="text-[var(--color-text-secondary)] font-normal">
          &nbsp;&nbsp;·&nbsp;&nbsp;APPLICATIONS
        </span>
      </p>

      <div className="ol-box mt-2 px-5 py-4 space-y-4">
        <Link href="/bonds" className="block group">
          <span className="ol-leader-row">
            <span className="ol-mono text-sm font-bold group-hover:text-[var(--color-accent)]">
              BONDS TERMINAL
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
            <span className="ol-mono text-sm font-bold group-hover:text-[var(--color-accent)]">
              DEAL RADAR
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
              <span className="ol-mono text-sm font-bold uppercase group-hover:text-[var(--color-accent)]">
                {p.title}
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
        <p className="ol-mono text-[10px] text-[var(--color-leader)] text-center uppercase tracking-widest pt-1 select-none">
          — Remainder of this exhibit intentionally left open —
        </p>
      </div>
    </section>
  );
}
