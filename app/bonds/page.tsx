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
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
        <div className="font-mono text-[#00ff88] text-lg mb-6 tracking-widest">
          LNKD BOND TERMINAL
        </div>
        <div className="flex gap-1.5 justify-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-10 bg-[#00ff88] rounded-sm"
              animate={{ scaleY: [0.3, 1, 0.3], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
        <motion.div
          className="font-mono text-[#94a3b8] text-sm mt-6"
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
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
      <div className="text-center font-mono max-w-md px-8">
        <div className="text-[#ff6b6b] text-xl mb-4">NO DATA AVAILABLE</div>
        <div className="text-[#cbd5e1] text-sm leading-relaxed">
          Dashboard snapshot has not been generated yet.
        </div>
        <code className="block mt-4 bg-[#111827] text-[#00ff88] text-sm p-4 rounded">
          python -m src.export_dashboard --push
        </code>
        <Link href="/" className="inline-block mt-8 text-[#4a9eff] text-sm hover:underline">
          &larr; Back to LNKD
        </Link>
      </div>
    </div>
  );
}

export default function BondsPage(): JSX.Element {
  const snapshot = useQuery(api.bonds.latest);
  const user = useQuery(api.users.currentUser);
  const isAdmin = user?.role === "admin";

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
    <div className="min-h-screen bg-[#0a0e17] text-[#e2e8f0]">
      <TerminalHeader
        generatedAt={data.generated_at || snapshot.generatedAt}
        status={data.status}
        errors={data.errors}
        canRefresh={isAdmin}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        refreshError={refreshError}
      />

      <main className="max-w-[1600px] mx-auto px-6 lg:px-8 pb-12 space-y-5 pt-5">
        {/* === ROW 1: Hero row — Yield Curve (star of the show) + Regime sidebar === */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <motion.div className="lg:col-span-3" {...fadeUp(0.1)}>
            <YieldCurvePanel yieldCurve={data.yield_curve} />
          </motion.div>
          <motion.div className="lg:col-span-1 space-y-5" {...fadeUp(0.2)}>
            <RegimeIndicator model={data.model} />
            <SentimentGauge sentiment={data.sentiment} />
          </motion.div>
        </div>

        {/* === ROW 2: Signals + Trade Ideas === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <motion.div {...fadeUp(0.3)}>
            <SignalConsole signals={data.signals} />
          </motion.div>
          <motion.div {...fadeUp(0.4)}>
            <TradeIdeas signals={data.signals} />
          </motion.div>
        </div>

        {/* === ROW 3: Macro + Credit === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <motion.div {...fadeUp(0.5)}>
            <MacroPanel macro={data.macro} />
          </motion.div>
          <motion.div {...fadeUp(0.6)}>
            <CreditPanel credit={data.credit} />
          </motion.div>
        </div>

        {/* === ROW 4: ETFs + Portfolio + Calendar === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <motion.div {...fadeUp(0.7)}>
            <EtfPanel etfs={data.etfs} />
          </motion.div>
          <motion.div {...fadeUp(0.8)}>
            <PortfolioPanel portfolio={data.portfolio} />
          </motion.div>
          <motion.div {...fadeUp(0.9)}>
            <CalendarPanel calendar={data.calendar} />
          </motion.div>
        </div>

        {/* === ROW 5: Model + Memo === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <motion.div {...fadeUp(1.0)}>
            <ModelDiagnostics model={data.model} />
          </motion.div>
          <motion.div className="lg:col-span-2" {...fadeUp(1.1)}>
            <MemoPanel signals={data.signals} />
          </motion.div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-[#1e293b] flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-sm text-[#94a3b8]">
          <div>
            LNKD BOND TERMINAL &middot; FRED &middot; Treasury.gov &middot; yfinance &middot;{" "}
            <Link href="/" className="text-[#4a9eff] hover:underline">
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
