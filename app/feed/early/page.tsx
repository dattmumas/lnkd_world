"use client";

import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import AuthGuard from "@/components/auth-guard";
import { EarlyFeed } from "@/components/early-feed";

export default function EarlyFeedPage() {
  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-6">
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
            <EarlyFeed />
          </div>
        </AuthGuard>
      </main>
      <Footer />
    </div>
  );
}
