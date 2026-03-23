"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import Markdown from "@/components/markdown";
import TagList, { Tags } from "@/components/tag-list";
import Link from "next/link";
import { Suspense } from "react";

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="text-sm text-[var(--color-text-secondary)]">
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

function ReadingsList() {
  const readings = useQuery(api.readings.list);
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (readings === undefined) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="h-5 bg-[var(--color-border)] rounded w-48" />
            <div className="h-4 bg-[var(--color-border)] rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  const allTags = [...new Set(readings.flatMap((r) => r.tags))].sort();
  const filtered = activeTag
    ? readings.filter((r) => r.tags.includes(activeTag))
    : readings;

  return (
    <>
      {allTags.length > 0 && (
        <div className="mb-8">
          <TagList tags={allTags} basePath="/reading" />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">
          No readings yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((reading) => (
            <li
              key={reading._id}
              className="border-b border-[var(--color-border)] pb-4"
            >
              <button
                onClick={() => toggle(reading._id)}
                className="w-full text-left group"
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <h2 className="font-semibold group-hover:text-[var(--color-accent)] transition-colors">
                    {reading.title}
                  </h2>
                  <span className="text-xs text-[var(--color-text-secondary)] shrink-0">
                    {expanded.has(reading._id) ? "▲" : "▼"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)] mb-1">
                  <span>{reading.author}</span>
                  <span className="text-xs uppercase px-1.5 py-0.5 border border-[var(--color-border)] rounded">
                    {reading.type}
                  </span>
                  {reading.rating && <RatingStars rating={reading.rating} />}
                  {reading.gated && <span className="text-xs">Subscribers</span>}
                </div>
                <Tags tags={reading.tags} />
              </button>

              {expanded.has(reading._id) && (
                <div className="mt-4 pl-4 border-l-2 border-[var(--color-border)]">
                  {reading.gated && !reading.content ? (
                    <Unauthenticated>
                      <div className="text-center py-4">
                        <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                          Notes are for subscribers only.
                        </p>
                        <Link
                          href="/subscribe"
                          className="text-sm text-[var(--color-accent)] hover:underline underline-offset-4"
                        >
                          Subscribe to read
                        </Link>
                      </div>
                    </Unauthenticated>
                  ) : reading.content ? (
                    <Markdown content={reading.content} />
                  ) : (
                    <p className="text-sm text-[var(--color-text-secondary)] italic">
                      No notes yet.
                    </p>
                  )}
                  {reading.url && (
                    <a
                      href={reading.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--color-accent)] hover:underline underline-offset-4 mt-2 inline-block"
                    >
                      Source &rarr;
                    </a>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ReadingPage() {
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-8">
          Reading
        </h1>
        <Suspense>
          <ReadingsList />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
