"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import Nav from "@/components/nav";

type Creator = FunctionReturnType<typeof api.creators.listAll>[number];
type Pillar = "health" | "finance" | "startup";
type SortKey = "handle" | "pillar" | "active" | "fastPoll" | "added";
type TierFilter = "all" | "fast" | "slow" | "inactive";

const PILLAR_OPTIONS: { value: Pillar; label: string }[] = [
  { value: "health", label: "Health" },
  { value: "finance", label: "Finance" },
  { value: "startup", label: "Startup" },
];

const field =
  "border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";
const btn =
  "text-sm border border-[var(--color-border)] rounded px-3 py-1.5 bg-white hover:bg-[var(--color-border)]/30 disabled:opacity-50";
const th =
  "text-left text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] px-3 py-2 select-none";
const td = "px-3 py-2 text-sm";

// Rough getXAPI polling cost from the tier split (matches earlyFeed's cadence:
// fast tier every 5 min in a ~15h active window, everything hourly + off-hours).
function estimateCallsPerDay(fastCount: number, activeCount: number): number {
  const fastChunks = Math.ceil(Math.max(fastCount, 1) / 15);
  const allChunks = Math.ceil(Math.max(activeCount, 1) / 15);
  return 15 * (11 * fastChunks + 1 * allChunks) + 27 * allChunks;
}

/** Inline-editable note cell. */
function NoteCell({ creator }: { creator: Creator }) {
  const update = useMutation(api.creators.update);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(creator.note ?? "");
  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (value !== (creator.note ?? "")) {
            void update({
              id: creator._id,
              handle: creator.handle,
              note: value || undefined,
              active: creator.active !== false,
              pillar: creator.pillar ?? "health",
              fastPoll: creator.fastPoll,
            });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setValue(creator.note ?? "");
            setEditing(false);
          }
        }}
        className="w-full border border-[var(--color-accent)] rounded px-1.5 py-0.5 text-sm bg-white focus:outline-none"
      />
    );
  }
  return (
    <button
      onClick={() => {
        setValue(creator.note ?? "");
        setEditing(true);
      }}
      className="block w-full text-left truncate text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      title={creator.note ? `${creator.note} (click to edit)` : "click to add a note"}
    >
      {creator.note || <span className="opacity-40">—</span>}
    </button>
  );
}

