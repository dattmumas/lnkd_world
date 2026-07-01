"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import AuthGuard from "@/components/auth-guard";
import { FeedFrame } from "@/components/feed-frame";

export default function FeedSlugPage() {
  const params = useParams<{ slug: string }>();
  return (
    <div className="min-h-screen flex flex-col max-w-5xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-8">
        <AuthGuard role="subscriber">
          <Link
            href="/feed"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            ← Back to feed
          </Link>
          <div className="mt-4">
            <FeedFrame slug={params.slug} />
          </div>
        </AuthGuard>
      </main>
      <Footer />
    </div>
  );
}
