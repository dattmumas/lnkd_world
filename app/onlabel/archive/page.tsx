import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import ArchiveLedger from "@/components/onlabel/archive-ledger";

export const metadata: Metadata = {
  title: "On Label — archive",
  description: "Every issue of On Label, logged to the ledger.",
};

export default function OnLabelArchivePage() {
  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-10 md:py-14">
        <ArchiveLedger />
      </main>
      <Footer />
    </div>
  );
}
