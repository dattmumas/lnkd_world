"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import SubscribeForm from "@/components/onlabel/subscribe-form";

function issueDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** EXHIBIT B on the landing: the On Label pitch, capture, and latest entries. */
export default function OnLabelSection() {
  const site = useQuery(api.beehiiv.archive);
  const latest = (site?.posts ?? []).slice(0, 3);

  return (
    <section className="mt-10">
      <p className="ol-label">
        <span className="text-[var(--color-text)]">EXHIBIT B</span>
        <span className="text-[var(--color-text-secondary)] font-normal">
          &nbsp;&nbsp;·&nbsp;&nbsp;ON LABEL — THE WEEKLY LETTER
        </span>
      </p>

      <div className="mt-2 bg-[var(--color-fill-tan)] px-5 py-5">
        <p className="text-[15px] leading-relaxed">
          Early-stage consumer health tech, on the record: the week&apos;s rounds as a
          ledger, one teardown with real numbers, and a falsifiable call — scored
          publicly. Written weekly in Seattle.
        </p>
        {site !== undefined && site.subscriberCount > 0 && (
          <p className="ol-mono text-xs text-[var(--color-text-secondary)] mt-2">
            READ BY {site.subscriberCount.toLocaleString()} FOUNDERS, OPERATORS &amp; INVESTORS
          </p>
        )}
        <div className="mt-4">
          <SubscribeForm />
        </div>

        {latest.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[var(--color-border-soft)]">
            <p className="ol-mono text-xs font-bold text-[var(--color-text-secondary)] mb-2">
              LATEST ENTRIES
            </p>
            <ul className="space-y-2">
              {latest.map((p) => (
                <li key={p.id}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ol-leader-row group"
                  >
                    <span className="ol-mono text-sm font-bold group-hover:text-[var(--color-accent)] truncate">
                      {p.title}
                    </span>
                    <span className="ol-leader" />
                    <span className="ol-mono text-xs text-[var(--color-text-secondary)] shrink-0">
                      {issueDate(p.publishedAt)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4">
          <Link
            href="/onlabel"
            className="ol-mono text-xs font-bold text-[var(--color-accent)] hover:underline underline-offset-4"
          >
            FULL ARCHIVE &amp; ABOUT →
          </Link>
        </p>
      </div>
    </section>
  );
}
