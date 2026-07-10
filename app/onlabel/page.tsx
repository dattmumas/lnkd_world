import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import OnLabelHome from "@/components/onlabel/onlabel-home";

const DESCRIPTION =
  "On Label — a weekly letter on early-stage consumer health tech. The week's rounds as a ledger, one teardown with real numbers, and a falsifiable call, scored publicly.";

export const metadata: Metadata = {
  title: "On Label — early-stage consumer health tech, on the record",
  description: DESCRIPTION,
  openGraph: {
    title: "On Label",
    description: DESCRIPTION,
    url: "https://lnkd.world/onlabel",
    type: "website",
  },
  twitter: { card: "summary", title: "On Label", description: DESCRIPTION },
};

export default function OnLabelPage() {
  return (
    <div className="min-h-screen flex flex-col w-full px-6 lg:px-12">
      <Nav />
      <main className="flex-1 py-10 md:py-14">
        <OnLabelHome />
      </main>
      <Footer />
    </div>
  );
}
