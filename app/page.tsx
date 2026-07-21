import Nav from "@/components/nav";
import Footer from "@/components/footer";
import Masthead from "@/components/ledger/masthead";
import Ticker from "@/components/ledger/ticker";
import AppsLedger from "@/components/apps-ledger";
import MarketsColumn from "@/components/markets-column";
import OnLabelSection from "@/components/onlabel-section";
import SecondSection from "@/components/second-section";

/**
 * The landing as the front page of a daily: a masthead at newspaper scale, a
 * live wire ticker, then the broadsheet band (The Lead = On Label, The Wire =
 * applications, Markets = deal flow), and the writing as editorials in the
 * Second Section. The sheet stays flat — texture lives only in the footer's
 * carved stone slab.
 */
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col w-full px-6 lg:px-12">
      <Nav />
      <main className="flex-1 py-10 md:py-14 ol-print-in">
        <Masthead />
        <Ticker />

        {/* Broadsheet band: lead story (6), the wire (3), markets (3).
            Boxes stretch to one height; each column pins its signature
            element (open line / histogram) to the shared foot. */}
        <section className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-12 xl:gap-x-10">
          <div className="md:col-span-2 xl:col-span-6">
            <OnLabelSection />
          </div>
          <div className="xl:col-span-3">
            <AppsLedger />
          </div>
          <div className="xl:col-span-3">
            <MarketsColumn />
          </div>
        </section>

        <SecondSection />
      </main>
      <Footer />
    </div>
  );
}
