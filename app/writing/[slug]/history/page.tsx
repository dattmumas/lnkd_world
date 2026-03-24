"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import VersionHistory from "@/components/version-history";
import Link from "next/link";

export default function PostHistoryPage() {
  const { slug } = useParams();
  const post = useQuery(api.posts.getBySlug, { slug: slug as string });
  const versions = useQuery(api.versions.listBySlug, {
    slug: slug as string,
    contentType: "post",
  });

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-12 md:py-16">
        {post === undefined || versions === undefined ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-[var(--color-border)] rounded w-32" />
            <div className="h-8 bg-[var(--color-border)] rounded w-64" />
            <div className="h-4 bg-[var(--color-border)] rounded w-24" />
          </div>
        ) : post === null ? (
          <div>
            <h1 className="text-2xl font-semibold mb-4">Post not found</h1>
            <Link
              href="/writing"
              className="text-[var(--color-accent)] hover:underline underline-offset-4"
            >
              Back to writing
            </Link>
          </div>
        ) : (
          <>
            <Link
              href={`/writing/${slug}`}
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] mb-6 inline-block"
            >
              &larr; Back to post
            </Link>

            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
              {post.title}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mb-8">
              {versions.length} revision{versions.length !== 1 ? "s" : ""}
            </p>

            <VersionHistory versions={versions} />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
