"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Nav from "@/components/nav";

function CreatorForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: { handle: string; note: string; active: boolean };
  onSubmit: (data: { handle: string; note: string; active: boolean }) => void;
  onCancel?: () => void;
}) {
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  const field =
    "w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

  return (
    <form
      className="space-y-3 border border-[var(--color-border)] rounded p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ handle, note, active });
        if (!initial) {
          setHandle("");
          setNote("");
          setActive(true);
        }
      }}
    >
      <input
        placeholder="X handle (e.g. hubermanlab)"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        required
        className={field}
      />
      <input
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
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
          {initial ? "Save" : "Add Creator"}
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

export default function ManageCreators() {
  const creators = useQuery(api.creators.listAll);
  const createCreator = useMutation(api.creators.create);
  const updateCreator = useMutation(api.creators.update);
  const removeCreator = useMutation(api.creators.remove);
  const refreshFeed = useAction(api.creators_feed.refresh);
  const [editingId, setEditingId] = useState<Id<"creators"> | null>(null);
  const [refreshState, setRefreshState] = useState("");

  const onRefresh = async () => {
    setRefreshState("Refreshing…");
    try {
      const r = await refreshFeed();
      setRefreshState(`Done — ${r.count} post${r.count === 1 ? "" : "s"}.`);
    } catch {
      setRefreshState("Refresh failed — check the X API / logs.");
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <div className="flex items-center justify-between mb-8 mt-8">
        <h1 className="text-3xl font-semibold">Manage Creators</h1>
        <div className="flex items-center gap-3">
          {refreshState && (
            <span className="text-sm text-[var(--color-text-secondary)]">
              {refreshState}
            </span>
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
        Posts from these X accounts power the{" "}
        <Link href="/feed/creators" className="text-[var(--color-accent)] hover:underline">
          Creators feed
        </Link>{" "}
        (top recent, last 24h).
      </p>

      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">Add Creator</h2>
        <CreatorForm
          onSubmit={(data) => {
            void createCreator({ handle: data.handle, note: data.note || undefined });
          }}
        />
      </div>

      <h2 className="text-lg font-medium mb-3">Current Creators</h2>
      {creators === undefined ? (
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      ) : creators.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No creators yet. Add one above.</p>
      ) : (
        <ul className="space-y-4">
          {creators.map((c) => (
            <li key={c._id} className="border border-[var(--color-border)] rounded p-4">
              {editingId === c._id ? (
                <CreatorForm
                  initial={{
                    handle: c.handle,
                    note: c.note ?? "",
                    active: c.active !== false,
                  }}
                  onSubmit={(data) => {
                    void updateCreator({
                      id: c._id,
                      handle: data.handle,
                      note: data.note || undefined,
                      active: data.active,
                    });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      @{c.handle}
                      {c.active === false && (
                        <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                          (inactive)
                        </span>
                      )}
                    </p>
                    {c.note && (
                      <p className="text-sm text-[var(--color-text-secondary)]">{c.note}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => setEditingId(c._id)}
                      className="text-sm text-[var(--color-accent)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void removeCreator({ id: c._id })}
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
