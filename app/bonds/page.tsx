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
import { motion, AnimatePresence } from "framer-motion";
import TerminalHeader from "@/components/bonds/terminal-header";
import TabBar, { type TabBarItem } from "@/components/bonds/tab-bar";
import { Masonry, MasonryItem, fadeUp } from "@/components/bonds/masonry";
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
  panels: { key: string; render: (data: BondsData) => JSX.Element }[];
}

// Yield curve is a persistent hero above the tabs (it needs full width), so it
// is not in any tab. Panels are listed tall-first for tidier column packing.
const TABS: readonly TabSpec[] = [
  {
    id: "signals",
    label: "Signals & Ideas",
    panels: [
      { key: "signals", render: (d) => <SignalConsole signals={d.signals as ComponentProps<typeof SignalConsole>["signals"]} /> },
      { key: "trades", render: (d) => <TradeIdeas signals={d.signals as ComponentProps<typeof TradeIdeas>["signals"]} /> },
      { key: "memo", render: (d) => <MemoPanel signals={d.signals as ComponentProps<typeof MemoPanel>["signals"]} /> },
    ],
  },
  {
    id: "model",
    label: "Model & Regime",
    panels: [
      { key: "regime", render: (d) => <RegimeIndicator model={d.model as ComponentProps<typeof RegimeIndicator>["model"]} /> },
      { key: "diagnostics", render: (d) => <ModelDiagnostics model={d.model as ComponentProps<typeof ModelDiagnostics>["model"]} /> },
      { key: "sentiment", render: (d) => <SentimentGauge sentiment={d.sentiment as ComponentProps<typeof SentimentGauge>["sentiment"]} /> },
    ],
  },
  {
    id: "markets",
    label: "Markets",
    panels: [
      { key: "macro", render: (d) => <MacroPanel macro={d.macro as ComponentProps<typeof MacroPanel>["macro"]} /> },
      { key: "credit", render: (d) => <CreditPanel credit={d.credit as ComponentProps<typeof CreditPanel>["credit"]} /> },
      { key: "etfs", render: (d) => <EtfPanel etfs={d.etfs as ComponentProps<typeof EtfPanel>["etfs"]} /> },
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

/** Tabbed + masonry body. Isolated so the `useSearchParams` call sits under Suspense. */
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
    <div className="space-y-3">
      <TabBar tabs={TABS} activeId={activeId} onSelect={onSelect} />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeId}
          id={`panel-${activeId}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeId}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Masonry>
            {activeTab.panels.map((p, i) => (
              <MasonryItem key={p.key} delay={0.04 * i}>
                {p.render(data)}
              </MasonryItem>
            ))}
          </Masonry>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TerminalLoading() {
  return (
    <div className="min-h-screen bg-[#ffffff] flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
        <div className="font-mono text-[#0a8f57] text-lg mb-6 tracking-widest">
          LNKD BOND TERMINAL
        </div>
        <div className="flex gap-1.5 justify-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-10 bg-[#0a8f57] rounded-sm"
              animate={{ scaleY: [0.3, 1, 0.3], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
        <motion.div
          className="font-mono text-[#6e7682] text-sm mt-6"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Loading market data...
        </motion.div>
      </motion.div>
    </div>
  );
}

function NoData() {
  return (
    <div className="min-h-screen bg-[#ffffff] flex items-center justify-center">
      <div className="text-center font-mono max-w-md px-8">
        <div className="text-[#d23b3b] text-xl mb-4">NO DATA AVAILABLE</div>
        <div className="text-[#374151] text-sm leading-relaxed">
          Dashboard snapshot has not been generated yet.
        </div>
        <code className="block mt-4 bg-[#ffffff] text-[#0a8f57] text-sm p-4 rounded">
          python -m src.export_dashboard --push
        </code>
        <Link href="/" className="inline-block mt-8 text-[#2563eb] text-sm hover:underline">
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
    <div className="min-h-screen bg-[#ffffff] text-[#1f2937]">
      <TerminalHeader
        generatedAt={data.generated_at || snapshot.generatedAt}
        status={data.status ?? snapshot.status}
        errors={data.errors}
        canRefresh={isAdmin}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        refreshError={refreshError}
      />

      <main className="max-w-[1600px] mx-auto px-4 lg:px-6 pb-10 space-y-3 pt-3">
        {/* Persistent full-width hero — never enters a narrow masonry column */}
        <motion.div {...fadeUp(0.05)}>
          <YieldCurvePanel
            yieldCurve={
              data.yield_curve as ComponentProps<typeof YieldCurvePanel>["yieldCurve"]
            }
          />
        </motion.div>

        {/* Tabbed + masonry body (Suspense required by useSearchParams) */}
        <Suspense fallback={<div className="h-10" />}>
          <BondsTabs data={data} />
        </Suspense>

        {/* Footer */}
        <div className="pt-4 border-t border-[#e8eaee] flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-sm text-[#6e7682]">
          <div>
            LNKD BOND TERMINAL &middot; FRED &middot; Treasury.gov &middot; yfinance &middot;{" "}
            <Link href="/" className="text-[#2563eb] hover:underline">
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
