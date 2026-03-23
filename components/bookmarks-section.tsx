"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Section from "@/components/section";

export default function BookmarksSection() {
  const bookmarks = useQuery(api.bookmarks.list);

  if (bookmarks === undefined) {
    return (
      <Section title="Bookmarks" viewAllHref="/bookmarks">
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-[var(--color-border)] rounded w-48" />
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (bookmarks.length === 0) return null;

  const latest = bookmarks.slice(0, 5);

  return (
    <Section title="Bookmarks" viewAllHref="/bookmarks">
      <ul className="space-y-3">
        {latest.map((bookmark) => (
          <li key={bookmark._id}>
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block py-1"
            >
              <span className="text-[var(--color-accent)] group-hover:underline underline-offset-4 decoration-1 font-medium">
                {bookmark.title}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)] ml-2">
                &mdash; {bookmark.description}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
