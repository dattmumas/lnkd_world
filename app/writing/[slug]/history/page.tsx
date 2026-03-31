"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import VersionHistory from "@/components/version-history";
import AuthGuard from "@/components/auth-guard";
import Link from "next/link";

function HistoryContent() {
  const { slug } = useParams();
  const post = useQuery(api.posts.getBySlug, { slug: slug as string });
  const versions = useQuery(api.versions.listBySlug, {
    slug: slug as string,
    contentType: "post",
  });

  if (post === undefined || versions === undefined) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-[var(--color-border)] rounded w-32" />
        <div className="h-8 bg-[var(--color-border)] rounded w-64" />
        <div className="h-4 bg-[var(--color-border)] rounded w-24" />
      </div>
    );
  }

  if (post === null) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-4">Post not found</h1>
        <Link
          href="/writing"
          className="text-[var(--color-accent)] hover:underline underline-offset-4"
        >
          Back to writing
        </Link>
      </div>
    );
  }

  return (
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
  );
}

export default function PostHistoryPage() {
  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-12 md:py-16">
        <AuthGuard role="subscriber">
          <HistoryContent />
        </AuthGuard>
      </main>
      <Footer />
    </div>
  );
}
