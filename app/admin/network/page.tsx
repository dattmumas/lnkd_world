"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Nav from "@/components/nav";

interface WebAccount {
  id: string;
  username: string;
  name: string;
  description: string;
  followers: number;
  overlap: number;
  seeds: string[];
  enriched: boolean; // bio/follower count only fetched for the surfaced (overlap≥2) slice
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return String(n);
}

const field =
  "border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

function BuildForm({
  onBuild,
  busy,
}: {
  onBuild: (seeds: string[]) => void;
  busy: boolean;
}) {
  const [seeds, setSeeds] = useState<string[]>(["", ""]);

  const setAt = (i: number, val: string) =>
    setSeeds((s) => s.map((v, j) => (j === i ? val : v)));

  return (
    <form
      className="space-y-3 border border-[var(--color-border)] rounded p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const cleaned = seeds.map((s) => s.trim()).filter(Boolean);
        if (cleaned.length >= 2) onBuild(cleaned);
      }}
    >
      <p className="text-sm text-[var(--color-text-secondary)]">
        Enter 2+ seed handles. The web is every account they <strong>follow</strong>,
        ranked by how many of your seeds follow each.
      </p>
      <div className="space-y-2">
        {seeds.map((s, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-sm text-[var(--color-text-secondary)] py-2">@</span>
            <input
              placeholder={`seed handle ${i + 1}`}
              value={s}
              onChange={(e) => setAt(i, e.target.value)}
              className={`${field} flex-1`}
            />
            {seeds.length > 2 && (
              <button
                type="button"
                onClick={() => setSeeds((arr) => arr.filter((_, j) => j !== i))}
                className="text-sm text-[var(--color-text-secondary)] hover:text-red-600 px-2"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSeeds((s) => [...s, ""])}
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          + add seed
        </button>
        <button
          type="submit"
          disabled={busy || seeds.filter((s) => s.trim()).length < 2}
          className="bg-[var(--color-accent)] text-white rounded px-4 py-2 text-sm hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60"
        >
          {busy ? "Building…" : "Build web"}
        </button>
      </div>
    </form>
  );
}

export default function NetworkDiscovery() {
  const runs = useQuery(api.network.listRuns);
  const build = useAction(api.network.build);
  const addToWatchlist = useMutation(api.network.addToWatchlist);
  const followAccounts = useAction(api.xFollow.followAccounts);

  const [buildState, setBuildState] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<Id<"networkRuns"> | null>(null);
  const run = useQuery(
    api.network.getRun,
    selectedRunId ? { id: selectedRunId } : "skip",
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [minOverlap, setMinOverlap] = useState(2); // default to the enriched core
  const [filter, setFilter] = useState("");
  const [actionState, setActionState] = useState("");
  const [confirmFollow, setConfirmFollow] = useState(false);

  const accounts: WebAccount[] = useMemo(() => {
    if (!run?.accounts) return [];
    try {
      return JSON.parse(run.accounts) as WebAccount[];
    } catch {
      return [];
    }
  }, [run]);

  const totalSeeds = run?.seeds.length ?? 0;

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        a.overlap >= minOverlap &&
        (!q ||
          a.username.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)),
    );
  }, [accounts, minOverlap, filter]);

  const selectedAccounts = accounts.filter((a) => selected.has(a.id));

  const onBuild = async (seeds: string[]) => {
    setBuildState("Building… (pulling following lists from X)");
    try {
      const r = await build({ seeds });
      setBuildState(
        r.status === "ok"
          ? `Done — ${r.count} accounts in the web.`
          : `Build ${r.status}.`,
      );
    } catch (e) {
      setBuildState(`Failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onAddToWatchlist = async () => {
    if (!selectedAccounts.length) return;
    setActionState("Adding to watchlist…");
    const r = await addToWatchlist({
      handles: selectedAccounts.map((a) => a.username),
      note: `via network: ${run?.seeds.join(" + ")}`,
    });
    setActionState(`Watchlist — added ${r.added}, skipped ${r.skipped} (already there).`);
  };

  const onFollow = async () => {
    if (!selectedAccounts.length) return;
    setConfirmFollow(false);
    setActionState(`Following ${selectedAccounts.length}… (paced, ~2s each)`);
    try {
      const r = await followAccounts({
        targets: selectedAccounts.map((a) => ({ id: a.id, username: a.username })),
      });
      setActionState(
        `Followed ${r.followed}, failed ${r.failed}, skipped ${r.skipped}` +
          (r.stoppedEarly ? " — stopped early (cap/rate-limit)." : ".") +
          ` Daily cap remaining: ${r.capRemaining}.`,
      );
    } catch (e) {
      setActionState(`Follow failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected =
    visible.length > 0 && visible.every((a) => selected.has(a.id));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allVisibleSelected) visible.forEach((a) => next.delete(a.id));
      else visible.forEach((a) => next.add(a.id));
      return next;
    });

  return (
    <main className="max-w-4xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <div className="flex items-center justify-between mb-2 mt-8">
        <h1 className="text-3xl font-semibold">Network Discovery</h1>
        {buildState && (
          <span className="text-sm text-[var(--color-text-secondary)]">{buildState}</span>
        )}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Build a follower web from seed accounts, then add to the{" "}
        <a href="/admin/creators" className="text-[var(--color-accent)] hover:underline">
          Creators watchlist
        </a>{" "}
        or follow on X.
      </p>

      <BuildForm onBuild={(s) => void onBuild(s)} busy={buildState.startsWith("Building")} />

      {/* Saved runs */}
      <h2 className="text-lg font-medium mt-10 mb-3">Saved runs</h2>
      {runs === undefined ? (
        <p className="text-[var(--color-text-secondary)] text-sm">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-sm">No runs yet.</p>
      ) : (
        <ul className="space-y-2">
          {runs.map((r) => (
            <li key={r._id}>
              <button
                onClick={() => {
                  setSelectedRunId(r._id);
                  setSelected(new Set());
                  setActionState("");
                  setMinOverlap(2);
                }}
                className={`w-full text-left border rounded p-3 text-sm hover:bg-[var(--color-border)]/20 ${
                  selectedRunId === r._id
                    ? "border-[var(--color-accent)]"
                    : "border-[var(--color-border)]"
                }`}
              >
                <span className="font-medium">{r.seeds.map((s) => `@${s}`).join(" + ")}</span>
                <span className="text-[var(--color-text-secondary)]">
                  {" "}
                  · {r.status === "ok" ? `${r.count} accounts` : r.status}
                  {r.truncated && " · truncated"}
                  {r.error && ` · ${r.error}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Selected run web */}
      {selectedRunId && run && accounts.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-lg font-medium">The web ({visible.length})</h2>
            <label className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1">
              min overlap
              <select
                value={minOverlap}
                onChange={(e) => setMinOverlap(Number(e.target.value))}
                className={field}
              >
                {Array.from({ length: totalSeeds }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}/{totalSeeds}
                  </option>
                ))}
              </select>
            </label>
            <input
              placeholder="filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`${field} flex-1 min-w-[8rem]`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-3">
            <button onClick={toggleAll} className="text-sm text-[var(--color-accent)] hover:underline">
              {allVisibleSelected ? "Deselect all" : "Select all shown"}
            </button>
            <span className="text-sm text-[var(--color-text-secondary)]">
              {selected.size} selected
            </span>
            <button
              onClick={() => void onAddToWatchlist()}
              disabled={selected.size === 0}
              className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 hover:bg-[var(--color-border)]/30 disabled:opacity-50"
            >
              Add to watchlist
            </button>
            <button
              onClick={() => setConfirmFollow(true)}
              disabled={selected.size === 0}
              className="text-sm bg-[var(--color-accent)] text-white rounded px-3 py-1.5 hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              Follow on X
            </button>
            {actionState && (
              <span className="text-sm text-[var(--color-text-secondary)]">{actionState}</span>
            )}
          </div>

          {confirmFollow && (
            <div className="border border-[var(--color-accent)] rounded p-4 mb-3 text-sm">
              <p className="mb-2">
                Follow these <strong>{selectedAccounts.length}</strong> accounts on X?
                Paced ~2s each, capped per day. Already-followed accounts are skipped.
              </p>
              <p className="text-[var(--color-text-secondary)] mb-3 break-words">
                {selectedAccounts.map((a) => `@${a.username}`).join(", ")}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => void onFollow()}
                  className="bg-[var(--color-accent)] text-white rounded px-4 py-2 hover:bg-[var(--color-accent-hover)]"
                >
                  Confirm follow
                </button>
                <button
                  onClick={() => setConfirmFollow(false)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded">
            {visible.map((a) => (
              <li key={a.id} className="flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{a.name}</span>{" "}
                    <a
                      href={`https://x.com/${a.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      @{a.username}
                    </a>
                  </p>
                  {a.description && (
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                      {a.description}
                    </p>
                  )}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] text-right shrink-0">
                  <div className="font-medium text-[var(--color-text)]">
                    {a.overlap}/{totalSeeds}
                  </div>
                  <div>{a.enriched ? `${fmt(a.followers)} followers` : "—"}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedRunId && run && accounts.length === 0 && (
        <p className="mt-8 text-sm text-[var(--color-text-secondary)]">
          This run has no accounts{run.error ? ` — ${run.error}` : ""}.
        </p>
      )}
    </main>
  );
}
