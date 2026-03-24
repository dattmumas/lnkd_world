import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reading — LNKD",
  description: "Books, articles, and papers worth reading.",
  openGraph: {
    title: "Reading — LNKD",
    description: "Books, articles, and papers worth reading.",
  },
};

export default function ReadingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
