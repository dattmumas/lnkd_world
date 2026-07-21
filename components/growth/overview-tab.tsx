"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { LineChart } from "./follower-chart";
import { PostCard } from "./post-card";
import { Composer } from "./composer";
import { decodeInline } from "@/convex/lib/rss";

type XPost = FunctionReturnType<typeof api.xPosts.board>[number];

const REPLY_TARGET = "15–20";

const field =
  "border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return String(n);
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[var(--color-text-secondary)]">—</span>;
  const cls =
    value > 0
      ? "text-[var(--gc-ok)]"
      : value < 0
        ? "text-[var(--gc-fault)]"
        : "text-[var(--color-text-secondary)]";
  return (
    <span className={cls}>
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-white p-4">
      <div className="gc-num text-2xl font-medium">{children}</div>
      <div className="gc-label mt-1.5">{label}</div>
    </div>
  );
}

function FollowerList({
  title,
  people,
}: {
  title: string;
  people: { username: string; name: string; followers: number }[];
}) {
  return (
    <div>
      <h3 className="gc-label mb-2">{title}</h3>
      <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded bg-white max-h-72 overflow-y-auto">
        {people.map((f) => (
          <li key={f.username} className="flex items-center justify-between p-2.5 text-sm">
            <a
              href={`https://x.com/${f.username}`}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent)] hover:underline truncate"
            >
              {f.name}{" "}
              <span className="text-[var(--color-text-secondary)]">@{f.username}</span>
            </a>
            <span className="gc-num text-xs text-[var(--color-text-secondary)] shrink-0 ml-2">
              {fmt(f.followers)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// How stale each cron may go before its chip turns red (generous multiples of
// the real cadence so a single slow run doesn't false-alarm).
const CRON_EXPECTED_MS: Record<string, number> = {
  "early-feed": 40 * 60_000,
  "x-poster": 15 * 60_000,
  "x-metrics": 26 * 3_600_000,
  "growth-snapshot": 26 * 3_600_000,
  "science-feed": 8 * 3_600_000, // 3×/day cadence
  "weekly-review": 8 * 86_400_000,
  beehiiv: 26 * 3_600_000,
  "own-replies": 3 * 3_600_000,
  "follow-sync": 26 * 3_600_000,
  "deal-radar": 5 * 3_600_000, // hourly active, 4h overnight
};

function agoShort(ms: number, now: number): string {
  const m = Math.max(Math.round((now - ms) / 60_000), 0);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}

/** Compact cron-health strip — is the machinery actually running? */
function HealthStrip({ now }: { now: number }) {
  const rows = useQuery(api.cronHealth.list);
  if (!rows || rows.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {rows.map((r) => {
        const expected = CRON_EXPECTED_MS[r.name] ?? 26 * 3_600_000;
        const stale = r.lastOkAt == null || now - r.lastOkAt > expected;
        const bad = !r.ok || stale;
        return (
          <span
            key={r.name}
            title={
              r.ok
                ? `last ok ${r.lastOkAt ? agoShort(r.lastOkAt, now) : "never"} ago${r.meta ? ` · ${r.meta}` : ""}`
                : `failed: ${r.lastError ?? "unknown"}`
            }
            className={`gc-chip ${bad ? "gc-chip-fault" : "gc-chip-ok"}`}
          >
            {r.name} · {r.lastOkAt ? agoShort(r.lastOkAt, now) : "—"}
          </span>
        );
      })}
    </div>
  );
}

/** Active-hours + notification settings (fast polling and Telegram pushes). */
function SettingsCard() {
  const settings = useQuery(api.growthSettings.get);
  const save = useMutation(api.growthSettings.set);
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [notify, setNotify] = useState<boolean | null>(null);
  const [minFollowers, setMinFollowers] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const cur = {
    start: start ?? settings?.activeStartHour ?? 8,
    end: end ?? settings?.activeEndHour ?? 23,
    notify: notify ?? settings?.notifyEnabled !== false,
    minFollowers: minFollowers ?? String(settings?.notifyMinFollowers ?? 0),
  };

  const hourOptions = Array.from({ length: 24 }, (_, h) => (
    <option key={h} value={h}>
      {h}:00
    </option>
  ));

  const onSave = async () => {
    await save({
      activeStartHour: cur.start,
      activeEndHour: cur.end,
      tzOffsetMinutes: -new Date().getTimezoneOffset(),
      notifyEnabled: cur.notify,
      notifyMinFollowers: Number(cur.minFollowers) || 0,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-white p-4 space-y-3">
      <h2 className="gc-label">Fast polling & alerts</h2>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--color-text-secondary)]">Active</span>
        <select
          value={cur.start}
          onChange={(e) => setStart(Number(e.target.value))}
          className={field}
        >
          {hourOptions}
        </select>
        <span className="text-[var(--color-text-secondary)]">to</span>
        <select
          value={cur.end}
          onChange={(e) => setEnd(Number(e.target.value))}
          className={field}
        >
          {hourOptions}
        </select>
      </div>
      <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
        <input
          type="checkbox"
          checked={cur.notify}
          onChange={(e) => setNotify(e.target.checked)}
        />
        Telegram alerts for hot reply opportunities
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        Only accounts over
        <input
          value={cur.minFollowers}
          onChange={(e) => setMinFollowers(e.target.value)}
          className={`${field} w-24`}
          inputMode="numeric"
        />
        followers
      </label>
      <button
        onClick={() => void onSave()}
        className="text-sm bg-[var(--color-accent)] text-white rounded px-3 py-1.5 hover:bg-[var(--color-accent-hover)] w-full"
      >
        {saved ? "Saved" : "Save"}
      </button>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Inside these hours the watchlist polls every 5 minutes with pushes;
        outside, every ~20 minutes. Saving captures your timezone.
      </p>
    </div>
  );
}

/**
 * The growth dashboard's Overview: the follower curve, today's action targets
 * (replies engaged vs the 15-20/day range, posts due), who joined/left, and the
 * top of the engagement queue.
 */
export function OverviewTab() {
  const series = useQuery(api.growth.series);
  const latest = useQuery(api.growth.latest);
  const handle = useQuery(api.growth.getConfig);
  const board = useQuery(api.xPosts.board);
  const queue = useQuery(api.queue.getQueue);
  const setHandle = useMutation(api.growth.setHandle);
  const snapshot = useAction(api.growth.snapshot);

  const [now, setNow] = useState(() => Date.now());
  const [handleInput, setHandleInput] = useState("");
  const [state, setState] = useState("");
  const [editing, setEditing] = useState<XPost | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Local midnight, stable within the day, so the subscription doesn't churn.
  const midnight = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);
  const engagedToday = useQuery(api.xMetrics.engagedToday, { sinceMs: midnight });

  // Auto-post items fire themselves within ~2 min; only surface what needs a human.
  const due = (board ?? []).filter(
    (p) =>
      p.status === "scheduled" &&
      p.scheduledAt != null &&
      p.scheduledAt <= now &&
      (p.autoPost === false || p.postError != null),
  );
  const scheduledToday = (board ?? []).filter(
    (p) =>
      p.status === "scheduled" &&
      p.scheduledAt != null &&
      p.scheduledAt >= midnight &&
      p.scheduledAt < midnight + 86_400_000,
  );

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

  const chartPoints = (series?.points ?? []).map((p) => ({
    x: Date.parse(p.fetchedAt),
    y: p.count,
    label: `${new Date(p.fetchedAt).toLocaleDateString()}: ${p.count} followers`,
  }));

  return (
    <div className="space-y-8">
      <HealthStrip now={now} />

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label={`followers${handle ? ` @${handle}` : ""}`}>
          {series ? fmt(series.count) : "—"}
        </Stat>
        <Stat label="since yesterday">
          <Delta value={series?.deltaDay ?? null} />
        </Stat>
        <Stat label="past 7 days">
          <Delta value={series?.deltaWeek ?? null} />
        </Stat>
        <Stat label={`replies engaged today (target ${REPLY_TARGET})`}>
          {engagedToday ?? 0}
        </Stat>
        <Stat label="posts due / scheduled today">
          {due.length} / {scheduledToday.length}
        </Stat>
      </div>

      {/* Growth chart + tracked handle */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 border border-[var(--color-border)] rounded-lg bg-white p-4">
          <h2 className="gc-label mb-3">Follower growth</h2>
          <LineChart series={chartPoints} formatY={fmt} />
        </div>
        <div className="space-y-4">
        <div className="border border-[var(--color-border)] rounded-lg bg-white p-4 space-y-3">
          <h2 className="gc-label">Tracking</h2>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (handleInput.trim()) void setHandle({ handle: handleInput.trim() });
              setHandleInput("");
            }}
          >
            <span className="text-sm text-[var(--color-text-secondary)]">@</span>
            <input
              placeholder={handle ?? "your handle"}
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              className={`${field} flex-1 min-w-0`}
            />
            <button
              type="submit"
              className="text-sm bg-[var(--color-accent)] text-white rounded px-3 py-1.5 hover:bg-[var(--color-accent-hover)] shrink-0"
            >
              {handle ? "Change" : "Set"}
            </button>
          </form>
          <button
            onClick={() => void onSnapshot()}
            className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 hover:bg-[var(--color-border)]/30 w-full"
          >
            Snapshot now
          </button>
          {state && (
            <p className="text-xs text-[var(--color-text-secondary)]">{state}</p>
          )}
          {latest && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              +{latest.gainedCount} joined · −{latest.lostCount} left · last snapshot{" "}
              {new Date(latest.fetchedAt).toLocaleString()}
              {latest.truncated && " (capped sample)"}
            </p>
          )}
        </div>
        <SettingsCard />
        </div>
      </div>

      {/* Due now */}
      {due.length > 0 && (
        <div className="gc-banner-due p-3">
          <p className="font-plexmono text-[11px] font-semibold uppercase tracking-wider text-[var(--gc-due)] mb-2">
            Due now — copy, post on X, then mark posted
          </p>
          {editing && <Composer key={editing._id} editing={editing} onClose={() => setEditing(null)} />}
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {due.map((p) => (
              <PostCard key={p._id} post={p} now={now} onEdit={setEditing} />
            ))}
          </div>
        </div>
      )}

      {/* Queue preview */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="gc-label">Top of the engagement queue</h2>
          <a href="#queue" className="text-xs text-[var(--color-accent)] hover:underline">
            Open queue →
          </a>
        </div>
        {queue === undefined ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Queue is clear. Fresh watchlist posts land within ~20 minutes.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg bg-white">
            {queue.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="font-plexmono text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)] shrink-0">
                  {r.primaryFeed}
                </span>
                <span className="truncate flex-1">
                  {r.authorUsername ? (
                    <span className="text-[var(--color-text-secondary)]">
                      @{r.authorUsername}:{" "}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-secondary)]">{r.source}: </span>
                  )}
                  {decodeInline(r.title ?? r.text)}
                </span>
                <a
                  href={r.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-accent)] hover:underline shrink-0"
                >
                  Open ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Gained / lost */}
      {latest && (latest.gained.length > 0 || latest.lost.length > 0) && (
        <div className="grid md:grid-cols-2 gap-6">
          {latest.gained.length > 0 && (
            <FollowerList title={`New followers (${latest.gainedCount})`} people={latest.gained} />
          )}
          {latest.lost.length > 0 && (
            <FollowerList title={`Unfollowed (${latest.lostCount})`} people={latest.lost} />
          )}
        </div>
      )}
    </div>
  );
}
