"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import SubscribeForm from "@/components/onlabel/subscribe-form";

/** EXHIBIT B on the landing: the On Label pitch and capture (issues live in EXHIBIT C). */
export default function OnLabelSection() {
  const site = useQuery(api.beehiiv.archive);

  return (
    <section className="mt-10">
      <p className="ol-label">
        <span className="text-[var(--color-text)]">EXHIBIT B</span>
        <span className="text-[var(--color-text-secondary)] font-normal">
          &nbsp;&nbsp;·&nbsp;&nbsp;ON LABEL — THE WEEKLY LETTER
        </span>
      </p>

      <div className="mt-2 bg-[var(--color-fill-tan)] px-5 py-5 ol-panel">
        <p className="text-[15px] leading-relaxed">
          Early-stage consumer health tech, on the record: the week&apos;s rounds as a
          ledger, one teardown with real numbers, and a falsifiable call — scored
          publicly. Written weekly in Seattle.
        </p>
        {site !== undefined && site.subscriberCount > 0 && (
          <p className="ol-mono text-xs text-[var(--color-text-secondary)] mt-2">
            {`READ BY ${site.subscriberCount.toLocaleString()} FOUNDERS, OPERATORS & INVESTORS`}
          </p>
        )}
        <div className="mt-4">
          <SubscribeForm />
        </div>

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
