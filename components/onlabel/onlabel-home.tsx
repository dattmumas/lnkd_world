"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import SubscribeForm from "@/components/onlabel/subscribe-form";

function issueDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** The On Label front door: pitch, capture, latest entries, the standing call. */
export default function OnLabelHome() {
  const site = useQuery(api.beehiiv.archive);
  const latest = (site?.posts ?? []).slice(0, 5);

  return (
    <>
      {/* Masthead */}
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight">■ ON LABEL</h1>
      <p className="ol-mono text-xs font-bold text-[var(--color-text-secondary)] mt-3 uppercase">
        Early-stage consumer health tech · Written weekly in Seattle
        {site !== undefined && site.subscriberCount > 0 && (
          <> · Read by {site.subscriberCount.toLocaleString()} operators</>
        )}
      </p>

      <hr className="ol-rule-dashed mt-6" />

      {/* Pitch */}
      <div className="mt-6 space-y-3 text-[15px] leading-relaxed max-w-xl">
        <p>
          Every week: the rounds that matter in consumer health — skincare with a
          geroscience claim, vet-founded pet nutrition, circadian hardware — logged
          like a ledger, not a press release.
        </p>
        <p>
          One teardown with real numbers. Physical products tracked from raise to
          shelf. And <strong>THE CALL</strong>: a falsifiable prediction with a
          number and a date, scored publicly when it resolves.
        </p>
      </div>

      {/* Capture */}
      <div className="mt-6 bg-[var(--color-fill-tan)] px-5 py-5">
        <p className="ol-mono text-xs font-bold text-[var(--color-text-secondary)] mb-3">
          FREE · WEEKLY · UNSUBSCRIBE ANYTIME
        </p>
        <SubscribeForm />
      </div>

      {/* Latest entries */}
      <section className="mt-10">
        <p className="ol-label">
          <span className="text-[var(--color-text)]">LATEST ENTRIES</span>
        </p>
        <div className="ol-box mt-2 px-5 py-4">
          {site === undefined ? (
            <p className="ol-mono text-sm text-[var(--color-text-secondary)]">LOADING LEDGER…</p>
          ) : latest.length === 0 ? (
            <p className="ol-mono text-sm text-[var(--color-text-secondary)]">
              NO ENTRIES YET — ISSUE Nº 001 IS IN THE PRINTER.
            </p>
          ) : (
            <ul className="space-y-3">
              {latest.map((p) => (
                <li key={p.id}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <span className="ol-leader-row">
                      <span className="ol-mono text-sm font-bold group-hover:text-[var(--color-accent)] truncate">
                        {p.title}
                      </span>
                      <span className="ol-leader" />
                      <span className="ol-mono text-xs text-[var(--color-text-secondary)] shrink-0">
                        {issueDate(p.publishedAt)}
                      </span>
                    </span>
                    {p.subtitle && (
                      <span className="block text-sm text-[var(--color-text-secondary)] mt-0.5">
                        {p.subtitle}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-3">
          <Link
            href="/onlabel/archive"
            className="ol-mono text-xs font-bold text-[var(--color-accent)] hover:underline underline-offset-4"
          >
            FULL ARCHIVE →
          </Link>
        </p>
      </section>

      {/* The standing convention */}
      <section className="mt-10">
        <div className="ol-box-heavy px-5 py-4">
          <p className="ol-mono text-xs font-bold text-[var(--color-accent)]">THE CALL</p>
          <p className="ol-mono text-sm font-bold mt-1">
            EVERY ISSUE ENDS WITH A PREDICTION THAT CAN BE WRONG — A NUMBER, A
            DATE, AND A PUBLIC LEDGER OF HOW PAST CALLS RESOLVED.
          </p>
        </div>
      </section>
    </>
  );
}
