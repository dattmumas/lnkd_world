import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import AppsLedger from "@/components/apps-ledger";
import OnLabelSection from "@/components/onlabel-section";
import LedgerMark from "@/components/ledger/mark";
import Tear from "@/components/ledger/tear";

/**
 * The landing IS a ledger: a masthead with the misregistered mark and a
 * posted-stamp, the applications as line items (EXHIBIT A), On Label as the
 * standing entry (EXHIBIT B), and margin notes for the older sections.
 */
export default function Home() {
  const posted = new Date()
    .toLocaleDateString([], { month: "short", year: "numeric" })
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-10 md:py-14 ol-print-in">
        {/* Masthead */}
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <LedgerMark size={52} className="shrink-0" />
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">LNKD</h1>
            </div>
            <p className="ol-mono text-xs font-bold text-[var(--color-text-secondary)] mt-4 uppercase">
              Matthew Dumas · Seattle WA · Operator&apos;s ledger
            </p>
            <p className="text-[15px] leading-relaxed mt-4 max-w-xl">
              Finance operator building consumer software. This page is the running
              ledger: the applications that are live, and{" "}
              <Link
                href="/onlabel"
                className="text-[var(--color-accent)] font-semibold underline underline-offset-2"
              >
                On Label
              </Link>
              , a weekly letter on the business of consumer health tech.
            </p>
          </div>

          {/* The stamp — slammed on after the page feeds in */}
          <div className="ol-stamp ol-mono shrink-0 px-3 py-2 text-center select-none hidden sm:block mt-2">
            <span className="block text-sm font-bold leading-tight">POSTED</span>
            <span className="block text-[10px] font-bold tracking-widest mt-0.5">{posted}</span>
          </div>
        </div>

        <Tear className="mt-8 text-[var(--color-border)]" />

        <AppsLedger />
        <OnLabelSection />

        {/* Margin notes — the demoted sections, one line each */}
        <section className="mt-10">
          <p className="ol-label">
            <span className="text-[var(--color-text)]">MARGIN NOTES</span>
          </p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <Link href="/writing" className="ol-leader-row group">
                <span className="ol-mono text-sm font-bold group-hover:text-[var(--color-accent)]">
                  WRITING
                </span>
                <span className="ol-leader" />
                <span className="text-sm text-[var(--color-text-secondary)]">essays &amp; notes</span>
              </Link>
            </li>
            <li>
              <Link href="/reading" className="ol-leader-row group">
                <span className="ol-mono text-sm font-bold group-hover:text-[var(--color-accent)]">
                  READING
                </span>
                <span className="ol-leader" />
                <span className="text-sm text-[var(--color-text-secondary)]">the log, rated</span>
              </Link>
            </li>
            <li>
              <Link href="/bookmarks" className="ol-leader-row group">
                <span className="ol-mono text-sm font-bold group-hover:text-[var(--color-accent)]">
                  BOOKMARKS
                </span>
                <span className="ol-leader" />
                <span className="text-sm text-[var(--color-text-secondary)]">curated links</span>
              </Link>
            </li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
}
