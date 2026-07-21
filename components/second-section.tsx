"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { fmtDateUTC } from "@/lib/format";
import Tear from "@/components/ledger/tear";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ColumnHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="ol-mono text-[11px] font-bold uppercase tracking-widest">
        {title}
      </p>
      <Link
        href={href}
        className="ol-mono text-[11px] font-bold text-[var(--color-text)] hover:text-[var(--color-accent)] hover:underline underline-offset-4 shrink-0"
      >
        ALL →
      </Link>
    </div>
  );
}

/** Loading and empty must not share a face — the empty copy is a claim. */
function Receiving() {
  return (
    <p className="ol-mono text-xs text-[var(--color-text-secondary)] mt-4 uppercase tracking-widest">
      Receiving…
    </p>
  );
}

const serifTitle =
  "ol-serif font-bold leading-snug group-hover:text-[var(--color-accent)] text-[16px]";

/**
 * SECOND SECTION — the writing, set like editorials instead of ledger rows:
 * serif headlines, the lead note's excerpt with a dropped initial, and the
 * reading log's ratings. Behind a tear-off edge, at marginalia weight. Reads
 * the bounded *.latest queries, never the full content lists.
 */
export default function SecondSection() {
  const posts = useQuery(api.posts.latest, { n: 3 });
  const readings = useQuery(api.readings.latest, { n: 3 });
  const bookmarks = useQuery(api.bookmarks.latest, { n: 3 });

  return (
    <section className="mt-12">
      <Tear className="text-[var(--color-border)]" />

      <div className="mt-6 grid gap-10 md:grid-cols-3 md:gap-8">
        {/* Notes — the lead gets the op-ed treatment */}
        <div>
          <ColumnHead title="Notes" href="/notes" />
          <hr className="ol-rule-dashed mt-2" />
          {posts === undefined ? (
            <Receiving />
          ) : posts.length === 0 ? (
            <p className="ol-mono text-xs text-[var(--color-text-secondary)] mt-4 uppercase tracking-widest">
              Nothing filed yet
            </p>
          ) : (
            <ul className="mt-4 space-y-5">
              {posts.map((p, i) => (
                <li key={p._id}>
                  <Link href={`/writing/${p.slug}`} className="group block">
                    <h3 className={serifTitle}>{p.title}</h3>
                    <p className="ol-mono text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] mt-1">
                      {fmtDateUTC(p.publishedAt)}
                      {p.gated ? " · Subscribers" : ""}
                    </p>
                    {i === 0 && p.description && (
                      <p className="ol-ed-excerpt text-sm text-[var(--color-text-secondary)] leading-relaxed mt-2">
                        {p.description}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Reading — the log, with its verdicts */}
        <div>
          <ColumnHead title="Reading" href="/reading" />
          <hr className="ol-rule-dashed mt-2" />
          {readings === undefined ? (
            <Receiving />
          ) : readings.length === 0 ? (
            <p className="ol-mono text-xs text-[var(--color-text-secondary)] mt-4 uppercase tracking-widest">
              Nothing rated yet
            </p>
          ) : (
            <ul className="mt-4 space-y-5">
              {readings.map((r) => {
                // Clamp once and derive both dot runs from it — clamping
                // only one side lets a bad rating render a six-dot scale.
                const filled =
                  typeof r.rating === "number"
                    ? Math.max(0, Math.min(5, Math.round(r.rating)))
                    : null;
                return (
                  <li key={r._id}>
                    <Link href="/reading" className="group block">
                      <h3 className={serifTitle}>{r.title}</h3>
                      <p className="ol-mono text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] mt-1">
                        {r.author}
                        {filled !== null && (
                          <>
                            {" · "}
                            <span className="text-[var(--color-text)]">
                              {"●".repeat(filled)}
                            </span>
                            <span className="text-[var(--color-leader)]">
                              {"○".repeat(5 - filled)}
                            </span>
                          </>
                        )}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Bookmarks — curated links, source credited */}
        <div>
          <ColumnHead title="Bookmarks" href="/bookmarks" />
          <hr className="ol-rule-dashed mt-2" />
          {bookmarks === undefined ? (
            <Receiving />
          ) : bookmarks.length === 0 ? (
            <p className="ol-mono text-xs text-[var(--color-text-secondary)] mt-4 uppercase tracking-widest">
              Nothing clipped yet
            </p>
          ) : (
            <ul className="mt-4 space-y-5">
              {bookmarks.map((b) => (
                <li key={b._id}>
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <h3 className={serifTitle}>{b.title}</h3>
                    <p className="ol-mono text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] mt-1">
                      {hostname(b.url)} ↗
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
