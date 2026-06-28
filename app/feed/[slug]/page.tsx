"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import AuthGuard from "@/components/auth-guard";

function FeedContent() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const page = useQuery(api.feed.getPage, { slug });

  return (
    <>
      <Link
        href="/feed"
        className="inline-block mb-4 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      >
        ← Back to feed
      </Link>
      {page === undefined ? (
        <p className="text-[var(--color-text-secondary)] text-sm">Loading…</p>
      ) : page === null ? (
        <p className="text-[var(--color-text-secondary)] text-sm">
          That feed page doesn&apos;t exist.{" "}
          <Link href="/feed" className="text-[var(--color-accent)] hover:underline">
            Back to feed
          </Link>
          .
        </p>
      ) : (
        <iframe
          srcDoc={page.html}
          title={page.title}
          allow="clipboard-write"
          className="w-full rounded-lg border border-[var(--color-border)] bg-white"
          style={{ height: "calc(100vh - 200px)", minHeight: 600 }}
        />
      )}
    </>
  );
}

export default function FeedSlugPage() {
  return (
    <div className="min-h-screen flex flex-col max-w-5xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-8">
        <AuthGuard role="subscriber">
          <FeedContent />
        </AuthGuard>
      </main>
      <Footer />
    </div>
  );
}
