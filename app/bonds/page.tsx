"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  type JSX,
} from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import TerminalHeader from "@/components/bonds/terminal-header";
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

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.5, ease: "easeOut" as const },
});

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

  const data = useMemo(() => {
    if (!snapshot?.data) return null;
    try {
      return JSON.parse(snapshot.data);
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
        status={data.status}
        errors={data.errors}
        canRefresh={isAdmin}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        refreshError={refreshError}
      />

      <main className="max-w-[1600px] mx-auto px-4 lg:px-6 pb-10 space-y-3 pt-3">
        {/* === ROW 1: Hero — Yield Curve + Regime (matched heights) === */}
        <div className="grid grid-cols-1 items-start lg:grid-cols-4 gap-3">
          <motion.div className="lg:col-span-3" {...fadeUp(0.05)}>
            <YieldCurvePanel yieldCurve={data.yield_curve} />
          </motion.div>
          <motion.div className="lg:col-span-1" {...fadeUp(0.1)}>
            <RegimeIndicator model={data.model} />
          </motion.div>
        </div>

        {/* === ROW 2: Signals + Trade Ideas (both tall — matched) === */}
        <div className="grid grid-cols-1 items-start lg:grid-cols-2 gap-3">
          <motion.div {...fadeUp(0.15)}>
            <SignalConsole signals={data.signals} />
          </motion.div>
          <motion.div {...fadeUp(0.2)}>
            <TradeIdeas signals={data.signals} />
          </motion.div>
        </div>

        {/* === ROW 3: Sentiment + Macro (both medium — matched) === */}
        <div className="grid grid-cols-1 items-start lg:grid-cols-2 gap-3">
          <motion.div {...fadeUp(0.25)}>
            <SentimentGauge sentiment={data.sentiment} />
          </motion.div>
          <motion.div {...fadeUp(0.3)}>
            <MacroPanel macro={data.macro} />
          </motion.div>
        </div>

        {/* === ROW 4: Credit + ETFs + Portfolio === */}
        <div className="grid grid-cols-1 items-start lg:grid-cols-3 gap-3">
          <motion.div {...fadeUp(0.35)}>
            <CreditPanel credit={data.credit} />
          </motion.div>
          <motion.div {...fadeUp(0.4)}>
            <EtfPanel etfs={data.etfs} />
          </motion.div>
          <motion.div {...fadeUp(0.45)}>
            <PortfolioPanel portfolio={data.portfolio} />
          </motion.div>
        </div>

        {/* === ROW 5: Calendar + Model Diagnostics === */}
        <div className="grid grid-cols-1 items-start lg:grid-cols-2 gap-3">
          <motion.div {...fadeUp(0.5)}>
            <CalendarPanel calendar={data.calendar} />
          </motion.div>
          <motion.div {...fadeUp(0.55)}>
            <ModelDiagnostics model={data.model} />
          </motion.div>
        </div>

        {/* === ROW 6: Investment Memo (full width) === */}
        <motion.div {...fadeUp(0.6)}>
          <MemoPanel signals={data.signals} />
        </motion.div>

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
