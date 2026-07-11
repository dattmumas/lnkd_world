/**
 * Article-body recovery for thin RSS candidates. Google News query feeds (and
 * some publishers) put only the headline in the item — and funding headlines
 * love to withhold the company ("Bellevue AI startup raises $50M"). Fetching
 * the article body before extraction turns those into named deals.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Resolve a news.google.com/rss/articles/<id> link to the publisher URL.
 * Google stopped encoding the URL in the id (mid-2024 "AU_yq" format); the
 * shell page carries a timestamp + signature that the internal batchexecute
 * endpoint exchanges for the real URL. Best-effort — null on any failure.
 */
export async function resolveGoogleNewsUrl(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (u.hostname !== "news.google.com") return null;
    const m = u.pathname.match(/\/(?:rss\/)?articles\/([^/?]+)/);
    if (!m) return null;
    const articleId = m[1];

    const page = await fetch(url, { headers: { "User-Agent": UA } });
    if (!page.ok) return null;
    const html = await page.text();
    const ts = html.match(/data-n-a-ts="(\d+)"/)?.[1];
    const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    if (!ts || !sg) return null;

    const inner = JSON.stringify([
      "garturlreq",
      [
        ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
        "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
      ],
      articleId,
      Number(ts),
      sg,
    ]);
    const body = new URLSearchParams({
      "f.req": JSON.stringify([[["Fbv4je", inner, null, "generic"]]]),
    });
    const res = await fetch(
      "https://news.google.com/_/DotsSplashUi/data/batchexecute",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": UA,
        },
        body: body.toString(),
      },
    );
    if (!res.ok) return null;
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.includes("Fbv4je")) continue;
      const payload = JSON.parse(line) as unknown[][];
      const innerStr = payload[0]?.[2];
      if (typeof innerStr !== "string") continue;
      const resolved = (JSON.parse(innerStr) as unknown[])[1];
      if (typeof resolved === "string" && /^https?:\/\//.test(resolved)) {
        return resolved;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Fetch a page and reduce it to readable text (tags stripped, ws collapsed). */
export async function fetchArticleText(
  url: string,
  cap: number,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 500_000);
    const text = html
      .replace(/<(script|style|noscript|svg|nav|header|footer)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/\s+/g, " ")
      .trim();
    return text.length >= 200 ? text.slice(0, cap) : null;
  } catch {
    return null;
  }
}
