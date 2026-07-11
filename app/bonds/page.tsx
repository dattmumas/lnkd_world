"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
  type JSX,
  type ComponentProps,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TerminalHeader from "@/components/bonds/terminal-header";
import TabBar, { type TabBarItem } from "@/components/bonds/tab-bar";
import YieldCurvePanel from "@/components/bonds/yield-curve-panel";
import SignalConsole from "@/components/bonds/signal-console";
import MacroPanel from "@/components/bonds/macro-panel";
import CreditPanel from "@/components/bonds/credit-panel";
import EtfPanel from "@/components/bonds/etf-panel";
import TradeIdeas from "@/components/bonds/trade-ideas";
import PortfolioPanel from "@/components/bonds/portfolio-panel";
import CalendarPanel from "@/components/bonds/calendar-panel";
import MemoPanel from "@/components/bonds/memo-panel";
import RegimeIndicator from "@/components/bonds/regime-indicator";
import ModelDiagnostics from "@/components/bonds/model-diagnostics";
import SentimentGauge from "@/components/bonds/sentiment-gauge";

// Parsed dashboard snapshot. Slices are typed `unknown` at this boundary and
// cast when handed to each panel (each panel declares its own shape).
interface BondsData {
  yield_curve?: unknown;
  model?: unknown;
  signals?: unknown;
  macro?: unknown;
  credit?: unknown;
  etfs?: unknown;
  sentiment?: unknown;
  portfolio?: unknown;
  calendar?: unknown;
  generated_at?: string;
  status?: string;
  errors?: string[];
}

interface TabSpec extends TabBarItem {
  panels: {
    key: string;
    span?: "full";
    render: (data: BondsData) => JSX.Element;
  }[];
}

// Yield curve is a persistent hero above the tabs (it needs full width), so it
// is not in any tab. Panels tile in a fixed 2-col grid; `span: "full"` rows
// take the whole width (equal-height rows keep the tiling void-free).
const TABS: readonly TabSpec[] = [
  {
    id: "signals",
    label: "Signals & Ideas",
    panels: [
      { key: "signals", render: (d) => <SignalConsole signals={d.signals as ComponentProps<typeof SignalConsole>["signals"]} /> },
      { key: "trades", render: (d) => <TradeIdeas signals={d.signals as ComponentProps<typeof TradeIdeas>["signals"]} /> },
      { key: "memo", span: "full", render: (d) => <MemoPanel signals={d.signals as ComponentProps<typeof MemoPanel>["signals"]} /> },
    ],
  },
  {
    id: "model",
    label: "Model & Regime",
    panels: [
      { key: "regime", render: (d) => <RegimeIndicator model={d.model as ComponentProps<typeof RegimeIndicator>["model"]} /> },
      { key: "sentiment", render: (d) => <SentimentGauge sentiment={d.sentiment as ComponentProps<typeof SentimentGauge>["sentiment"]} /> },
      { key: "diagnostics", span: "full", render: (d) => <ModelDiagnostics model={d.model as ComponentProps<typeof ModelDiagnostics>["model"]} /> },
    ],
  },
  {
    id: "markets",
    label: "Markets",
    panels: [
      { key: "macro", render: (d) => <MacroPanel macro={d.macro as ComponentProps<typeof MacroPanel>["macro"]} /> },
      { key: "credit", render: (d) => <CreditPanel credit={d.credit as ComponentProps<typeof CreditPanel>["credit"]} /> },
      { key: "etfs", span: "full", render: (d) => <EtfPanel etfs={d.etfs as ComponentProps<typeof EtfPanel>["etfs"]} /> },
    ],
  },
  {
    id: "flows",
    label: "Flows & Calendar",
    panels: [
      { key: "portfolio", render: (d) => <PortfolioPanel portfolio={d.portfolio as ComponentProps<typeof PortfolioPanel>["portfolio"]} /> },
      { key: "calendar", render: (d) => <CalendarPanel calendar={d.calendar as ComponentProps<typeof CalendarPanel>["calendar"]} /> },
    ],
  },
];

const DEFAULT_TAB = "signals";

/** Tabbed + tiled body. Isolated so the `useSearchParams` call sits under Suspense. */
function BondsTabs({ data }: { data: BondsData }): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("view");
  const activeId = TABS.some((t) => t.id === raw) ? (raw as string) : DEFAULT_TAB;
  const activeTab = TABS.find((t) => t.id === activeId) ?? TABS[0];

  const onSelect = useCallback(
    (id: string): void => {
      const usp = new URLSearchParams(Array.from(params.entries()));
      usp.set("view", id);
      router.replace(`/bonds?${usp.toString()}`, { scroll: false });
    },
    [router, params]
  );

  return (
    <div>
      <TabBar tabs={TABS} activeId={activeId} onSelect={onSelect} />
      <div
        id={`panel-${activeId}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeId}`}
        className="grid lg:grid-cols-2 gap-px bg-[#000000]"
      >
        {activeTab.panels.map((p) => (
          <div key={p.key} className={`min-w-0 ${p.span === "full" ? "lg:col-span-2" : ""}`}>
            {p.render(data)}
          </div>
        ))}
      </div>
    </div>
  );
}

