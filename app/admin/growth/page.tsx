"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Nav from "@/components/nav";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return String(n);
}

const field =
  "border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

export default function GrowthTracking() {
  const handle = useQuery(api.growth.getConfig);
  const latest = useQuery(api.growth.latest);
  const setHandle = useMutation(api.growth.setHandle);
  const snapshot = useAction(api.growth.snapshot);

  const [input, setInput] = useState("");
  const [state, setState] = useState("");

  const onSnapshot = async () => {
    setState("Snapshotting…");
    try {
      const r = await snapshot();
      setState(
        r.status === "ok"
          ? `Done — ${r.count} followers.`
          : r.status === "no-config"
            ? "Set a handle first."
            : `Snapshot ${r.status}.`,
      );
    } catch (e) {
      setState(`Failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const delta =
    latest && latest.prevCount != null ? latest.count - latest.prevCount : null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <div className="flex items-center justify-between mb-2 mt-8">
        <h1 className="text-3xl font-semibold">Growth Tracking</h1>
        <div className="flex items-center gap-3">
          {state && (
            <span className="text-sm text-[var(--color-text-secondary)]">{state}</span>
          )}
          <button
            onClick={() => void onSnapshot()}
            className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 hover:bg-[var(--color-border)]/30"
          >
            Snapshot now
          </button>
        </div>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Daily follower snapshot of one account, diffed day-over-day. Tie spikes to
        what you posted. Snapshots run automatically each day.
      </p>

      {/* Tracked handle */}
      <form
        className="flex items-center gap-2 mb-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) void setHandle({ handle: input.trim() });
          setInput("");
        }}
      >
        <span className="text-sm text-[var(--color-text-secondary)]">Tracking @</span>
        <input
          placeholder={handle ?? "your handle"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`${field} flex-1`}
        />
        <button
          type="submit"
          className="bg-[var(--color-accent)] text-white rounded px-4 py-2 text-sm hover:bg-[var(--color-accent-hover)]"
        >
          {handle ? "Change" : "Set"}
        </button>
      </form>

      {handle === null && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Set a handle above, then “Snapshot now” to start the history.
        </p>
      )}

      {latest && (
        <div className="space-y-6">
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-4xl font-semibold">{fmt(latest.count)}</div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                followers @{latest.handle}
                {latest.truncated && " (capped sample)"}
              </div>
            </div>
            {delta != null && (
              <div
                className={`text-lg font-medium ${
                  delta > 0
                    ? "text-green-600"
                    : delta < 0
                      ? "text-red-600"
                      : "text-[var(--color-text-secondary)]"
                }`}
              >
                {delta > 0 ? "+" : ""}
                {delta} since last
              </div>
            )}
          </div>

          <div className="text-sm text-[var(--color-text-secondary)]">
            +{latest.gainedCount} joined · −{latest.lostCount} left · snapshot{" "}
            {new Date(latest.fetchedAt).toLocaleString()}
          </div>

          {latest.gained.length > 0 && (
            <div>
              <h2 className="text-lg font-medium mb-2">New followers</h2>
              <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded">
                {latest.gained.map((f) => (
                  <li key={f.username} className="flex items-center justify-between p-3 text-sm">
                    <a
                      href={`https://x.com/${f.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      {f.name} <span className="text-[var(--color-text-secondary)]">@{f.username}</span>
                    </a>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {fmt(f.followers)} followers
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
