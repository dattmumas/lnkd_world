"use client";

import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import dynamic from "next/dynamic";

// Client-only: SSR-evaluating the markdown pipeline blows the Workers CPU budget.
const Markdown = dynamic(() => import("@/components/markdown"), { ssr: false });
import { LineChart } from "./follower-chart";
import { computeBestWindows, DEFAULT_WINDOW_NOTE, MIN_POSTS_FOR_SIGNAL } from "./best-times";

type XPost = FunctionReturnType<typeof api.xPosts.board>[number];

const PILLAR_LABEL: Record<string, string> = {
  health: "Health & Longevity",
  finance: "Finance & Deals",
  startup: "Startup",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return String(n);
}

const th = "text-left gc-label px-3 py-2";
const td = "px-3 py-2 text-sm";

/** One posted-post row with an expandable views sparkline. */
function PostRow({ post }: { post: XPost }) {
  const [open, setOpen] = useState(false);
  const series = useQuery(api.xMetrics.series, open ? { postId: post._id } : "skip");
  const canExpand = post.tweetId != null;
  return (
    <>
      <tr className="border-t border-[var(--color-border)]">
        <td className={`${td} max-w-md`}>
          <button
            onClick={() => canExpand && setOpen((o) => !o)}
            className={`text-left truncate block w-full ${canExpand ? "hover:text-[var(--color-accent)]" : "cursor-default"}`}
            title={post.body}
          >
            {canExpand && <span className="mr-1">{open ? "▾" : "▸"}</span>}
            {post.body.split("\n")[0]}
          </button>
        </td>
        <td className={td}>{PILLAR_LABEL[post.pillar]}</td>
        <td className={td}>
          {post.postedAt != null ? new Date(post.postedAt).toLocaleDateString() : "—"}
        </td>
        <td className={`${td} text-right gc-num`}>{post.latestViews != null ? fmt(post.latestViews) : "—"}</td>
        <td className={`${td} text-right gc-num font-semibold`}>
          {post.latestProfileClicks ?? "—"}
        </td>
        <td className={`${td} text-right gc-num`}>{post.latestLikes ?? "—"}</td>
        <td className={`${td} text-right gc-num`}>{post.latestReplies ?? "—"}</td>
        <td className={`${td} text-right gc-num`}>{post.latestReposts ?? "—"}</td>
      </tr>
      {open && (
        <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
          <td colSpan={8} className="px-3 py-3">
            {series === undefined ? (
              <p className="text-xs text-[var(--color-text-secondary)]">Loading…</p>
            ) : series.length < 2 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Not enough snapshots yet — one lands per day.
              </p>
            ) : (
              <div className="max-w-lg">
                <LineChart
                  height={100}
                  formatY={fmt}
                  series={series.map((s) => ({
                    x: s.fetchedAt,
                    y: s.views,
                    label: `${new Date(s.fetchedAt).toLocaleDateString()}: ${fmt(s.views)} views · ${s.likes} likes`,
                  }))}
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">views over time</p>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Analytics (growth dashboard): pillar comparison, per-post performance,
 * reply ROI, and the Claude weekly review.
 */
export function AnalyticsTab() {
  const pillarStats = useQuery(api.xMetrics.pillarStats);
  const board = useQuery(api.xPosts.board);
  const review = useQuery(api.weeklyReview.latest);
  const reviews = useQuery(api.weeklyReview.list);
  const pullMetrics = useAction(api.xMetrics.pull);
  const generateReview = useAction(api.weeklyReview.generate);
  const pullBeehiiv = useAction(api.beehiiv.pull);

  // Day-rounded 30-day window keeps the subscription stable.
  const [sinceMs] = useState(() => {
    const d = new Date(Date.now() - 30 * 86_400_000);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const roi = useQuery(api.xMetrics.replyRoi, { sinceMs });
  const conversions = useQuery(api.attribution.conversions, { sinceMs });
  const targets = useQuery(api.attribution.targets, { sinceMs });
  const myReplies = useQuery(api.ownReplies.list, { sinceMs });

  const [state, setState] = useState("");
  const [selectedReview, setSelectedReview] = useState<string | null>(null);

  const posted = (board ?? [])
    .filter((p) => p.status === "posted")
    .sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0));

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setState(`${label}…`);
    try {
      await fn();
      setState(`${label} done.`);
    } catch (e) {
      setState(`${label} failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Reply ROI summary: do high-reply days gain more followers?
  const roiNote = useMemo(() => {
    const days = (roi ?? []).filter((d) => d.followerDelta != null);
    if (days.length < 7) return null;
    const busy = days.filter((d) => d.engaged >= 10);
    const quiet = days.filter((d) => d.engaged < 10);
    if (busy.length < 3 || quiet.length < 3) return null;
    const avg = (list: typeof days) =>
      list.reduce((s, d) => s + (d.followerDelta ?? 0), 0) / list.length;
    return `Days with 10+ replies averaged ${avg(busy).toFixed(1)} new followers vs ${avg(quiet).toFixed(1)} on quieter days (last 30 days).`;
  }, [roi]);

  const shownReview =
    (selectedReview && reviews?.find((r) => r._id === selectedReview)) || review;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => void run("Metrics pull", () => pullMetrics())}
          className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 bg-white hover:bg-[var(--color-border)]/30"
        >
          Pull metrics now
        </button>
        <button
          onClick={() => void run("Review generation", () => generateReview())}
          className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 bg-white hover:bg-[var(--color-border)]/30"
        >
          Generate weekly review
        </button>
        <button
          onClick={() => void run("beehiiv pull", () => pullBeehiiv())}
          className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 bg-white hover:bg-[var(--color-border)]/30"
          title="Seed recent newsletter posts as thread ideas (needs beehiiv env vars)"
        >
          Pull newsletter ideas
        </button>
        {state && <span className="text-sm text-[var(--color-text-secondary)]">{state}</span>}
      </div>

      {/* Pillar comparison */}
      <div>
        <h2 className="gc-label mb-2">
          Pillar comparison — where the account actually grows
        </h2>
        <div className="border border-[var(--color-border)] rounded-lg bg-white overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Pillar</th>
                <th className={`${th} text-right`}>Posted</th>
                <th className={`${th} text-right`}>With metrics</th>
                <th className={`${th} text-right`}>Avg views</th>
                <th className={`${th} text-right`}>Avg profile clicks</th>
                <th className={`${th} text-right`}>Avg likes</th>
                <th className={`${th} text-right`}>Avg replies</th>
                <th className={`${th} text-right`}>Avg reposts</th>
              </tr>
            </thead>
            <tbody>
              {(pillarStats ?? []).map((s) => (
                <tr key={s.pillar} className="border-t border-[var(--color-border)]">
                  <td className={`${td} font-medium`}>{PILLAR_LABEL[s.pillar]}</td>
                  <td className={`${td} text-right gc-num`}>{s.posts}</td>
                  <td className={`${td} text-right gc-num`}>{s.withMetrics}</td>
                  <td className={`${td} text-right gc-num`}>{s.withMetrics ? fmt(s.avgViews) : "—"}</td>
                  <td className={`${td} text-right gc-num`}>{s.withMetrics ? s.avgProfileClicks : "—"}</td>
                  <td className={`${td} text-right gc-num`}>{s.withMetrics ? s.avgLikes : "—"}</td>
                  <td className={`${td} text-right gc-num`}>{s.withMetrics ? s.avgReplies : "—"}</td>
                  <td className={`${td} text-right gc-num`}>{s.withMetrics ? s.avgReposts : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-post table */}
      <div>
        <h2 className="gc-label mb-2">
          Posted ({posted.length})
        </h2>
        {posted.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Nothing posted yet. Metrics attach once posts are marked posted with a tweet URL.
          </p>
        ) : (
          <div className="border border-[var(--color-border)] rounded-lg bg-white overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Post</th>
                  <th className={th}>Pillar</th>
                  <th className={th}>Date</th>
                  <th className={`${th} text-right`}>Views</th>
                  <th className={`${th} text-right`} title="Profile clicks — the strongest pre-follow signal (official API)">
                    Profile clicks
                  </th>
                  <th className={`${th} text-right`}>Likes</th>
                  <th className={`${th} text-right`}>Replies</th>
                  <th className={`${th} text-right`}>Reposts</th>
                </tr>
              </thead>
              <tbody>
                {posted.map((p) => (
                  <PostRow key={p._id} post={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reply ROI */}
      <div>
        <h2 className="gc-label mb-2">
          Reply ROI — replies engaged (solid) vs follower delta (dashed)
        </h2>
        <div className="border border-[var(--color-border)] rounded-lg bg-white p-4">
          {roi === undefined ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
          ) : roi.length < 2 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Not enough data yet. Work the queue and keep daily snapshots running.
            </p>
          ) : (
            <>
              <LineChart
                height={160}
                series={roi.map((d) => ({
                  x: Date.parse(d.day),
                  y: d.engaged,
                  label: `${d.day}: ${d.engaged} replies engaged${d.followerDelta != null ? `, ${d.followerDelta >= 0 ? "+" : ""}${d.followerDelta} followers` : ""}`,
                }))}
                series2={roi.flatMap((d) =>
                  d.followerDelta != null
                    ? [
                        {
                          x: Date.parse(d.day),
                          y: d.followerDelta,
                          label: `${d.day}: ${d.followerDelta} followers`,
                        },
                      ]
                    : [],
                )}
              />
              <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                {roiNote ??
                  "Each series is scaled to its own range — compare the shapes, not the heights."}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Best time to post */}
      <div>
        <h2 className="gc-label mb-2">
          Best time to post (your data, local time)
        </h2>
        <div className="border border-[var(--color-border)] rounded-lg bg-white p-4">
          {(() => {
            const windows = computeBestWindows(board ?? []);
            if (!windows) {
              const measured = (board ?? []).filter(
                (p) => p.status === "posted" && p.latestViews != null,
              ).length;
              return (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {DEFAULT_WINDOW_NOTE} ({measured}/{MIN_POSTS_FOR_SIGNAL} measured posts)
                </p>
              );
            }
            return (
              <div className="flex gap-6 flex-wrap">
                {windows.map((w, i) => (
                  <div key={w.label}>
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      {w.label}
                      {i === 0 && <span className="gc-chip gc-chip-ok">best</span>}
                    </div>
                    <div className="gc-num text-[11px] text-[var(--color-text-secondary)]">
                      avg engagement {w.avgEngagement} · {w.posts} posts
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Your replies */}
      <div>
        <h2 className="gc-label mb-2">
          Your replies ({myReplies?.length ?? "…"}, last 30d) — tracked from X hourly
        </h2>
        <div className="border border-[var(--color-border)] rounded-lg bg-white overflow-x-auto">
          {myReplies === undefined ? (
            <p className="text-sm text-[var(--color-text-secondary)] p-4">Loading…</p>
          ) : myReplies.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] p-4">
              No replies tracked yet — the hourly tracker picks up everything you
              post on X, in or out of this dashboard.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Reply</th>
                  <th className={th}>To</th>
                  <th className={`${th} text-right`}>Likes</th>
                  <th className={`${th} text-right`}>Views</th>
                  <th className={th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {myReplies.slice(0, 50).map((r) => (
                  <tr key={r.tweetId} className="border-t border-[var(--color-border)]">
                    <td className={`${td} max-w-md`}>
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate hover:text-[var(--color-accent)]"
                        title={r.text}
                      >
                        {r.text.replace(/^@\w+\s*/, "")}
                      </a>
                    </td>
                    <td className={td}>
                      {r.repliedToUsername ? (
                        <a
                          href={`https://x.com/${r.repliedToUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          @{r.repliedToUsername}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${td} text-right gc-num`}>{r.likes}</td>
                    <td className={`${td} text-right gc-num`}>
                      {r.views != null ? fmt(r.views) : "—"}
                    </td>
                    <td className={td}>
                      {new Date(r.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Attribution */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div>
          <h2 className="gc-label mb-2">
            Conversions — you replied, they followed (30d)
          </h2>
          <div className="border border-[var(--color-border)] rounded-lg bg-white p-4">
            {conversions === undefined ? (
              <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
            ) : conversions.gains === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No follower gains recorded yet — gains persist from the daily
                snapshot diff going forward.
              </p>
            ) : (
              <>
                <p className="text-sm mb-3">
                  <span className="font-semibold">{conversions.conversions}</span> of{" "}
                  <span className="font-semibold">{conversions.gains}</span> new
                  followers ({Math.round(conversions.rate * 100)}%) had been engaged
                  by you in the prior week.
                </p>
                <ul className="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
                  {conversions.rows.map((r) => (
                    <li key={`${r.username}-${r.gainedAt}`} className="py-2 text-sm flex items-center gap-2">
                      <a
                        href={`https://x.com/${r.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-accent)] hover:underline truncate"
                      >
                        {r.name} <span className="text-[var(--color-text-secondary)]">@{r.username}</span>
                      </a>
                      <span className="ml-auto text-xs text-[var(--color-text-secondary)] shrink-0">
                        {r.engagedCount}× engaged · followed{" "}
                        {new Date(r.gainedAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <div>
          <h2 className="gc-label mb-2">
            Reply targets — who you engage, and who follows back (30d)
          </h2>
          <div className="border border-[var(--color-border)] rounded-lg bg-white overflow-x-auto">
            {targets === undefined ? (
              <p className="text-sm text-[var(--color-text-secondary)] p-4">Loading…</p>
            ) : targets.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)] p-4">
                Work the queue — engaged replies build this scoreboard.
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Author</th>
                    <th className={`${th} text-right`}>Engaged</th>
                    <th className={th}>Last</th>
                    <th className={th}>Follows you</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.slice(0, 25).map((t) => (
                    <tr key={t.username} className="border-t border-[var(--color-border)]">
                      <td className={td}>
                        <a
                          href={`https://x.com/${t.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          @{t.username}
                        </a>
                        {t.onWatchlist && (
                          <span className="ml-1.5 text-[10px] uppercase text-[var(--color-text-secondary)]">
                            {t.pillar}
                          </span>
                        )}
                      </td>
                      <td className={`${td} text-right gc-num`}>{t.engagedCount}</td>
                      <td className={td}>
                        {new Date(t.lastEngagedAt).toLocaleDateString()}
                      </td>
                      <td className={td}>
                        {t.followsNow ? (
                          <span className="text-[var(--gc-ok)] font-medium">✓ yes</span>
                        ) : (
                          <span className="text-[var(--color-text-secondary)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Weekly review */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Weekly review
          </h2>
          {reviews && reviews.length > 1 && (
            <select
              value={selectedReview ?? review?._id ?? ""}
              onChange={(e) => setSelectedReview(e.target.value)}
              className="border border-[var(--color-border)] rounded px-2 py-1 text-xs bg-white"
            >
              {reviews.map((r) => (
                <option key={r._id} value={r._id}>
                  Week of {r.weekOf}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="border border-[var(--color-border)] rounded-lg bg-white p-5">
          {shownReview ? (
            <div className="prose prose-sm max-w-none">
              <Markdown content={shownReview.markdown} math={false} />
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No review yet — one generates every Sunday, or hit “Generate weekly review”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
