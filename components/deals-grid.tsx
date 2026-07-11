"use client";

import { useMemo, useState } from "react";
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
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

type Deal = FunctionReturnType<typeof api.deals.publicList>[number];

// The grid wears the ledger: paper, ink rules, mono headers, zero radius.
const ledgerTheme = themeQuartz.withParams({
  backgroundColor: "#F7F4EE",
  foregroundColor: "#141210",
  accentColor: "#C7331D",
  borderColor: "#DAD4C6",
  wrapperBorder: true,
  columnBorder: false,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  fontFamily: "Georgia, serif",
  fontSize: 13,
  headerBackgroundColor: "#EDE7DA",
  headerTextColor: "#141210",
  headerFontFamily: '"Space Mono", monospace',
  headerFontSize: 11,
  headerFontWeight: 700,
  oddRowBackgroundColor: "#F3F0E8",
  rowHoverColor: "#EDE7DA",
  spacing: 6,
});

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
              className="text-[var(--color-accent)] hover:underline"
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
      className="text-[var(--color-accent)] hover:underline"
    >
      {s.name} ↗
    </a>
  );
}

const COLUMNS: ColDef<Deal>[] = [
  {
    field: "company",
    headerName: "COMPANY",
    flex: 1.6,
    minWidth: 160,
    filter: true,
    tooltipValueGetter: (p) => p.data?.companyDesc ?? p.data?.summary,
    cellStyle: { fontWeight: 700 },
  },
  {
    field: "round",
    headerName: "ROUND",
    width: 110,
    filter: true,
    valueFormatter: (p) => (p.value === "unknown" ? "—" : String(p.value ?? "")),
  },
  {
    field: "amountUsd",
    headerName: "AMOUNT",
    width: 110,
    filter: "agNumberColumnFilter",
    valueFormatter: (p) => fmtUsd(p.value, p.data?.amountNote),
    type: "rightAligned",
  },
  { field: "category", headerName: "CATEGORY", width: 150, filter: true },
  {
    field: "leadInvestor",
    headerName: "LEAD",
    flex: 1.1,
    minWidth: 130,
    filter: true,
    tooltipValueGetter: (p) => p.data?.leadDesc,
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
    filter: true,
    valueFormatter: (p) => p.value ?? "—",
  },
  {
    field: "valuationUsd",
    headerName: "VALUATION",
    width: 115,
    filter: "agNumberColumnFilter",
    valueFormatter: (p) => fmtUsd(p.value),
    type: "rightAligned",
  },
  {
    field: "announcedAt",
    headerName: "DATE",
    width: 115,
    sort: "desc",
    filter: "agDateColumnFilter",
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

  const rows = useMemo(
    () => (deals ?? []).filter((d) => !consumerOnly || d.isConsumer),
    [deals, consumerOnly],
  );

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
        <AgGridReact<Deal>
          theme={ledgerTheme}
          rowData={rows}
          columnDefs={COLUMNS}
          quickFilterText={quick}
          pagination
          paginationPageSize={50}
          paginationPageSizeSelector={[50, 100, 200]}
          tooltipShowDelay={300}
          suppressCellFocus
          defaultColDef={{ resizable: true, sortable: true }}
        />
      </div>
    </div>
  );
}
