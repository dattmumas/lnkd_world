"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type Deal = FunctionReturnType<typeof api.deals.list>[number];

const th = "text-left gc-label px-3 py-2 select-none";
const td = "px-3 py-2 text-sm";
const field =
  "border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

function fmtAmount(d: Deal): string {
  if (d.amountUsd == null) return "—";
  if (d.amountUsd >= 1_000_000_000) return `$${(d.amountUsd / 1_000_000_000).toFixed(1)}B`;
  if (d.amountUsd >= 1_000_000) return `$${Math.round(d.amountUsd / 1_000_000)}M`;
  return `$${Math.round(d.amountUsd / 1000)}K`;
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
 * The Deal Radar tab: consumer venture deals fused from RSS digests and X
 * announcements (convex/dealsFeed.ts), one row per (company, round). New
 * deals are accented until marked seen.
 */
export function DealsFeed() {
  const [days, setDays] = useState(30);
  const deals = useQuery(api.deals.list, { days });
  const setStatus = useMutation(api.deals.setStatus);
  const markAllSeen = useMutation(api.deals.markAllSeen);

  const [consumerOnly, setConsumerOnly] = useState(true);
  const [category, setCategory] = useState("all");
  const [round, setRound] = useState("all");
  const [search, setSearch] = useState("");
  const [showDismissed, setShowDismissed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set((deals ?? []).map((d) => d.category))].sort(),
    [deals],
  );
  const rounds = useMemo(
    () => [...new Set((deals ?? []).map((d) => d.round))].sort(),
    [deals],
  );

  const rows = useMemo(() => {
    let list = deals ?? [];
    if (consumerOnly) list = list.filter((d) => d.isConsumer);
    if (!showDismissed) list = list.filter((d) => d.status !== "dismissed");
    if (category !== "all") list = list.filter((d) => d.category === category);
    if (round !== "all") list = list.filter((d) => d.round === round);
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
  }, [deals, consumerOnly, showDismissed, category, round, search]);

  const newCount = rows.filter((d) => d.status === "new").length;

  if (deals === undefined) {
    return <p className="text-[var(--color-text-secondary)] text-sm">Loading…</p>;
  }

  return (
    <div>
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
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={round} onChange={(e) => setRound(e.target.value)} className={field}>
          <option value="all">All rounds</option>
          {rounds.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
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
