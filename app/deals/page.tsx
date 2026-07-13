import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import DealsGridLoader from "@/components/deals-grid-loader";

export const metadata: Metadata = {
  title: "Deal Radar — LNKD",
  description:
    "A live ledger of venture funding deals — consumer CPG, health, tech, and the rest of the tape. Company, round, amount, lead, founders.",
};

export default function DealsPage() {
  return (
    <div className="min-h-screen flex flex-col w-full px-6 lg:px-12">
      <Nav />
      <main className="flex-1 py-10 md:py-14">
        <p className="ol-label">
          <span className="text-[var(--color-text)]">DEAL RADAR</span>
          <span className="text-[var(--color-text-secondary)] font-normal">
            &nbsp;&nbsp;·&nbsp;&nbsp;VENTURE FUNDING, AS FILED
          </span>
        </p>
        <p className="text-[15px] leading-relaxed mt-3 max-w-xl">
          Every round the radar picks up — fused from funding feeds and founder
          announcements, extracted and deduplicated automatically. Sort it,
          filter it, follow the founders.
        </p>
        <div className="mt-6">
          <DealsGridLoader />
        </div>
      </main>
      <Footer />
    </div>
  );
}
