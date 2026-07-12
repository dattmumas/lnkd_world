"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * EXHIBIT A — the middle weight. The label is a header strip ON the box (not
 * floating above it), so the exhibit reads as one filed object.
 */
export default function AppsLedger() {
  const projects = useQuery(api.projects.list);

  return (
    <section className="mt-10">
      <div className="ol-box">
        <div className="ol-box-head flex items-baseline justify-between gap-4">
          <span>
            Exhibit A
            <span className="text-[var(--color-text-secondary)] font-normal">
              &nbsp;&nbsp;·&nbsp;&nbsp;Applications
            </span>
          </span>
        </div>

        <div className="px-5 py-4 space-y-4">
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
      </div>
    </section>
  );
}
