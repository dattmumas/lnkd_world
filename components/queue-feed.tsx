"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { priority } from "@/convex/lib/queueScore";
import { decodeInline } from "@/convex/lib/rss";

type QueueItem = FunctionReturnType<typeof api.queue.getQueue>[number];

const FEED_LABEL: Record<string, string> = {
  early: "Early reply",
  "x-trends": "Trending",
  science: "Science",
  biz: "Business",
  creators: "Creators",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return String(n);
}

function age(publishedAt: number, now: number): string {
  const m = Math.max(Math.round((now - publishedAt) / 60000), 1);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
}

/**
 * The unified engagement queue: every feed's picks on one priority scale
 * (convex/queue.ts), best-first. Priority decays with wall-clock time, so a
 * 60s tick re-scores and re-sorts client-side with the same lib/queueScore
 * functions the server used.
 */
export function QueueFeed() {
  const data = useQuery(api.queue.getQueue);
  const act = useMutation(api.queue.act);
  const user = useQuery(api.users.currentUser);
  const refreshEarly = useAction(api.earlyFeed.refresh);
  const isAdmin = user?.role === "admin";
  const [refreshState, setRefreshState] = useState("");

  const capture = useMutation(api.xPosts.captureFromQueue);

  const onRefresh = async () => {
    setRefreshState("Refreshing…");
    try {
      // Full watchlist sweep; new items land in the queue reactively.
      const r = await refreshEarly();
      setRefreshState(`Done — ${r.count} fresh post${r.count === 1 ? "" : "s"} checked.`);
    } catch {
      setRefreshState("Refresh failed — check logs.");
    }
    setTimeout(() => setRefreshState(""), 4000);
  };

  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [captured, setCaptured] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo(() => {
    return (data ?? [])
      .filter((r) => !removed.has(r.id))
      .map((r) => ({ ...r, priority: priority(r, now) }))
      .sort((a, b) => b.priority - a.priority);
  }, [data, removed, now]);

  // Two queues: Business & Science news (post a take) and Tweets (reply).
  // Early-engagement items carry the highest base score, so fresh watched-
  // creator posts sit on top of the tweets queue until their window closes.
  const business = items.filter(
    (r) => r.primaryFeed === "science" || r.primaryFeed === "biz",
  );
  const tweets = items.filter(
    (r) => r.primaryFeed !== "science" && r.primaryFeed !== "biz",
  );

  const retire = (id: QueueItem["id"], action: "engaged" | "skipped") => {
    setRemoved((s) => new Set(s).add(id));
    act({ itemId: id, action }).catch(() => {
      setRemoved((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    });
  };

  const card = (r: QueueItem) => {
    const replyWindowOpen =
      r.primaryFeed === "early" &&
      now - r.publishedAt < 2 * r.halfLifeHours * 3_600_000;
    // Remaining share of the item's engagement window: priority divided by its
    // decay-free ceiling leaves exactly 2^(−age/halfLife).
    const signal = Math.max(
      0,
      Math.min(1, r.priority / (r.baseScore * r.affinityMult)),
    );
    return (
    <li
      key={r.id}
      className="border border-[var(--color-border)] rounded-lg bg-white p-5 overflow-hidden"
    >
      <div
        className="gc-decay-track -mx-5 -mt-5 mb-3"
        title={`${Math.round(signal * 100)}% of the engagement window left · half-life ${r.halfLifeHours}h`}
      >
        <div
          className={`gc-decay-fill ${signal < 0.25 ? "low" : ""}`}
          style={{ width: `${signal * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] flex-wrap">
        <span className="font-plexmono text-[11px] font-semibold text-[var(--color-accent)] uppercase tracking-wider">
          {FEED_LABEL[r.primaryFeed] ?? r.primaryFeed}
        </span>
        {replyWindowOpen && (
          <span className="gc-chip gc-chip-due">reply window open</span>
        )}
        {/* Early items: the chip + author row already say it all. */}
        {r.primaryFeed !== "early" && <span>{r.scoreReason}</span>}
        <span className="ml-auto shrink-0 gc-num">{age(r.publishedAt, now)} ago</span>
      </div>

      <div className="flex gap-3 mt-2">
        {r.authorAvatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.authorAvatar.replace("_normal", "_bigger")}
            alt=""
            className="w-10 h-10 rounded-full shrink-0"
            loading="lazy"
          />
        )}
        {r.kind === "article" && r.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.imageUrl}
            alt=""
            className="w-24 h-20 rounded-lg object-cover shrink-0 bg-[var(--color-border)]"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          {r.kind === "x-post" && r.authorUsername ? (
            <div className="flex items-center gap-1 text-sm flex-wrap">
              {r.authorName && <span className="font-semibold">{r.authorName}</span>}
              {r.authorVerified && <span className="text-[var(--color-accent)]">✓</span>}
              <span className="text-[var(--color-text-secondary)]">
                @{r.authorUsername}
                {r.authorFollowers ? ` · ${fmt(r.authorFollowers)} followers` : ""}
                {r.authorNiche ? ` · ${r.authorNiche}` : ""}
              </span>
            </div>
          ) : (
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              {r.source}
            </div>
          )}
          {r.title && (
            <p className="text-sm font-semibold mt-1">{decodeInline(r.title)}</p>
          )}
          {r.text && r.text !== r.title && (
            <p className="text-sm mt-1 whitespace-pre-wrap break-words line-clamp-4">
              {decodeInline(r.text)}
            </p>
          )}
          {r.kind === "x-post" && r.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.imageUrl}
              alt=""
              className="mt-2 rounded-lg border border-[var(--color-border)] w-full max-h-72 object-cover"
              loading="lazy"
            />
          )}
          {(r.replies ?? 0) + (r.reposts ?? 0) + (r.likes ?? 0) > 0 && (
            <div className="flex items-center gap-4 mt-2 text-[11px] gc-num text-[var(--color-text-secondary)]">
              {r.replies != null && <span>{fmt(r.replies)} replies</span>}
              {r.reposts != null && <span>{fmt(r.reposts)} reposts</span>}
              {r.likes != null && <span>{fmt(r.likes)} likes</span>}
              {(r.views ?? 0) > 0 && <span>{fmt(r.views!)} views</span>}
            </div>
          )}
          {r.angle && (
            <p className="text-xs mt-2 text-[var(--color-text-secondary)] italic">
              {r.angle}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm">
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void act({ itemId: r.id, action: "open" }).catch(() => {})}
              className="text-[var(--color-accent)] hover:underline"
            >
              {r.kind === "x-post" ? "Open on X ↗" : "Read ↗"}
            </a>
            <button
              onClick={() => retire(r.id, "engaged")}
              className="text-[var(--color-text-secondary)] hover:text-[var(--gc-ok)]"
            >
              Engaged
            </button>
            <button
              onClick={() => retire(r.id, "skipped")}
              className="text-[var(--color-text-secondary)] hover:text-[var(--gc-fault)]"
            >
              Skip
            </button>
            <button
              onClick={() => {
                setCaptured((s) => new Set(s).add(r.id));
                capture({ itemId: r.id }).catch(() => {
                  setCaptured((s) => {
                    const next = new Set(s);
                    next.delete(r.id);
                    return next;
                  });
                });
              }}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
              title="Save as a content idea in the pipeline (stays in the queue)"
            >
              {captured.has(r.id) ? "Saved as idea ✓" : "→ Idea"}
            </button>
          </div>
        </div>
      </div>
    </li>
    );
  };

  const column = (label: string, hint: string, list: QueueItem[]) => (
    <section className="min-w-0">
      <h2 className="gc-label border-b-2 border-[var(--color-accent)] pb-2 mb-3">
        {label}{" "}
        <span className="gc-num text-[var(--color-accent)]">{list.length}</span>
      </h2>
      {list.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-sm">{hint}</p>
      ) : (
        <ul className="space-y-4">{list.map(card)}</ul>
      )}
    </section>
  );

  if (data === undefined) {
    return <p className="text-[var(--color-text-secondary)] text-sm">Loading…</p>;
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Everything worth engaging with, best first. Engaged and skipped items
          never come back.
        </p>
        {refreshState && (
          <span className="text-xs text-[var(--color-text-secondary)] ml-auto shrink-0">
            {refreshState}
          </span>
        )}
        {isAdmin && (
          <button
            onClick={() => void onRefresh()}
            disabled={refreshState === "Refreshing…"}
            className={`text-sm border border-[var(--color-border)] rounded px-3 py-1.5 bg-white hover:bg-[var(--color-border)]/30 disabled:opacity-50 shrink-0 ${refreshState ? "" : "ml-auto"}`}
            title="Poll the full watchlist for fresh posts now (new items appear live)"
          >
            Refresh
          </button>
        )}
      </div>
      <div className="grid lg:grid-cols-2 gap-10 items-start">
        {column(
          "Business & Science",
          "No stories queued. The news feeds refresh daily.",
          business,
        )}
        {column(
          "Tweets",
          "Nothing to reply to right now. Fresh watchlist posts land within ~20 minutes.",
          tweets,
        )}
      </div>
    </div>
  );
}