export default function ManageCreators() {
  const creators = useQuery(api.creators.listAll);
  const createCreator = useMutation(api.creators.create);
  const update = useMutation(api.creators.update);
  const bulkSet = useMutation(api.creators.bulkSet);
  const bulkRemove = useMutation(api.creators.bulkRemove);
  const removeCreator = useMutation(api.creators.remove);
  const refreshFeed = useAction(api.creators_feed.refresh);
  const syncFollows = useAction(api.creators.syncFollows);

  const [search, setSearch] = useState("");
  const [pillarFilter, setPillarFilter] = useState<"all" | Pillar>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newPillar, setNewPillar] = useState<Pillar>("health");

  const rows = useMemo(() => {
    let list = creators ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) => c.handle.includes(q) || (c.note ?? "").toLowerCase().includes(q),
      );
    }
    if (pillarFilter !== "all") {
      list = list.filter((c) => (c.pillar ?? "health") === pillarFilter);
    }
    if (tierFilter === "fast") list = list.filter((c) => c.active !== false && c.fastPoll !== false);
    if (tierFilter === "slow") list = list.filter((c) => c.active !== false && c.fastPoll === false);
    if (tierFilter === "inactive") list = list.filter((c) => c.active === false);

    const cmp = (a: Creator, b: Creator): number => {
      switch (sortKey) {
        case "handle":
          return a.handle.localeCompare(b.handle);
        case "pillar":
          return (a.pillar ?? "health").localeCompare(b.pillar ?? "health");
        case "active":
          return Number(b.active !== false) - Number(a.active !== false);
        case "fastPoll":
          return Number(b.fastPoll !== false) - Number(a.fastPoll !== false);
        case "added":
          return a._creationTime - b._creationTime;
      }
    };
    return [...list].sort((a, b) => sortDir * cmp(a, b));
  }, [creators, search, pillarFilter, tierFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const all = creators ?? [];
    const active = all.filter((c) => c.active !== false);
    const fast = active.filter((c) => c.fastPoll !== false);
    const calls = estimateCallsPerDay(fast.length, active.length);
    return { total: all.length, active: active.length, fast: fast.length, calls };
  }, [creators]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "added" ? -1 : 1);
    }
  };
  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : "";

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));
  const toggleAll = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(rows.map((r) => r._id)));
  };
  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = [...selected] as Id<"creators">[];
  const runBulk = async (label: string, fn: () => Promise<unknown>) => {
    setStatus(`${label}…`);
    try {
      await fn();
      setStatus(`${label} done (${selectedIds.length}).`);
      setSelected(new Set());
    } catch (e) {
      setStatus(`${label} failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const inlinePatch = (c: Creator, patch: Partial<{ active: boolean; fastPoll: boolean; pillar: Pillar }>) =>
    void update({
      id: c._id,
      handle: c.handle,
      note: c.note ?? undefined,
      active: patch.active ?? c.active !== false,
      pillar: patch.pillar ?? c.pillar ?? "health",
      fastPoll: patch.fastPoll ?? c.fastPoll,
    });

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-16 md:py-20">
      <Nav />
      <div className="flex items-center justify-between mb-2 mt-8 flex-wrap gap-3">
        <h1 className="text-3xl font-semibold">Creators</h1>
        <div className="flex items-center gap-2">
          {status && (
            <span className="text-sm text-[var(--color-text-secondary)]">{status}</span>
          )}
          <button
            onClick={() =>
              void runBulk("Follow sync", async () => {
                const r = await syncFollows();
                setStatus(`Synced — ${r.added} added from ${r.following} follows.`);
              })
            }
            className={btn}
            title="Add every account you follow on X (daily automatic; deletions never re-added)"
          >
            Sync from my follows
          </button>
          <button
            onClick={() =>
              void runBulk("Feed refresh", async () => {
                await refreshFeed();
              })
            }
            className={btn}
          >
            Refresh feed
          </button>
        </div>
      </div>

      {/* Summary + cost */}
      <p className="text-sm text-[var(--color-text-secondary)] mb-5">
        {stats.total} accounts · {stats.active} active · {stats.fast} fast-polled
        (every 5 min) · {stats.active - stats.fast} hourly · ≈{" "}
        {stats.calls.toLocaleString()} getXAPI calls/day (~$
        {(stats.calls / 1000).toFixed(2)}/day). Posts feed the{" "}
        <Link href="/admin/growth#queue" className="text-[var(--color-accent)] hover:underline">
          queue & feeds
        </Link>
        ; fast poll is what powers early replies and Telegram pushes.
      </p>

      {/* Add form */}
      <form
        className="flex items-center gap-2 mb-5 flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newHandle.trim()) return;
          void createCreator({
            handle: newHandle,
            note: newNote || undefined,
            pillar: newPillar,
          });
          setNewHandle("");
          setNewNote("");
        }}
      >
        <input
          placeholder="X handle"
          value={newHandle}
          onChange={(e) => setNewHandle(e.target.value)}
          className={`${field} w-44`}
        />
        <input
          placeholder="Note (optional)"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className={`${field} flex-1 min-w-40`}
        />
        <select
          value={newPillar}
          onChange={(e) => setNewPillar(e.target.value as Pillar)}
          className={field}
        >
          {PILLAR_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-[var(--color-accent)] text-white rounded px-4 py-2 text-sm hover:bg-[var(--color-accent-hover)]"
        >
          Add
        </button>
      </form>

      {/* Search + filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          placeholder="Search handle or note…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${field} w-64`}
        />
        <select
          value={pillarFilter}
          onChange={(e) => setPillarFilter(e.target.value as "all" | Pillar)}
          className={field}
        >
          <option value="all">All pillars</option>
          {PILLAR_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="flex rounded border border-[var(--color-border)] overflow-hidden text-sm">
          {(
            [
              ["all", "All"],
              ["fast", "Fast"],
              ["slow", "Hourly"],
              ["inactive", "Inactive"],
            ] as [TierFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTierFilter(value)}
              className={`px-3 py-1.5 ${
                tierFilter === value
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-white text-[var(--color-text-secondary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--color-text-secondary)] ml-auto">
          {rows.length} shown
        </span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3 border border-[var(--color-accent)] rounded-lg bg-blue-50/50 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button
            onClick={() => void runBulk("Set fast", () => bulkSet({ ids: selectedIds, fastPoll: true }))}
            className={btn}
          >
            Fast poll
          </button>
          <button
            onClick={() => void runBulk("Set hourly", () => bulkSet({ ids: selectedIds, fastPoll: false }))}
            className={btn}
          >
            Hourly
          </button>
          {PILLAR_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => void runBulk(`Pillar → ${p.label}`, () => bulkSet({ ids: selectedIds, pillar: p.value }))}
              className={btn}
            >
              → {p.label}
            </button>
          ))}
          <button
            onClick={() => void runBulk("Deactivate", () => bulkSet({ ids: selectedIds, active: false }))}
            className={btn}
          >
            Deactivate
          </button>
          <button
            onClick={() => void runBulk("Activate", () => bulkSet({ ids: selectedIds, active: true }))}
            className={btn}
          >
            Activate
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete ${selected.size} creators? The follow sync won't re-add them.`))
                void runBulk("Delete", () => bulkRemove({ ids: selectedIds }));
            }}
            className={`${btn} text-red-600 ml-auto`}
          >
            Delete
          </button>
        </div>
      )}

      {/* The table */}
      {creators === undefined ? (
        <p className="text-[var(--color-text-secondary)]">Loading…</p>
      ) : (
        <div className="border border-[var(--color-border)] rounded-lg bg-white overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className={`${th} w-8`}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
                </th>
                <th className={`${th} cursor-pointer`} onClick={() => setSort("handle")}>
                  Handle{arrow("handle")}
                </th>
                <th className={th}>Note</th>
                <th className={`${th} cursor-pointer`} onClick={() => setSort("pillar")}>
                  Pillar{arrow("pillar")}
                </th>
                <th
                  className={`${th} cursor-pointer`}
                  onClick={() => setSort("fastPoll")}
                  title="Fast = every 5 min (early replies + pushes); Hourly = cheap sweep"
                >
                  Poll{arrow("fastPoll")}
                </th>
                <th className={`${th} cursor-pointer`} onClick={() => setSort("active")}>
                  Active{arrow("active")}
                </th>
                <th className={`${th} cursor-pointer`} onClick={() => setSort("added")}>
                  Added{arrow("added")}
                </th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c._id}
                  className={`border-t border-[var(--color-border)] ${c.active === false ? "opacity-50" : ""}`}
                >
                  <td className={td}>
                    <input
                      type="checkbox"
                      checked={selected.has(c._id)}
                      onChange={() => toggle(c._id)}
                    />
                  </td>
                  <td className={`${td} font-medium whitespace-nowrap`}>
                    <a
                      href={`https://x.com/${c.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--color-accent)]"
                    >
                      @{c.handle}
                    </a>
                  </td>
                  <td className={`${td} max-w-xs`}>
                    <NoteCell creator={c} />
                  </td>
                  <td className={td}>
                    <select
                      value={c.pillar ?? "health"}
                      onChange={(e) => inlinePatch(c, { pillar: e.target.value as Pillar })}
                      className="border border-transparent hover:border-[var(--color-border)] rounded px-1 py-0.5 text-sm bg-transparent"
                    >
                      {PILLAR_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={td}>
                    <button
                      onClick={() => inlinePatch(c, { fastPoll: c.fastPoll === false })}
                      className={`text-xs font-semibold rounded px-2 py-0.5 border ${
                        c.fastPoll !== false
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : "text-[var(--color-text-secondary)] bg-white border-[var(--color-border)]"
                      }`}
                      title="Click to toggle"
                    >
                      {c.fastPoll !== false ? "fast" : "hourly"}
                    </button>
                  </td>
                  <td className={td}>
                    <input
                      type="checkbox"
                      checked={c.active !== false}
                      onChange={(e) => inlinePatch(c, { active: e.target.checked })}
                    />
                  </td>
                  <td className={`${td} text-xs text-[var(--color-text-secondary)] whitespace-nowrap`}>
                    {new Date(c._creationTime).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className={td}>
                    <button
                      onClick={() => {
                        if (confirm(`Remove @${c.handle}? The follow sync won't re-add them.`))
                          void removeCreator({ id: c._id });
                      }}
                      className="text-xs text-[var(--color-text-secondary)] hover:text-red-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
