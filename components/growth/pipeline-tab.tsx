"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Composer } from "./composer";
import { PostCard } from "./post-card";

type XPost = FunctionReturnType<typeof api.xPosts.board>[number];

const COLUMNS: { status: XPost["status"]; label: string; hint: string }[] = [
  { status: "idea", label: "Ideas", hint: "Capture rough angles here." },
  { status: "draft", label: "Drafts", hint: "Written, not on the calendar yet." },
  { status: "scheduled", label: "Scheduled", hint: "Due posts light up amber." },
  { status: "posted", label: "Posted", hint: "Marked posted; metrics attach daily." },
];

// Evergreen posted items older than this resurface for recycling.
const RECYCLE_AFTER_DAYS = 30;

/**
 * The content pipeline (growth dashboard): a four-column board over xPosts.
 * All posting is manual — cards copy text and open X's compose window.
 */
export function PipelineTab() {
  const board = useQuery(api.xPosts.board);
  const [now, setNow] = useState(() => Date.now());
  // Day-rounded cutoff so the query subscription stays stable across ticks.
  const recycleBefore = useMemo(() => {
    const d = new Date(now - RECYCLE_AFTER_DAYS * 86_400_000);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);
  const recycleCandidates = useQuery(api.xPosts.recycleCandidates, {
    beforeMs: recycleBefore,
  });
  const [showArchived, setShowArchived] = useState(false);
  const archived = useQuery(api.xPosts.archived, showArchived ? {} : "skip");
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<XPost | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const byStatus = useMemo(() => {
    const map = new Map<string, XPost[]>();
    for (const p of board ?? []) {
      const list = map.get(p.status) ?? [];
      list.push(p);
      map.set(p.status, list);
    }
    return map;
  }, [board]);

  const onEdit = (post: XPost) => {
    setEditing(post);
    setComposing(true);
  };
  const closeComposer = () => {
    setComposing(false);
    setEditing(null);
  };

  if (board === undefined) {
    return <p className="text-[var(--color-text-secondary)] text-sm">Loading…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Idea → draft → scheduled → posted. You post from your own X session;
          the dashboard preps, times, and tracks.
        </p>
        <button
          onClick={() => (composing ? closeComposer() : setComposing(true))}
          className="text-sm bg-[var(--color-accent)] text-white rounded px-4 py-1.5 hover:bg-[var(--color-accent-hover)] shrink-0"
        >
          New post
        </button>
      </div>

      {composing && <Composer key={editing?._id ?? "new"} editing={editing} onClose={closeComposer} />}

      {recycleCandidates && recycleCandidates.length > 0 && (
        <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">
            Evergreen, ready to recycle ({recycleCandidates.length})
          </p>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {recycleCandidates.slice(0, 6).map((p) => (
              <PostCard key={p._id} post={p} now={now} onEdit={onEdit} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
        {COLUMNS.map((col) => {
          const list = byStatus.get(col.status) ?? [];
          return (
            <section key={col.status} className="min-w-0">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] border-b-2 border-[var(--color-accent)] pb-2 mb-3">
                {col.label}{" "}
                <span className="text-[var(--color-accent)]">{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)]">{col.hint}</p>
              ) : (
                <div className="space-y-3">
                  {list.map((p) => (
                    <PostCard key={p._id} post={p} now={now} onEdit={onEdit} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div>
        <button
          onClick={() => setShowArchived((s) => !s)}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </button>
        {showArchived && archived && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mt-3">
            {archived.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Nothing archived.
              </p>
            ) : (
              archived.map((p) => (
                <PostCard key={p._id} post={p} now={now} onEdit={onEdit} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
