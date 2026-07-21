"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { computeBestWindows, DEFAULT_WINDOW_NOTE } from "./best-times";

type XPost = FunctionReturnType<typeof api.xPosts.board>[number];
type Pillar = XPost["pillar"];

const PILLAR_OPTIONS: { value: Pillar; label: string }[] = [
  { value: "health", label: "Health & Longevity" },
  { value: "finance", label: "Finance & Deals" },
  { value: "startup", label: "Startup" },
];

const field =
  "border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

function CharCount({ text }: { text: string }) {
  // Approximate: X counts URLs as 23 chars and weights some glyphs differently.
  const n = text.length;
  return (
    <span className={`gc-num text-[11px] ${n > 280 ? "text-[var(--gc-fault)] font-semibold" : "text-[var(--color-text-secondary)]"}`}>
      {n}/280
    </span>
  );
}

/**
 * The post composer (growth dashboard, Pipeline tab): write a single post or
 * thread, tag its pillar, optionally schedule it. Editing an existing card
 * reuses the same form.
 */
export function Composer({
  editing,
  onClose,
}: {
  editing: XPost | null;
  onClose: () => void;
}) {
  const create = useMutation(api.xPosts.create);
  const update = useMutation(api.xPosts.update);
  const schedule = useMutation(api.xPosts.schedule);
  const board = useQuery(api.xPosts.board); // deduped with the pipeline's subscription

  const [pillar, setPillar] = useState<Pillar>(editing?.pillar ?? "health");
  const [kind, setKind] = useState<"single" | "thread">(editing?.kind ?? "single");
  const [body, setBody] = useState(editing?.body ?? "");
  const [parts, setParts] = useState<string[]>(editing?.threadParts ?? []);
  const [evergreen, setEvergreen] = useState(editing?.isEvergreen ?? false);
  const [when, setWhen] = useState(""); // datetime-local value
  const [autoPost, setAutoPost] = useState(editing?.autoPost !== false);
  const [sourceMaterial, setSourceMaterial] = useState(editing?.sourceText ?? "");
  const [showSource, setShowSource] = useState(!!editing?.sourceText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const effectiveParts = kind === "thread" ? parts : [];

  const save = async (status: "idea" | "draft") => {
    if (!body.trim()) {
      setError("The post needs a body.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const scheduledAt = when ? new Date(when).getTime() : undefined;
      if (editing) {
        await update({
          id: editing._id,
          pillar,
          kind,
          body: body.trim(),
          threadParts: effectiveParts,
          isEvergreen: evergreen,
          sourceText: sourceMaterial.trim(),
        });
        if (scheduledAt) await schedule({ id: editing._id, scheduledAt, autoPost });
      } else {
        await create({
          pillar,
          kind,
          body: body.trim(),
          threadParts: effectiveParts.length ? effectiveParts : undefined,
          status,
          isEvergreen: evergreen || undefined,
          source: "manual",
          scheduledAt,
          autoPost: scheduledAt ? autoPost : undefined,
          sourceText: sourceMaterial.trim() || undefined,
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="border border-[var(--color-accent)] rounded-lg bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{editing ? "Edit post" : "New post"}</h3>
        <button
          onClick={onClose}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Close
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={pillar}
          onChange={(e) => setPillar(e.target.value as Pillar)}
          className={field}
        >
          {PILLAR_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="flex rounded border border-[var(--color-border)] overflow-hidden text-sm">
          {(["single", "thread"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 ${
                kind === k
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-white text-[var(--color-text-secondary)]"
              }`}
            >
              {k === "single" ? "Single" : "Thread"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={evergreen}
            onChange={(e) => setEvergreen(e.target.checked)}
          />
          Evergreen
        </label>
      </div>

      {/* Source material notes */}
      <div>
        <button
          onClick={() => setShowSource((s) => !s)}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          {showSource ? "− source material" : "+ paste source material"}
        </button>
        {showSource && (
          <textarea
            placeholder="Article, notes, or data this post draws from…"
            value={sourceMaterial}
            onChange={(e) => setSourceMaterial(e.target.value)}
            rows={4}
            className={`${field} w-full mt-2`}
          />
        )}
      </div>

      {/* Body + thread parts */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="gc-label">
            {kind === "thread" ? "Hook (part 1)" : "Post"}
          </label>
          <CharCount text={body} />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className={`${field} w-full`}
        />
      </div>
      {kind === "thread" && (
        <div className="space-y-3">
          {parts.map((p, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <label className="gc-label">Part {i + 2}</label>
                <div className="flex items-center gap-3">
                  <CharCount text={p} />
                  <button
                    onClick={() => setParts(parts.filter((_, j) => j !== i))}
                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--gc-fault)]"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <textarea
                value={p}
                onChange={(e) =>
                  setParts(parts.map((x, j) => (j === i ? e.target.value : x)))
                }
                rows={3}
                className={`${field} w-full`}
              />
            </div>
          ))}
          <button
            onClick={() => setParts([...parts, ""])}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            + Add part
          </button>
        </div>
      )}

      {/* Schedule + save */}
      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-[var(--color-border)]">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Schedule:
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className={`${field} ml-2`}
          />
        </label>
        {when && (
          <label
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]"
            title="Posts through the X API at the scheduled time. Untick to post it yourself."
          >
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
            />
            Auto-post
          </label>
        )}
        <span
          className="text-xs text-[var(--color-text-secondary)]"
          title={
            computeBestWindows(board ?? [])
              ?.map((w) => `${w.label} (avg ${w.avgEngagement})`)
              .join(" · ") ?? DEFAULT_WINDOW_NOTE
          }
        >
          {(() => {
            const windows = computeBestWindows(board ?? []);
            return windows
              ? `Your best windows: ${windows.map((w) => w.label).join(", ")}`
              : "Best windows: Tue–Thu 9–11am (default)";
          })()}
        </span>
        <div className="ml-auto flex gap-2">
          {!editing && (
            <button
              onClick={() => void save("idea")}
              disabled={busy}
              className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 bg-white hover:bg-[var(--color-border)]/30 disabled:opacity-50"
            >
              Save as idea
            </button>
          )}
          <button
            onClick={() => void save("draft")}
            disabled={busy}
            className="text-sm bg-[var(--color-accent)] text-white rounded px-4 py-1.5 hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {when ? "Schedule" : editing ? "Save changes" : "Save draft"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-[var(--gc-fault)]">{error}</p>}
    </div>
  );
}
