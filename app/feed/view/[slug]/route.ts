import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import indexHtml from "@/feed-content/index";
import contentiousHtml from "@/feed-content/contentious-news";
import xTrendsHtml from "@/feed-content/x-trends";
import replyRadarHtml from "@/feed-content/reply-radar";

// Allowlist of servable pages. Keys are the only valid slugs — anything else 404s.
// The HTML is inlined at build time (workerd has no filesystem), so there is no
// file path to traverse.
const PAGES: Record<string, string> = {
  index: indexHtml,
  "contentious-news": contentiousHtml,
  "x-trends": xTrendsHtml,
  "reply-radar": replyRadarHtml,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  if (!(await isAuthenticatedNextjs())) {
    redirect("/subscribe");
  }

  const { slug } = await params;
  const html = PAGES[slug];
  if (!html) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Private, per-user content — never store in shared/browser caches.
      "cache-control": "private, no-store",
    },
  });
}
