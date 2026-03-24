import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bookmarks — LNKD",
  description: "Curated links to articles, tools, and resources.",
  openGraph: {
    title: "Bookmarks — LNKD",
    description: "Curated links to articles, tools, and resources.",
  },
};

export default function BookmarksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
