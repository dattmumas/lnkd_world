"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import dynamic from "next/dynamic";

// Client-only: SSR-evaluating the markdown pipeline blows the Workers CPU budget.
const Markdown = dynamic(() => import("@/components/markdown"), { ssr: false });

type Deal = FunctionReturnType<typeof api.deals.list>[number];

const th = "text-left gc-label px-3 py-2 select-none";
const td = "px-3 py-2 text-sm";
const field =
  "border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

export function fmtAmount(d: { amountUsd: number | null }): string {
  if (d.amountUsd == null) return "—";
  if (d.amountUsd >= 1_000_000_000) return `$${(d.amountUsd / 1_000_000_000).toFixed(1)}B`;
  if (d.amountUsd >= 1_000_000) return `$${Math.round(d.amountUsd / 1_000_000)}M`;
  return `$${Math.round(d.amountUsd / 1000)}K`;
}


/**
 * Checkbox-dropdown filter: empty selection = "all". Multi-select without the
 * ctrl-click misery of a native <select multiple>.
 */
function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string; // plural noun, e.g. "categories"
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  };

  const summary =
    selected.size === 0
      ? `All ${label}`
      : selected.size <= 2
        ? [...selected].sort().join(", ")
        : `${selected.size} ${label}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${field} flex items-center gap-2 ${selected.size > 0 ? "border-[var(--color-accent)]" : ""}`}
      >
        <span className="max-w-44 truncate">{summary}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 min-w-full max-h-72 overflow-y-auto border border-[var(--color-border)] rounded bg-white shadow-lg py-1">
          {selected.size > 0 && (
            <button
              onClick={() => onChange(new Set())}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-bg)]"
            >
              Clear ({selected.size})
            </button>
          )}
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-1.5 text-sm whitespace-nowrap cursor-pointer hover:bg-[var(--color-bg)]"
            >
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => toggle(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Inline-editable company name — corrections flow through to the dedup keys. */
function CompanyName({ deal }: { deal: Deal }) {
  const rename = useMutation(api.deals.rename);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(deal.company);
  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (value.trim() && value.trim() !== deal.company) {
            void rename({ id: deal._id, company: value.trim() });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setValue(deal.company);
            setEditing(false);
          }
        }}
        className="border border-[var(--color-accent)] rounded px-1.5 py-0.5 text-sm bg-white focus:outline-none w-40"
      />
    );
  }
  return (
    <span className="inline-flex items-center gap-1 group/name">
      <a
        href={
          deal.announcementTweetId
            ? `https://x.com/i/status/${deal.announcementTweetId}`
            : deal.sources[0]?.url
        }
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`hover:text-[var(--color-accent)] ${deal.status === "new" ? "font-semibold" : "font-medium"}`}
        title={deal.summary}
      >
        {deal.company}
        {deal.announcementTweetId && (
          <span className="ml-1 text-xs text-[var(--color-accent)]">𝕏</span>
        )}
      </a>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setValue(deal.company);
          setEditing(true);
        }}
        className="text-xs text-[var(--color-text-secondary)] opacity-0 group-hover/name:opacity-100 hover:text-[var(--color-accent)]"
        title="Fix the company name (updates dedup so future coverage merges correctly)"
      >
        ✎
      </button>
    </span>
  );
}

/**
 * AI deep-dive section of the expanded row: trigger button → live "researching"
 * state (status streams in reactively via deals.list) → rendered markdown
 * report. Backed by the deals.deepDive action (Claude + web search).
 */
