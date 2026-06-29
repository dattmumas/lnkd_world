"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Nav from "@/components/nav";

const field =
  "w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

function SourceForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; url: string; active: boolean };
  onSubmit: (data: { name: string; url: string; active: boolean }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  return (
    <form
      className="space-y-3 border border-[var(--color-border)] rounded p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, url, active });
        if (!initial) {
          setName("");
          setUrl("");
          setActive(true);
        }
      }}
    >
      <input
        placeholder="Source name (e.g. STAT News)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={field}
      />
      <input
        placeholder="RSS feed URL (https://…/feed/)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        className={field}
      />
      {initial && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active (included in the feed)
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-[var(--color-accent)] text-white rounded px-4 py-2 text-sm hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          {initial ? "Save" : "Add source"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function ManageSources() {
  const sources = useQuery(api.newsSources.listAll);
  const create = useMutation(api.newsSources.create);
  const update = useMutation(api.newsSources.update);
  const remove = useMutation(api.newsSources.remove);
  const seedDefaults = useMutation(api.newsSources.seedDefaults);
  const refresh = useAction(api.scienceFeed.refresh);
  const [editingId, setEditingId] = useState<Id<"newsSources"> | null>(null);
  const [state, setState] = useState("");

  const onRefresh = async () => {
    setState("Refreshing…");
    try {
      const r = await refresh();
      setState(`Done — ${r.count} stor${r.count === 1 ? "y" : "ies"}.`);
    } catch {
      setState("Refresh failed — check logs.");
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <div className="flex items-center justify-between mb-8 mt-8">
        <h1 className="text-3xl font-semibold">Science Sources</h1>
        <div className="flex items-center gap-3">
          {state && (
            <span className="text-sm text-[var(--color-text-secondary)]">{state}</span>
          )}
          <button
            onClick={() => void onRefresh()}
            className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 hover:bg-[var(--color-border)]/30"
          >
            Refresh feed now
          </button>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        RSS sources combed for the{" "}
        <a href="/feed/science" className="text-[var(--color-accent)] hover:underline">
          Science News
        </a>{" "}
        feed (Opus picks what&apos;s worth sharing).
      </p>

      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">Add source</h2>
        <SourceForm
          onSubmit={(d) => void create({ name: d.name, url: d.url })}
        />
      </div>

      <h2 className="text-lg font-medium mb-3">Current sources</h2>
      {sources === undefined ? (
        <p className="text-[var(--color-text-secondary)]">Loading…</p>
      ) : sources.length === 0 ? (
        <div className="space-y-3">
          <p className="text-[var(--color-text-secondary)]">No sources yet.</p>
          <button
            onClick={() => void seedDefaults()}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            Load a default set (STAT, Nature, Science Daily, …)
          </button>
        </div>
      ) : (
        <ul className="space-y-4">
          {sources.map((s) => (
            <li key={s._id} className="border border-[var(--color-border)] rounded p-4">
              {editingId === s._id ? (
                <SourceForm
                  initial={{ name: s.name, url: s.url, active: s.active !== false }}
                  onSubmit={(d) => {
                    void update({ id: s._id, name: d.name, url: d.url, active: d.active });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {s.name}
                      {s.active === false && (
                        <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                          (inactive)
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{s.url}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => setEditingId(s._id)}
                      className="text-sm text-[var(--color-accent)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void remove({ id: s._id })}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
