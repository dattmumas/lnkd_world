/**
 * Format a date-only string ("2026-07-17") on its intended calendar day.
 * Date-only strings parse as UTC midnight, so formatting them in the
 * visitor's local zone shows the previous day for anyone west of UTC.
 * Format in UTC instead — the stored day IS the display day.
 */
/**
 * Ms epoch of the current UTC day's midnight. The landing passes this to
 * deals.landingSummary as its cache key: Convex only invalidates cached
 * results on writes, so without it a fresh load after UTC midnight is
 * served yesterday's 7-day window. Both landing consumers must compute the
 * arg identically to share one subscription.
 */
export function utcDayStartMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function fmtDateUTC(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}