function DeepDive({ deal }: { deal: Deal }) {
  const run = useAction(api.deals.deepDive);
  const [callError, setCallError] = useState<string | null>(null);
  const running = deal.deepDiveStatus === "running";

  const trigger = () => {
    setCallError(null);
    run({ id: deal._id }).catch((e) =>
      setCallError(e instanceof Error ? e.message : String(e)),
    );
  };

  const error = callError ?? (deal.deepDiveStatus === "error" ? deal.deepDiveError : null);

  return (
    <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
      {running ? (
        <p className="text-sm text-[var(--color-text-secondary)] animate-pulse">
          ✦ Researching {deal.company} — Claude is searching the web, this takes a
          minute or two…
        </p>
      ) : deal.deepDive ? (
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="gc-label">AI deep dive</span>
            {deal.deepDiveAt && (
              <span className="gc-num text-xs text-[var(--color-text-secondary)]">
                {new Date(deal.deepDiveAt).toLocaleString()}
              </span>
            )}
            <button
              onClick={trigger}
              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
              title="Re-run the research from scratch"
            >
              ↻ Refresh
            </button>
          </div>
          {error && <p className="text-xs text-[var(--gc-fault)] mb-2">{error}</p>}
          <div className="text-sm max-w-3xl">
            <Markdown content={deal.deepDive} math={false} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={trigger}
            className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 bg-white hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            ✦ AI deep dive
          </button>
          <span className="text-xs text-[var(--color-text-secondary)]">
            Claude researches the company, founders, round, and market via web
            search (~1–2 min).
          </span>
          {error && <span className="text-xs text-[var(--gc-fault)]">{error}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * The Deal Radar tab: consumer venture deals fused from RSS digests and X
 * announcements (convex/dealsFeed.ts), one row per (company, round). New
 * deals are accented until marked seen.
 */
/** The Sunday-rendered "WHO RAISED" newsletter block: preview + copy. */
function WeeklyBlock() {
  const block = useQuery(api.dealsBlock.latest);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!block) return null;
  const copy = () => {
    void navigator.clipboard.writeText(block.html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border border-[var(--color-border)] rounded bg-white mb-4">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          onClick={() => setOpen(!open)}
          className="gc-label text-left flex items-center gap-2"
        >
          <span>{open ? "▾" : "▸"}</span> Weekly newsletter block
        </button>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {block.dealCount} deals ·{" "}
          {new Date(block.generatedAt).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })}
        </span>
        <button
          onClick={copy}
          className="text-sm border border-[var(--color-border)] rounded px-3 py-1 bg-white hover:bg-[var(--color-border)]/30 ml-auto shrink-0"
        >
          {copied ? "Copied ✓" : "Copy HTML"}
        </button>
      </div>
      {open && (
        <div className="border-t border-[var(--color-border)] p-4 max-w-2xl">
          <div dangerouslySetInnerHTML={{ __html: block.html }} />
          <p className="text-xs text-[var(--color-text-secondary)] mt-2">
            Paste into an HTML-snippet block in the Beehiiv draft, or ask Claude
            to push it into the Weekly Signal template.
          </p>
        </div>
      )}
    </div>
  );
}

export function DealsFeed() {
  const [days, setDays] = useState(30);
  const deals = useQuery(api.deals.list, { days });
  const setStatus = useMutation(api.deals.setStatus);
  const markAllSeen = useMutation(api.deals.markAllSeen);

  const [consumerOnly, setConsumerOnly] = useState(true);
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [rounds, setRounds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showDismissed, setShowDismissed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => [...new Set((deals ?? []).map((d) => d.category))].sort(),
    [deals],
  );
  const roundOptions = useMemo(
    () => [...new Set((deals ?? []).map((d) => d.round))].sort(),
    [deals],
  );

  const rows = useMemo(() => {
    let list = deals ?? [];
    if (consumerOnly) list = list.filter((d) => d.isConsumer);
    if (!showDismissed) list = list.filter((d) => d.status !== "dismissed");
    if (categories.size > 0) list = list.filter((d) => categories.has(d.category));
    if (rounds.size > 0) list = list.filter((d) => rounds.has(d.round));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.company.toLowerCase().includes(q) ||
          d.summary.toLowerCase().includes(q) ||
          d.investors.some((i) => i.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [deals, consumerOnly, showDismissed, categories, rounds, search]);

  const newCount = rows.filter((d) => d.status === "new").length;

  if (deals === undefined) {
    return <p className="text-[var(--color-text-secondary)] text-sm">Loading…</p>;
  }

  return (
    <div>
      <WeeklyBlock />
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Venture deals detected from deal digests and X announcements, deduped
          across sources. Refreshes hourly.
        </p>
        {newCount > 0 && (
          <button
            onClick={() => void markAllSeen()}
            className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 bg-white hover:bg-[var(--color-border)]/30 ml-auto shrink-0"
          >
            Mark all seen ({newCount})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <input
          placeholder="Search company, investor, summary…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${field} w-72`}
        />
        <MultiSelect
          label="categories"
          options={categoryOptions}
          selected={categories}
          onChange={setCategories}
        />
        <MultiSelect
          label="rounds"
          options={roundOptions}
          selected={rounds}
          onChange={setRounds}
        />
        <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={consumerOnly}
            onChange={(e) => setConsumerOnly(e.target.checked)}
          />
          Consumer only
        </label>
        <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={(e) => setShowDismissed(e.target.checked)}
          />
          Show dismissed
        </label>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className={field}
        >
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={0}>All time</option>
        </select>
        <span className="gc-num text-xs text-[var(--color-text-secondary)] ml-auto">
          {rows.length} deals
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No deals match. The radar runs hourly — new consumer deals also push
          to Telegram.
        </p>
      ) : (
        <div className="border border-[var(--color-border)] rounded-lg bg-white overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className={th}>Company</th>
                <th className={th}>Round</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={th}>Lead</th>
                <th className={th}>Category</th>
                <th className={th}>Sources</th>
                <th className={th} title="Announcement date when stated in the source; otherwise the source's publish date">
                  Date
                </th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <Fragment key={d._id}>
                <tr
                  onClick={() => setExpanded((e) => (e === d._id ? null : d._id))}
                  className={`border-t border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg)] ${
                    d.status === "new"
                      ? "border-l-4 border-l-[var(--color-accent)]"
                      : d.status === "dismissed"
                        ? "opacity-40"
                        : ""
                  }`}
                >
                  <td className={`${td} max-w-xs`}>
                    <CompanyName deal={d} />
                    <div className="text-xs text-[var(--color-text-secondary)] truncate">
                      {d.summary}
                    </div>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{d.round}</td>
                  <td className={`${td} text-right gc-num font-medium whitespace-nowrap`}>
                    <span title={d.amountNote ?? undefined}>{fmtAmount(d)}</span>
                  </td>
                  <td className={`${td} max-w-40 truncate`} title={d.investors.join(", ")}>
                    {d.leadInvestor ?? (d.investors[0] ? `${d.investors[0]}…` : "—")}
                  </td>
                  <td className={td}>
                    <span className="gc-chip gc-chip-plain">{d.category}</span>
                  </td>
                  <td className={td}>
                    <span className="flex gap-1">
                      {d.sources.slice(0, 3).map((s, i) => (
                        <a
                          key={s.url}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--color-accent)] hover:underline"
                          title={s.name}
                        >
                          [{i + 1}]
                        </a>
                      ))}
                      {d.sources.length > 3 && (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          +{d.sources.length - 3}
                        </span>
                      )}
                    </span>
                  </td>
                  <td
                    className={`${td} gc-num text-xs text-[var(--color-text-secondary)] whitespace-nowrap`}
                    title={`first seen ${new Date(d.firstSeenAt).toLocaleString()}`}
                  >
                    {d.announcedAt != null
                      ? new Date(d.announcedAt).toLocaleDateString([], {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : new Date(d.firstSeenAt).toLocaleDateString([], {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {d.status === "new" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void setStatus({ id: d._id, status: "seen" });
                        }}
                        className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] mr-2"
                      >
                        Seen
                      </button>
                    )}
                    {d.status !== "dismissed" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void setStatus({ id: d._id, status: "dismissed" });
                        }}
                        className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--gc-fault)]"
                      >
                        ✕
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void setStatus({ id: d._id, status: "seen" });
                        }}
                        className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === d._id && (
                  <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="gc-label mb-1">
                            {d.company}
                          </div>
                          <p>{d.companyDesc ?? d.summary}</p>
                          {(d.founders?.length || d.hqCountry || d.website) && (
                            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                              {d.founders?.length ? (
                                <>
                                  {d.founders.map((f, i) => (
                                    <span key={f.name}>
                                      {i > 0 && ", "}
                                      {f.xHandle ? (
                                        <a
                                          href={`https://x.com/${f.xHandle}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-[var(--color-accent)] hover:underline"
                                        >
                                          {f.name} (@{f.xHandle})
                                        </a>
                                      ) : (
                                        f.name
                                      )}
                                    </span>
                                  ))}
                                </>
                              ) : null}
                              {d.hqCountry && (
                                <>{d.founders?.length ? " · " : ""}HQ: {d.hqCountry}</>
                              )}
                              {d.website && (
                                <>
                                  {" · "}
                                  <a
                                    href={d.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[var(--color-accent)] hover:underline"
                                  >
                                    {d.website.replace(/^https?:\/\/(www\.)?/, "")}
                                  </a>
                                </>
                              )}
                            </p>
                          )}
                          {(d.valuationUsd || d.totalRaisedUsd) && (
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              {d.valuationUsd
                                ? `Valuation $${(d.valuationUsd / 1e6).toFixed(0)}M`
                                : ""}
                              {d.valuationUsd && d.totalRaisedUsd ? " · " : ""}
                              {d.totalRaisedUsd
                                ? `Total raised $${(d.totalRaisedUsd / 1e6).toFixed(0)}M`
                                : ""}
                            </p>
                          )}
                        </div>
                        <div>
                          <div className="gc-label mb-1">
                            {d.leadInvestor ?? "Investors"}
                          </div>
                          <p>
                            {d.leadDesc ??
                              (d.leadInvestor
                                ? "No profile yet — fills in on the next radar cycle."
                                : "No lead identified.")}
                          </p>
                          {d.investors.length > 0 && (
                            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                              Round: {d.investors.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-4 mt-3 text-xs">
                        {d.sources.map((s) => (
                          <a
                            key={s.url}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[var(--color-accent)] hover:underline"
                          >
                            {s.name} ↗
                          </a>
                        ))}
                        {d.announcementTweetId && (
                          <a
                            href={`https://x.com/i/status/${d.announcementTweetId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[var(--color-accent)] hover:underline"
                          >
                            Announcement on X ↗
                          </a>
                        )}
                      </div>
                      <DeepDive deal={d} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
