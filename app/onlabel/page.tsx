import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import OnLabelHome from "@/components/onlabel/onlabel-home";

const DESCRIPTION =
  "A weekly letter on early-stage consumer health companies. Who raised, what they're actually selling, and whether the numbers work.";

export const metadata: Metadata = {
  title: "On Label — early-stage consumer health tech",
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
