import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import AuthGuard from "@/components/auth-guard";

export const metadata: Metadata = {
  title: "Signal Feed — LNKD",
  description:
    "Health, longevity & startup signal — science news, what's trending on X, your watchlist, and audience research.",
};

const CARDS = [
  {
    slug: "science",
    title: "Science News",
    blurb: "Fresh stories worth sharing, combed from your science sites — each with an angle.",
    accent: "#059669",
  },
  {
    slug: "x-trends",
    title: "Trending on X",
    blurb: "What's trending across startups, health & longevity — expand for the posts.",
    accent: "#2563eb",
  },
  {
    slug: "creators",
    title: "Creators",
    blurb: "Top recent posts from the X accounts on your list.",
    accent: "#7c3aed",
  },
  {
    slug: "early",
    title: "Early Engagement",
    blurb: "Freshest posts from your watchlist — get in early. Updates every ~20 min.",
    accent: "#dc2626",
  },
  {
    slug: "teardown",
    title: "Content Teardown",
    blurb: "Top-performing posts from your list + the niche — study what earns follows.",
    accent: "#0891b2",
  },
];

export default function FeedPage() {
  return (
    <div className="min-h-screen flex flex-col max-w-5xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-12">
        <AuthGuard role="subscriber">
          <h1 className="text-3xl font-semibold mb-2">Signal Feed</h1>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Snapshots from a local pipeline. Drafts shown are suggestions, not posted.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {CARDS.map((c) => (
              <Link
                key={c.slug}
                href={`/feed/${c.slug}`}
                className="block rounded-xl border border-[var(--color-border)] bg-white overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition"
              >
                <div className="h-1.5" style={{ background: c.accent }} />
                <div className="p-5">
                  <h2 className="text-base font-semibold mb-2">{c.title}</h2>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                    {c.blurb}
                  </p>
                  <span className="text-sm font-semibold" style={{ color: c.accent }}>
                    Open →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </AuthGuard>
      </main>
      <Footer />
    </div>
  );
}
