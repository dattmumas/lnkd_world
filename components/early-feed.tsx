"use client";

import { useMemo, useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

interface EarlyCard {
  tweetId: string;
  text: string;
  createdAt: string;
  username: string;
  name: string;
  avatar: string;
  followers: number;
  verified: boolean;
  permalink: string;
  replies: number;
  reposts: number;
  likes: number;
  views: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return String(n);
}

function age(createdAt: string, now: number): string {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return "";
  const m = Math.max(Math.round((now - t) / 60000), 1);
  return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`;
}

/** Native "Early Engagement" cards with per-card remove (admin). */
export function EarlyFeed() {
  const data = useQuery(api.earlyFeed.getLatest);
  const user = useQuery(api.users.currentUser);
  const refresh = useAction(api.earlyFeed.refresh);
  const removeByHandle = useMutation(api.creators.removeByHandle);

  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [state, setState] = useState("");
  const isAdmin = user?.role === "admin";
  const now = Date.now();

  const cards: EarlyCard[] = useMemo(() => {
    if (!data?.posts) return [];
    try {
      return JSON.parse(data.posts) as EarlyCard[];
    } catch {
      return [];
    }
  }, [data]);

  const visible = cards.filter((c) => !removed.has(c.username.toLowerCase()));

  const onRefresh = async () => {
    setState("Refreshing…");
    try {
      const r = await refresh();
      setState(`Updated — ${r.count} post${r.count === 1 ? "" : "s"}`);
    } catch {
      setState("Refresh failed — check logs.");
    }
  };

  const onRemove = async (handle: string) => {
    setRemoved((s) => new Set(s).add(handle.toLowerCase()));
    setState(`Removed @${handle} from your list.`);
    try {
      await removeByHandle({ handle });
    } catch {
      setRemoved((s) => {
        const next = new Set(s);
        next.delete(handle.toLowerCase());
        return next;
      });
      setState(`Couldn't remove @${handle}.`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Freshest posts from your watchlist — reply early.
        </p>
        <div className="flex items-center gap-3">
          {state && (
            <span className="text-xs text-[var(--color-text-secondary)]">{state}</span>
          )}
          {isAdmin && (
            <button
              onClick={() => void onRefresh()}
              disabled={state === "Refreshing…"}
              className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 hover:bg-[var(--color-border)]/30 disabled:opacity-60"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {data === undefined ? (
        <p className="text-[var(--color-text-secondary)] text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-sm">
          No fresh posts right now. This polls your{" "}
          <Link href="/admin/creators" className="text-[var(--color-accent)] hover:underline">
            watchlist
          </Link>{" "}
          every ~20 minutes.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((c) => (
            <li
              key={c.tweetId}
              className="border border-[var(--color-border)] rounded-lg bg-white p-4 flex gap-3"
            >
              {c.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.avatar.replace("_normal", "_bigger")}
                  alt=""
                  className="w-10 h-10 rounded-full shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--color-border)] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm flex-wrap">
                  <span className="font-semibold">{c.name}</span>
                  {c.verified && <span className="text-[var(--color-accent)]">✓</span>}
                  <a
                    href={`https://x.com/${c.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-text-secondary)] hover:underline"
                  >
                    @{c.username}
                  </a>
                  <span className="text-[var(--color-text-secondary)]">
                    · {age(c.createdAt, now)} · {fmt(c.followers)} followers
                  </span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">{c.text}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
                  <span>{fmt(c.replies)} replies</span>
                  <span>{fmt(c.reposts)} reposts</span>
                  <span>{fmt(c.likes)} likes</span>
                  {c.views > 0 && <span>{fmt(c.views)} views</span>}
                </div>
                <div className="flex items-center gap-3 mt-3 text-sm">
                  <a
                    href={c.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-accent)] hover:underline"
                  >
                    Open on X ↗
                  </a>
                  {isAdmin && (
                    <button
                      onClick={() => void onRemove(c.username)}
                      className="text-[var(--color-text-secondary)] hover:text-red-600"
                    >
                      Remove from list
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
