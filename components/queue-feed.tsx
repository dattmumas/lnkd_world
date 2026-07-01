"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { priority } from "@/convex/lib/queueScore";

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

  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
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

  // "Act now": time-critical feeds still inside ~2 half-lives (reply window /
  // rising conversation). Everything else is today's material.
  const actNow = items.filter(
    (r) =>
      (r.primaryFeed === "early" || r.primaryFeed === "x-trends") &&
      now - r.publishedAt < 2 * r.halfLifeHours * 3_600_000,
  );
  const today = items.filter((r) => !actNow.includes(r));

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

  const copyDraft = (item: QueueItem) => {
    if (!item.draft) return;
    navigator.clipboard?.writeText(item.draft).catch(() => {});
    setCopied(item.id);
    setTimeout(() => setCopied((c) => (c === item.id ? null : c)), 1500);
    void act({ itemId: item.id, action: "copy_draft" }).catch(() => {});
  };

  const card = (r: QueueItem) => (
    <li
      key={r.id}
      className="border border-[var(--color-border)] rounded-lg bg-white p-4"
    >
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] flex-wrap">
        <span className="font-semibold text-[var(--color-accent)] uppercase tracking-wide">
          {FEED_LABEL[r.primaryFeed] ?? r.primaryFeed}
        </span>
        <span>· {r.scoreReason}</span>
        <span>· {age(r.publishedAt, now)} ago</span>
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
          {r.title && <p className="text-sm font-semibold mt-1">{r.title}</p>}
          {r.text && r.text !== r.title && (
            <p className="text-sm mt-1 whitespace-pre-wrap break-words line-clamp-4">
              {r.text}
            </p>
          )}
          {(r.replies ?? 0) + (r.reposts ?? 0) + (r.likes ?? 0) > 0 && (
            <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
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
          {r.draft && (
            <details className="mt-2 border border-[var(--color-border)] rounded p-2 bg-[var(--color-bg)]">
              <summary className="text-xs font-semibold cursor-pointer text-[var(--color-text-secondary)]">
                Draft {r.draftKind === "reply" ? "reply" : "tweet"}
              </summary>
              <p className="text-sm mt-2 whitespace-pre-wrap">{r.draft}</p>
              <button
                onClick={() => copyDraft(r)}
                className="text-xs mt-2 border border-[var(--color-border)] rounded px-2 py-1 hover:bg-[var(--color-border)]/30"
              >
                {copied === r.id ? "Copied!" : "Copy"}
              </button>
            </details>
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
              className="text-[var(--color-text-secondary)] hover:text-green-700"
            >
              Engaged
            </button>
            <button
              onClick={() => retire(r.id, "skipped")}
              className="text-[var(--color-text-secondary)] hover:text-red-600"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </li>
  );

  const section = (label: string, list: QueueItem[]) =>
    list.length > 0 && (
      <section className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] border-b border-[var(--color-border)] pb-2 mb-3">
          {label} <span className="text-[var(--color-accent)]">{list.length}</span>
        </h2>
        <ul className="space-y-3">{list.map(card)}</ul>
      </section>
    );

  if (data === undefined) {
    return <p className="text-[var(--color-text-secondary)] text-sm">Loading…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-[var(--color-text-secondary)] text-sm">
        Queue is clear. New items land here as the feeds refresh — early posts
        within ~20 minutes, news and trends daily.
      </p>
    );
  }
  return (
    <div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Everything worth engaging with, best first. Engaged and skipped items
        never come back.
      </p>
      {section("Act now", actNow)}
      {section("Today", today)}
    </div>
  );
}
