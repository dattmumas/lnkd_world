"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type RowClickedEvent,
  type IsFullWidthRowParams,
  type RowHeightParams,
  type PostSortRowsParams,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

type Deal = FunctionReturnType<typeof api.deals.publicList>[number];

// Master/detail is AG-Grid enterprise; community gets the same effect with a
// synthetic full-width row injected under the clicked deal.
type GridRow = Deal | { detailFor: Deal };

function isDetail(row: GridRow): row is { detailFor: Deal } {
  return "detailFor" in row;
}

// The grid wears the ledger: paper, ink rules, mono headers, zero radius.
const ledgerTheme = themeQuartz.withParams({
  backgroundColor: "#F3F0E9",
  foregroundColor: "#141210",
  accentColor: "#C7331D",
  borderColor: "#DAD4C6",
  wrapperBorder: true,
  columnBorder: false,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  fontFamily: "Georgia, serif",
  fontSize: 13,
  headerBackgroundColor: "#E8E3D7",
  headerTextColor: "#141210",
  headerFontFamily: '"Space Mono", monospace',
  headerFontSize: 11,
  headerFontWeight: 700,
  oddRowBackgroundColor: "#EFEBE2",
  rowHoverColor: "#E8E3D7",
  spacing: 6,
});

/** Ledger-styled multi-select: mono chip, ink dropdown, counts per option. */
function LedgerMultiSelect({
  label,
  options,
  selected,
  onChange,
  format = (v) => v.toUpperCase(),
}: {
  label: string;
  options: { value: string; count: number }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  format?: (v: string) => string;
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

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };

  const summary =
    selected.size === 0
      ? label
      : selected.size === 1
        ? format([...selected][0])
        : `${label} ×${selected.size}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`ol-mono text-xs font-bold uppercase bg-transparent border-2 px-3 py-2 flex items-center gap-2 ${
          selected.size > 0
            ? "border-[var(--color-border)] bg-[var(--color-border)] text-[var(--color-bg)]"
            : "border-[var(--color-border)]"
        }`}
      >
        <span className="max-w-40 truncate">{summary}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 min-w-full w-max max-h-80 overflow-y-auto border-2 border-[var(--color-border)] bg-[var(--color-bg)] ol-panel">
          {selected.size > 0 && (
            <button
              onClick={() => onChange(new Set())}
              className="w-full text-left ol-mono text-[11px] font-bold uppercase px-3 py-2 hover:text-[var(--color-accent)] border-b border-dashed border-[var(--color-border)] hover:bg-[var(--color-fill-tan)]"
            >
              Clear ×{selected.size}
            </button>
          )}
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-baseline gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--color-fill-tan)] whitespace-nowrap"
            >
              <input
                type="checkbox"
                checked={selected.has(o.value)}
                onChange={() => toggle(o.value)}
                className="accent-[var(--color-accent)] translate-y-px"
              />
              <span className="ol-mono text-xs font-bold">{format(o.value)}</span>
              <span className="ol-mono text-[10px] text-[var(--color-text-secondary)] ml-auto pl-3">
                {o.count}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtUsd(n: number | null | undefined, note?: string): string {
  if (note) return note;
  if (!n) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${Math.round(n / 1000)}K`;
}