function TerminalLoading() {
  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-[#FB8B1E] text-lg mb-4 tracking-widest font-bold">
          LNKD BOND TERMINAL
        </div>
        <div className="font-mono text-[#FB8B1E] text-sm">
          Loading market data
          <span className="inline-block w-[7px] h-[13px] bg-[#FB8B1E] ml-1.5 align-middle animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function NoData() {
  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center">
      <div className="text-center font-mono max-w-md px-8">
        <div className="text-[#FF433D] text-xl mb-4">NO DATA AVAILABLE</div>
        <div className="text-[#F6F3E8] text-sm leading-relaxed">
          Dashboard snapshot has not been generated yet.
        </div>
        <code className="block mt-4 bg-[#000000] border border-[#2E2E2E] text-[#00C25B] text-sm p-4">
          python -m src.export_dashboard --push
        </code>
        <Link href="/" className="inline-block mt-8 text-[#54A8FF] text-sm hover:underline">
          &larr; Back to LNKD
        </Link>
      </div>
    </div>
  );
}

export default function BondsPage(): JSX.Element {
  const snapshot = useQuery(api.bonds.latest);
  const user = useQuery(api.users.currentUser);
  // Admin-gated in production; always shown in local dev so the control is visible
  // while previewing (the Convex action still enforces admin on the server).
  const isAdmin =
    user?.role === "admin" || process.env.NODE_ENV === "development";

  const triggerRefresh = useAction(api.bonds.triggerRefresh);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // generatedAt captured at click time; refresh is "done" once a newer one lands.
  const pendingFromRef = useRef<string | null>(null);

  const data = useMemo((): BondsData | null => {
    if (!snapshot?.data) return null;
    try {
      return JSON.parse(snapshot.data) as BondsData;
    } catch {
      return null;
    }
  }, [snapshot?.data]);

  const currentGeneratedAt: string | undefined =
    data?.generated_at ?? snapshot?.generatedAt;

  const handleRefresh = useCallback(async (): Promise<void> => {
    setRefreshError(null);
    setRefreshing(true);
    pendingFromRef.current = currentGeneratedAt ?? null;
    try {
      await triggerRefresh({});
    } catch (e) {
      setRefreshing(false);
      setRefreshError(e instanceof Error ? e.message : "Refresh failed");
    }
  }, [triggerRefresh, currentGeneratedAt]);

  // Clear the spinner once a newer snapshot arrives.
  useEffect(() => {
    if (!refreshing) return;
    if (
      currentGeneratedAt &&
      pendingFromRef.current &&
      currentGeneratedAt !== pendingFromRef.current
    ) {
      setRefreshing(false);
    }
  }, [currentGeneratedAt, refreshing]);

  // Safety valve: the workflow runs a few minutes; stop spinning after 8.
  useEffect(() => {
    if (!refreshing) return;
    const id = setTimeout(() => {
      setRefreshing(false);
      setRefreshError(
        "Still running — the build can take a few minutes. The page will update on its own when it finishes."
      );
    }, 8 * 60 * 1000);
    return () => clearTimeout(id);
  }, [refreshing]);

  if (snapshot === undefined) return <TerminalLoading />;
  if (!snapshot || !data) return <NoData />;

  return (
    <div className="min-h-screen bg-[#000000] text-[#F6F3E8]">
      <TerminalHeader
        generatedAt={data.generated_at || snapshot.generatedAt}
        status={data.status ?? snapshot.status}
        errors={data.errors}
        canRefresh={isAdmin}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        refreshError={refreshError}
      />

      <main className="w-full px-1 pb-6">
        {/* Persistent full-width hero — never enters a grid column */}
        <YieldCurvePanel
          yieldCurve={
            data.yield_curve as ComponentProps<typeof YieldCurvePanel>["yieldCurve"]
          }
        />

        {/* Tabbed + tiled body (Suspense required by useSearchParams) */}
        <Suspense fallback={<div className="h-8" />}>
          <BondsTabs data={data} />
        </Suspense>

        {/* Footer */}
        <div className="mt-1 border-t border-[#2E2E2E] px-1 py-1.5 flex flex-col sm:flex-row items-center justify-between gap-1 font-mono text-[11px] text-[#FB8B1E]">
          <div>
            LNKD BOND TERMINAL &middot; FRED &middot; Treasury.gov &middot; yfinance &middot;{" "}
            <Link href="/" className="text-[#54A8FF] hover:underline">
              lnkd.world
            </Link>
          </div>
          <div>
            Updated {new Date(data.generated_at || snapshot.generatedAt).toLocaleString()}
          </div>
        </div>
      </main>
    </div>
  );
}
