import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import AuthGuard from "@/components/auth-guard";

export const metadata: Metadata = {
  title: "Signal Feed — LNKD",
  description:
    "Health, longevity & startup signal — contentious news, what's trending on X, and reply radar.",
};

export default function FeedPage() {
  return (
    <div className="min-h-screen flex flex-col max-w-5xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-8">
        <AuthGuard role="subscriber">
          <iframe
            src="/feed/view/index"
            title="Signal Feed"
            allow="clipboard-write"
            className="w-full rounded-lg border border-[var(--color-border)] bg-white"
            style={{ height: "calc(100vh - 220px)", minHeight: 600 }}
          />
        </AuthGuard>
      </main>
      <Footer />
    </div>
  );
}
