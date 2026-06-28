"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import AuthGuard from "@/components/auth-guard";

// Feeds whose content is regenerated live from the X API (admin can refresh).
// contentious-news / reply-radar are static snapshots, so no refresh button.
const REFRESHABLE = new Set(["x-trends", "creators"]);

function FeedContent() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const page = useQuery(api.feed.getPage, { slug });
  const user = useQuery(api.users.currentUser);
  const refreshXTrends = useAction(api.xTrends.refresh);
  const refreshCreators = useAction(api.creators_feed.refresh);
  const [state, setState] = useState("");

  const canRefresh = user?.role === "admin" && REFRESHABLE.has(slug);

  const onRefresh = async () => {
    setState("Refreshing…");
    try {
      const fn = slug === "creators" ? refreshCreators : refreshXTrends;
      const r = await fn();
      // getPage is reactive, so the iframe updates itself once the snapshot lands.
      setState(`Updated — ${r.count} post${r.count === 1 ? "" : "s"}`);
    } catch {
      setState("Refresh failed — check the X API / logs.");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/feed"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          ← Back to feed
        </Link>
        {canRefresh && (
          <div className="flex items-center gap-3">
            {state && (
              <span className="text-xs text-[var(--color-text-secondary)]">{state}</span>
            )}
            <button
              onClick={() => void onRefresh()}
              disabled={state === "Refreshing…"}
              className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 hover:bg-[var(--color-border)]/30 disabled:opacity-60"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
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
