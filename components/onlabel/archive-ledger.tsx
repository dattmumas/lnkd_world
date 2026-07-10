"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import LedgerMark from "@/components/ledger/mark";

interface SitePost {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  publishedAt: number;
}

function monthKey(ms: number): string {
  return new Date(ms).toLocaleDateString([], { year: "numeric", month: "long" });
}

function issueDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Every issue, grouped by month, newest first — rows open the Beehiiv post. */
export default function ArchiveLedger() {
  const site = useQuery(api.beehiiv.archive);

  const groups = useMemo(() => {
    const posts: SitePost[] = site?.posts ?? [];
    const byMonth = new Map<string, SitePost[]>();
    for (const p of posts) {
      const key = monthKey(p.publishedAt);
      const list = byMonth.get(key);
      if (list) list.push(p);
      else byMonth.set(key, [p]);
    }
    return [...byMonth.entries()];
  }, [site]);

  return (
    <>
      <p className="ol-mono text-xs font-bold text-[var(--color-text-secondary)] uppercase">
        <Link
          href="/onlabel"
          className="hover:text-[var(--color-accent)] inline-flex items-center gap-1.5"
        >
          <LedgerMark size={13} />
          ON LABEL
        </Link>{" "}
        · The archive
      </p>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">Every entry</h1>

      <hr className="ol-rule-dashed mt-6" />

      {site === undefined ? (
        <p className="ol-mono text-sm text-[var(--color-text-secondary)] mt-6">LOADING LEDGER…</p>
      ) : groups.length === 0 ? (
        <p className="ol-mono text-sm text-[var(--color-text-secondary)] mt-6">
          NO ENTRIES YET — ISSUE Nº 001 IS IN THE PRINTER.
        </p>
      ) : (
        groups.map(([month, posts]) => (
          <section key={month} className="mt-8">
            <p className="ol-label text-[var(--color-text-secondary)]">{month.toUpperCase()}</p>
            <ul className="mt-2 space-y-3">
              {posts.map((p) => (
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
          </section>
        ))
      )}
    </>
  );
}
