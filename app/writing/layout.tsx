import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Writing — LNKD",
  description: "Essays on philosophy, politics, and ideas worth exploring.",
  openGraph: {
    title: "Writing — LNKD",
    description: "Essays on philosophy, politics, and ideas worth exploring.",
  },
};

export default function WritingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
