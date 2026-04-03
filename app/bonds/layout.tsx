import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bond Market Terminal | LNKD",
  description:
    "Live bond market analysis: yield curves, rate predictions, credit spreads, signals, and trade ideas. Updated daily.",
};

export default function BondsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bonds-terminal">
      {children}
    </div>
  );
}
