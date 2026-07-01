"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import AuthGuard from "@/components/auth-guard";
import { FeedFrame } from "@/components/feed-frame";
import { EarlyFeed } from "@/components/early-feed";
import { QueueFeed } from "@/components/queue-feed";

const FEEDS = [
  { slug: "queue", label: "Queue" },
  { slug: "science", label: "Science & Business" },
  { slug: "x-trends", label: "Trending on X" },
  { slug: "early", label: "Early Engagement" },
  { slug: "creators", label: "Creators" },
  { slug: "teardown", label: "Content Teardown" },
];

function FeedTabs() {
  const [active, setActive] = useState("queue");

  // Deep-link / persist via the URL hash (no page nav — instant switching).
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "");
      if (FEEDS.some((f) => f.slug === h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const select = (slug: string) => {
    setActive(slug);
    history.replaceState(null, "", `#${slug}`);
  };

  return (
    <>
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] mb-5">
        {FEEDS.map((f) => (
          <button
            key={f.slug}
            onClick={() => select(f.slug)}
            className={`shrink-0 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === f.slug
                ? "border-[var(--color-accent)] text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* key per slug so each tab has its own state (refresh, iframe) — no bleed */}
      {active === "queue" ? (
        <QueueFeed />
      ) : active === "early" ? (
        <EarlyFeed />
      ) : (
        <FeedFrame key={active} slug={active} />
      )}
    </>
  );
}

export default function FeedPage() {
  return (
    <div className="min-h-screen flex flex-col max-w-5xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-6">
        <AuthGuard role="subscriber">
          <FeedTabs />
        </AuthGuard>
      </main>
      <Footer />
    </div>
  );
}