function FoundersCell({ data }: ICellRendererParams<Deal>) {
  if (!data?.founders?.length) return null;
  return (
    <span>
      {data.founders.map((f, i) => (
        <span key={f.name}>
          {i > 0 && ", "}
          {f.xHandle ? (
            <a
              href={`https://x.com/${f.xHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 decoration-[var(--color-stone)] hover:text-[var(--color-accent)]"
            >
              {f.name}
            </a>
          ) : (
            f.name
          )}
        </span>
      ))}
    </span>
  );
}

function SourceCell({ data }: ICellRendererParams<Deal>) {
  const s = data?.sources[0];
  if (!s) return null;
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 decoration-[var(--color-stone)] hover:text-[var(--color-accent)]"
    >
      {s.name} ↗
    </a>
  );
}

/** The expanded ledger entry under a clicked row. */
function DetailRow({ data }: ICellRendererParams<GridRow>) {
  if (!data || !isDetail(data)) return null;
  const d = data.detailFor;
  return (
    <div className="h-full px-5 py-3 border-l-4 border-[var(--color-border)] bg-[var(--color-fill-tan)] overflow-y-auto text-[13px] leading-relaxed">
      <div className="grid md:grid-cols-2 gap-x-8 gap-y-1">
        <div>
          <p className="ol-mono text-[10px] font-bold uppercase text-[var(--color-text-secondary)]">
            {d.company}
          </p>
          <p>{d.companyDesc ?? d.summary}</p>
          {(d.totalRaisedUsd || d.website) && (
            <p className="ol-mono text-[11px] text-[var(--color-text-secondary)] mt-1">
              {d.totalRaisedUsd
                ? `TOTAL RAISED ${fmtUsd(d.totalRaisedUsd)}`
                : ""}
              {d.totalRaisedUsd && d.website ? " · " : ""}
              {d.website && (
                <a
                  href={d.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 decoration-[var(--color-stone)] hover:text-[var(--color-accent)]"
                >
                  {d.website.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              )}
            </p>
          )}
        </div>
        <div>
          <p className="ol-mono text-[10px] font-bold uppercase text-[var(--color-text-secondary)]">
            {d.leadInvestor ?? "Investors"}
          </p>
          <p>
            {d.leadDesc ??
              (d.leadInvestor ? "No profile on file for this lead yet." : "No lead identified.")}
          </p>
          {d.investors.length > 0 && (
            <p className="ol-mono text-[11px] text-[var(--color-text-secondary)] mt-1">
              ROUND: {d.investors.join(", ")}
            </p>
          )}
        </div>
      </div>
      <p className="ol-mono text-[11px] mt-2">
        {d.sources.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 decoration-[var(--color-stone)] hover:text-[var(--color-accent)] mr-4"
          >
            {s.name} ↗
          </a>
        ))}
      </p>
    </div>
  );
}

const COLUMNS: ColDef<Deal>[] = [
  {
    field: "company",
    headerName: "COMPANY",
    flex: 1.6,
    minWidth: 160,
    tooltipValueGetter: (p) => p.data?.companyDesc ?? p.data?.summary,
    cellStyle: { fontWeight: 700 },
  },
  {
    field: "round",
    headerName: "ROUND",
    width: 110,
    valueFormatter: (p) => (p.value === "unknown" ? "—" : String(p.value ?? "")),
  },
  {
    field: "amountUsd",
    headerName: "AMOUNT",
    width: 110,
    valueFormatter: (p) => fmtUsd(p.value, p.data?.amountNote),
    type: "rightAligned",
  },
  { field: "category", headerName: "CATEGORY", width: 150 },
  {
    colId: "leadInvestor",
    headerName: "LEAD",
    flex: 1.1,
    minWidth: 130,
    tooltipValueGetter: (p) => p.data?.leadDesc,
    // No lead identified ≠ no investors — fall back to the first participant.
    valueGetter: (p) => {
      const d = p.data;
      if (!d) return null;
      if (d.leadInvestor) return d.leadInvestor;
      if (d.investors?.length) {
        const extra = d.investors.length - 1;
        return `${d.investors[0]}${extra > 0 ? ` +${extra}` : ""}`;
      }
      return null;
    },
    valueFormatter: (p) => p.value ?? "—",
  },
  {
    field: "founders",
    headerName: "FOUNDERS",
    flex: 1.2,
    minWidth: 140,
    sortable: false,
    cellRenderer: FoundersCell,
  },
  {
    field: "hqCountry",
    headerName: "HQ",
    width: 90,
    valueFormatter: (p) => p.value ?? "—",
  },
  {
    field: "valuationUsd",
    headerName: "VALUATION",
    width: 115,
    valueFormatter: (p) => fmtUsd(p.value),
    type: "rightAligned",
  },
  {
    field: "announcedAt",
    headerName: "DATE",
    width: 115,
    sort: "desc",
    valueFormatter: (p) =>
      p.value
        ? new Date(p.value).toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: "2-digit",
          })
        : "—",
  },
  {
    field: "sources",
    headerName: "SOURCE",
    width: 150,
    sortable: false,
    cellRenderer: SourceCell,
  },
];

export default function DealsGrid() {
  const deals = useQuery(api.deals.publicList);
  const [quick, setQuick] = useState("");
  const [consumerOnly, setConsumerOnly] = useState(false);
  const [rounds, setRounds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [hqs, setHqs] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const ROUND_ORDER = [
    "pre-seed", "seed", "series-a", "series-b", "series-c", "series-d",
    "series-e", "growth", "unknown",
  ];
  const count = (vals: (string | undefined | null)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  const roundOptions = useMemo(() => {
    const m = count((deals ?? []).map((d) => d.round));
    return ROUND_ORDER.filter((r) => m.has(r)).map((r) => ({
      value: r,
      count: m.get(r)!,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals]);
  const categoryOptions = useMemo(() => {
    const m = count((deals ?? []).map((d) => d.category));
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, c]) => ({ value, count: c }));
  }, [deals]);
  const hqOptions = useMemo(() => {
    const m = count((deals ?? []).map((d) => d.hqCountry));
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, c]) => ({ value, count: c }));
  }, [deals]);

  const rows = useMemo<GridRow[]>(() => {
    const out: GridRow[] = [];
    for (const d of deals ?? []) {
      if (consumerOnly && !d.isConsumer) continue;
      if (rounds.size > 0 && !rounds.has(d.round)) continue;
      if (categories.size > 0 && !categories.has(d.category)) continue;
      if (hqs.size > 0 && !(d.hqCountry && hqs.has(d.hqCountry))) continue;
      out.push(d);
      if (expanded.has(d.id)) out.push({ detailFor: d });
    }
    return out;
  }, [deals, consumerOnly, rounds, categories, hqs, expanded]);

  const onRowClicked = (e: RowClickedEvent<GridRow>) => {
    if (!e.data || isDetail(e.data)) return;
    // Links inside cells (founders, sources) shouldn't toggle the row.
    if ((e.event?.target as Element | null)?.closest("a")) return;
    const id = e.data.id;
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-3">
        <input
          type="search"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="SEARCH THE LEDGER…"
          className="ol-mono text-xs font-bold uppercase bg-transparent border-2 border-[var(--color-border)] px-3 py-2 w-64 max-w-full placeholder:text-[var(--color-leader)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        <LedgerMultiSelect
          label="Round"
          options={roundOptions}
          selected={rounds}
          onChange={setRounds}
          format={(v) => (v === "unknown" ? "UNSTATED" : v.replace("-", " ").toUpperCase())}
        />
        <LedgerMultiSelect
          label="Category"
          options={categoryOptions}
          selected={categories}
          onChange={setCategories}
        />
        <LedgerMultiSelect
          label="HQ"
          options={hqOptions}
          selected={hqs}
          onChange={setHqs}
        />
        <label className="ol-mono text-xs font-bold uppercase flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={consumerOnly}
            onChange={(e) => setConsumerOnly(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Consumer only
        </label>
        <span className="ol-mono text-xs text-[var(--color-text-secondary)] ml-auto">
          {deals === undefined ? "LOADING…" : `${rows.length} ENTRIES`}
        </span>
      </div>
      <div style={{ height: "max(500px, calc(100vh - 320px))" }}>
        <AgGridReact<GridRow>
          theme={ledgerTheme}
          rowData={rows}
          columnDefs={COLUMNS as ColDef<GridRow>[]}
          getRowId={(p) => (isDetail(p.data) ? `detail-${p.data.detailFor.id}` : p.data.id)}
          quickFilterText={quick}
          pagination
          paginationPageSize={50}
          paginationPageSizeSelector={[50, 100, 200]}
          tooltipShowDelay={300}
          suppressCellFocus
          defaultColDef={{ resizable: true, sortable: true }}
          onRowClicked={onRowClicked}
          isFullWidthRow={(p: IsFullWidthRowParams<GridRow>) => isDetail(p.rowNode.data!)}
          fullWidthCellRenderer={DetailRow}
          getRowHeight={(p: RowHeightParams<GridRow>) =>
            p.data && isDetail(p.data) ? 170 : undefined
          }
          postSortRows={(params: PostSortRowsParams<GridRow>) => {
            // Detail rows have no column values, so sorting strands them at
            // the end — re-seat each one directly under its parent.
            const nodes = params.nodes;
            const details = new Map<string, (typeof nodes)[number]>();
            for (let i = nodes.length - 1; i >= 0; i--) {
              const d = nodes[i].data;
              if (d && isDetail(d)) {
                details.set(d.detailFor.id, nodes[i]);
                nodes.splice(i, 1);
              }
            }
            if (details.size === 0) return;
            for (let i = 0; i < nodes.length; i++) {
              const d = nodes[i].data;
              if (d && !isDetail(d) && details.has(d.id)) {
                nodes.splice(i + 1, 0, details.get(d.id)!);
                i++;
              }
            }
          }}
        />
      </div>
      <p className="ol-mono text-[10px] text-[var(--color-text-secondary)] mt-2 uppercase">
        Click a row for the full entry
      </p>
    </div>
  );
}
