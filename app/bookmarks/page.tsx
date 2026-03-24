"use client";

import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import TagList, { Tags } from "@/components/tag-list";
import Link from "next/link";
import { Suspense } from "react";

function BookmarksList() {
  const bookmarks = useQuery(api.bookmarks.list);
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");

  if (bookmarks === undefined) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="h-5 bg-[var(--color-border)] rounded w-48" />
            <div className="h-4 bg-[var(--color-border)] rounded w-72" />
          </div>
        ))}
      </div>
    );
  }

  const allTags = [...new Set(bookmarks.flatMap((b) => b.tags))].sort();
  const filtered = activeTag
    ? bookmarks.filter((b) => b.tags.includes(activeTag))
    : bookmarks;

  return (
    <>
      {allTags.length > 0 && (
        <div className="mb-8">
          <TagList tags={allTags} basePath="/bookmarks" />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">
          No bookmarks yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((bookmark) => (
            <li
              key={bookmark._id}
              className="border-b border-[var(--color-border)] pb-4"
            >
              <div className="flex items-baseline gap-3 mb-1">
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--color-accent)] hover:underline underline-offset-4"
                >
                  {bookmark.title}
                </a>
                {bookmark.gated && (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    Subscribers
                  </span>
                )}
              </div>
              {bookmark.publishedAt && (
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                  {new Date(bookmark.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
              {bookmark.gated ? (
                <Unauthenticated>
                  <p className="text-sm text-[var(--color-text-secondary)] italic">
                    <Link
                      href="/subscribe"
                      className="text-[var(--color-accent)] hover:underline underline-offset-4"
                    >
                      Subscribe
                    </Link>{" "}
                    to see description
                  </p>
                </Unauthenticated>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                  {bookmark.description}
                </p>
              )}
              <Tags tags={bookmark.tags} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function BookmarksPage() {
  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-8">
          Bookmarks
        </h1>
        <Suspense>
          <BookmarksList />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
