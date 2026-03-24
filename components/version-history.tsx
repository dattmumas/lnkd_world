"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { diffLines, Change } from "diff";
import type { Id } from "@/convex/_generated/dataModel";

interface VersionMeta {
  _id: Id<"versions">;
  slug: string;
  contentType: "post" | "reading" | "bookmark";
  contentHash: string;
  title: string;
  changeType?: "edit" | "restructure" | "expand" | "restore";
  createdAt: string;
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function changeLabel(type?: string): string {
  switch (type) {
    case "restructure": return "Restructured";
    case "expand": return "Expanded";
    case "restore": return "Restored";
    default: return "Revised";
  }
}

function DiffView({ currentId, previousId }: {
  currentId: Id<"versions">;
  previousId?: Id<"versions">;
}) {
  const pair = useQuery(api.versions.getVersionPair, {
    currentId,
    previousId,
  });

  if (!pair) {
    return <div className="animate-pulse h-24 bg-[var(--color-border)] rounded" />;
  }

  if (!pair.previous) {
    return (
      <div className="text-sm text-[var(--color-text-secondary)] italic">
        Initial version
      </div>
    );
  }

  const changes = diffLines(pair.previous.content, pair.current!.content);
  const CONTEXT = 3;

  // Collapse long unchanged sections
  const sections: { type: "diff" | "collapsed"; lines: Change[]; count?: number }[] = [];
  let unchangedBuffer: Change[] = [];

  for (const change of changes) {
    if (!change.added && !change.removed) {
      unchangedBuffer.push(change);
    } else {
      if (unchangedBuffer.length > CONTEXT * 2) {
        const leading = unchangedBuffer.slice(0, CONTEXT);
        const trailing = unchangedBuffer.slice(-CONTEXT);
        const hidden = unchangedBuffer.length - CONTEXT * 2;
        if (sections.length > 0) sections.push({ type: "diff", lines: leading });
        sections.push({ type: "collapsed", lines: [], count: hidden });
        sections.push({ type: "diff", lines: trailing });
      } else if (unchangedBuffer.length > 0) {
        sections.push({ type: "diff", lines: unchangedBuffer });
      }
      unchangedBuffer = [];
      sections.push({ type: "diff", lines: [change] });
    }
  }
  if (unchangedBuffer.length > CONTEXT) {
    sections.push({ type: "diff", lines: unchangedBuffer.slice(0, CONTEXT) });
    sections.push({ type: "collapsed", lines: [], count: unchangedBuffer.length - CONTEXT });
  } else if (unchangedBuffer.length > 0) {
    sections.push({ type: "diff", lines: unchangedBuffer });
  }

  return (
    <div className="font-mono text-xs leading-relaxed border border-[var(--color-border)] rounded overflow-hidden">
      {sections.map((section, i) => {
        if (section.type === "collapsed") {
          return (
            <div
              key={i}
              className="px-3 py-1 text-center text-[var(--color-text-secondary)] bg-[var(--color-border)]/30 text-[10px]"
            >
              {section.count} unchanged lines
            </div>
          );
        }
        return section.lines.map((change, j) => {
          const lineContent = change.value.replace(/\n$/, "");
          if (!lineContent && !change.added && !change.removed) return null;
          return (
            <div
              key={`${i}-${j}`}
              className={`px-3 py-0.5 ${
                change.added
                  ? "bg-green-50/50 text-green-900"
                  : change.removed
                    ? "bg-red-50/50 text-red-900 line-through"
                    : ""
              }`}
            >
              <span className="select-none mr-2 text-[var(--color-text-secondary)]">
                {change.added ? "+" : change.removed ? "−" : " "}
              </span>
              {lineContent}
            </div>
          );
        });
      })}
    </div>
  );
}

export default function VersionHistory({ versions }: { versions: VersionMeta[] }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (versions.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        No revision history yet.
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {versions.map((v, i) => {
        const isSelected = selectedIdx === i;
        const prevVersion = versions[i + 1]; // versions are newest-first
        const date = new Date(v.createdAt);
        const dateStr = date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

        return (
          <div key={v._id} className="relative pl-6">
            {/* Timeline line */}
            {i < versions.length - 1 && (
              <div className="absolute left-[7px] top-6 bottom-0 w-px bg-[var(--color-border)]" />
            )}

            {/* Timeline dot */}
            <div
              className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 ${
                isSelected
                  ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
                  : i === 0
                    ? "bg-[var(--color-accent)]/20 border-[var(--color-accent)]"
                    : "bg-[var(--color-bg)] border-[var(--color-border)]"
              }`}
            />

            {/* Version entry */}
            <button
              onClick={() => setSelectedIdx(isSelected ? null : i)}
              className="w-full text-left pb-6"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">
                  {changeLabel(v.changeType)}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {dateStr}
                </span>
                <span className="text-[10px] text-[var(--color-text-secondary)]">
                  {relativeTime(v.createdAt)}
                </span>
              </div>
            </button>

            {/* Diff view */}
            {isSelected && (
              <div className="pb-6 -mt-3">
                <DiffView
                  currentId={v._id}
                  previousId={prevVersion?._id}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
