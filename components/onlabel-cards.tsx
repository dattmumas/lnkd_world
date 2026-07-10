"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function cardDate(ms: number): string {
  return new Date(ms)
    .toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

/**
 * EXHIBIT C on the landing: the latest On Label issues as filed index cards —
 * mono date line, display title, a two-line subtitle, red pull to the issue.
 */
export default function OnLabelCards() {
  const site = useQuery(api.beehiiv.archive);
  const latest = (site?.posts ?? []).slice(0, 3);

  if (site !== undefined && latest.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <p className="ol-label">
          <span className="text-[var(--color-text)]">EXHIBIT C</span>
          <span className="text-[var(--color-text-secondary)] font-normal">
            &nbsp;&nbsp;·&nbsp;&nbsp;FROM THE LETTER
          </span>
        </p>
        <Link
          href="/onlabel/archive"
          className="ol-mono text-xs font-bold text-[var(--color-accent)] hover:underline underline-offset-4 shrink-0"
        >
          FULL ARCHIVE →
        </Link>
      </div>

      <div className="mt-3 grid gap-5 md:grid-cols-3">
        {latest.map((post) => (
          <a
            key={post.id}
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ol-box group flex flex-col px-5 py-4 hover:border-[var(--color-accent)] transition-colors"
          >
            <span className="ol-mono text-[10px] font-bold text-[var(--color-text-secondary)] tracking-widest">
              {cardDate(post.publishedAt)}
            </span>
            <span
              className="text-lg font-bold leading-snug mt-2 group-hover:text-[var(--color-accent)]"
              style={{ fontFamily: "var(--font-display), Helvetica, sans-serif" }}
            >
              {post.title}
            </span>
            {post.subtitle && (
              <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-2 line-clamp-2">
                {post.subtitle}
              </span>
            )}
            <span className="ol-mono text-xs font-bold text-[var(--color-accent)] mt-auto pt-4">
              READ →
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
