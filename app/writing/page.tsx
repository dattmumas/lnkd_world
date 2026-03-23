"use client";

import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import TagList, { Tags } from "@/components/tag-list";
import Link from "next/link";
import { Suspense } from "react";

function PostsList() {
  const posts = useQuery(api.posts.list);
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");

  if (posts === undefined) {
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

  const allTags = [...new Set(posts.flatMap((p) => p.tags))].sort();
  const filtered = activeTag
    ? posts.filter((p) => p.tags.includes(activeTag))
    : posts;

  return (
    <>
      {allTags.length > 0 && (
        <div className="mb-8">
          <TagList tags={allTags} basePath="/writing" />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No posts yet.</p>
      ) : (
        <ul className="space-y-6">
          {filtered.map((post) => (
            <li key={post._id}>
              <Link href={`/writing/${post.slug}`} className="group block">
                <div className="flex items-baseline gap-3 mb-1">
                  <h2 className="font-semibold group-hover:text-[var(--color-accent)] transition-colors">
                    {post.title}
                  </h2>
                  {post.gated && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      Subscribers
                    </span>
                  )}
                </div>
                {post.publishedAt && (
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                    {new Date(post.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                  {post.description}
                </p>
                <Tags tags={post.tags} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function WritingPage() {
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-8">
          Writing
        </h1>
        <Suspense>
          <PostsList />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
