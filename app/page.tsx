import Link from "next/link";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import AppsLedger from "@/components/apps-ledger";
import OnLabelSection from "@/components/onlabel-section";
import LedgerMark from "@/components/ledger/mark";
import Tear from "@/components/ledger/tear";
import TypeLine from "@/components/ledger/type-line";

/**
 * The landing IS a ledger: a masthead with the misregistered mark and a
 * posted-stamp, the applications as line items (EXHIBIT A), On Label as the
 * standing entry (EXHIBIT B), and margin notes for the older sections.
 */
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col w-full px-6 lg:px-12">
      <Nav />
      <main className="flex-1 py-10 md:py-14 ol-print-in">
        {/* Masthead */}
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <LedgerMark size={52} className="shrink-0" interactive />
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight ol-misprint">
                LNKD
              </h1>
            </div>
            <p className="ol-mono text-xs font-bold text-[var(--color-text-secondary)] mt-4 uppercase">
              <TypeLine text="Matthew Dumas · Seattle WA" />
            </p>
            <p className="text-[17px] leading-relaxed mt-4">
              A place for me to write and design.
            </p>
          </div>

          {/* Filing meta — the receipt's corner */}
          <p className="ol-mono text-[10px] text-[var(--color-text-secondary)] text-right leading-relaxed uppercase shrink-0 hidden sm:block mt-2">
            47.60°N · 122.33°W
            <br />
            Ledger balanced daily
          </p>
        </div>

        <Tear className="mt-8 text-[var(--color-border)]" />

        {/* Broadsheet grid: apps + margin notes rail left (5), the letter right (7) */}
        <div className="xl:grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-x-12 xl:items-start">
          <div className="xl:col-start-1 xl:row-start-1">
            <AppsLedger />
          </div>
          <div className="xl:col-start-2 xl:row-start-1 xl:row-span-2">
            <OnLabelSection />
          </div>

          {/* Margin notes — the lightest thing on the page, as marginalia
              should be: no box, small, grey, behind a dashed rule. */}
          <section className="mt-8 xl:col-start-1 xl:row-start-2">
            <hr className="ol-rule-dashed" />
            <p className="ol-mono text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mt-3">
              Margin notes
            </p>
            <ul className="mt-2 space-y-1">
              <li>
                <Link href="/notes" className="ol-leader-row group">
                  <span className="ol-mono text-xs font-bold text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]">
                    NOTES
                  </span>
                  <span className="ol-leader" />
                  <span className="text-xs text-[var(--color-text-secondary)]">essays, unfiled</span>
                </Link>
              </li>
              <li>
                <Link href="/reading" className="ol-leader-row group">
                  <span className="ol-mono text-xs font-bold text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]">
                    READING
                  </span>
                  <span className="ol-leader" />
                  <span className="text-xs text-[var(--color-text-secondary)]">the log, rated</span>
                </Link>
              </li>
              <li>
                <Link href="/bookmarks" className="ol-leader-row group">
                  <span className="ol-mono text-xs font-bold text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]">
                    BOOKMARKS
                  </span>
                  <span className="ol-leader" />
                  <span className="text-xs text-[var(--color-text-secondary)]">curated links</span>
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
