"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function cardDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d
    .toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

/**
 * EXHIBIT C on the landing: the latest essays as filed index cards —
 * mono date line, display title, a two-line Georgia excerpt, red pull.
 */
export default function WritingCards() {
  const posts = useQuery(api.posts.list);
  const latest = (posts ?? []).slice(0, 3);

  if (posts !== undefined && latest.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <p className="ol-label">
          <span className="text-[var(--color-text)]">EXHIBIT C</span>
          <span className="text-[var(--color-text-secondary)] font-normal">
            &nbsp;&nbsp;·&nbsp;&nbsp;FROM THE DESK
          </span>
        </p>
        <Link
          href="/writing"
          className="ol-mono text-xs font-bold text-[var(--color-accent)] hover:underline underline-offset-4 shrink-0"
        >
          FULL INDEX →
        </Link>
      </div>

      <div className="mt-3 grid gap-5 md:grid-cols-3">
        {latest.map((post) => (
          <Link
            key={post._id}
            href={`/writing/${post.slug}`}
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
            {post.description && (
              <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-2 line-clamp-2">
                {post.description}
              </span>
            )}
            <span className="ol-mono text-xs font-bold text-[var(--color-accent)] mt-auto pt-4">
              READ →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
