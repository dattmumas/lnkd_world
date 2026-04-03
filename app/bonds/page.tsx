"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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

function TerminalLoading() {
  return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center"
      >
        <div className="font-mono text-[#00ff88] text-sm mb-4">
          LNKD BOND TERMINAL v1.0
        </div>
        <div className="flex gap-1 justify-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-8 bg-[#00ff88]"
              animate={{
                scaleY: [0.3, 1, 0.3],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
        <motion.div
          className="font-mono text-[#4a5568] text-xs mt-4"
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
      <div className="text-center font-mono">
        <div className="text-[#ff6b6b] text-lg mb-2">NO DATA AVAILABLE</div>
        <div className="text-[#4a5568] text-sm">
          Dashboard snapshot has not been generated yet.
          <br />
          Run:{" "}
          <code className="text-[#00ff88]">
            python -m src.export_dashboard --push
          </code>
        </div>
        <Link
          href="/"
          className="inline-block mt-6 text-[#4a9eff] text-sm hover:underline"
        >
          Back to LNKD
        </Link>
      </div>
    </div>
  );
}

export default function BondsPage() {
  const snapshot = useQuery(api.bonds.latest);

  const data = useMemo(() => {
    if (!snapshot?.data) return null;
    try {
      return JSON.parse(snapshot.data);
    } catch {
      return null;
    }
  }, [snapshot?.data]);

  if (snapshot === undefined) return <TerminalLoading />;
  if (!snapshot || !data) return <NoData />;

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e2e8f0] overflow-x-hidden">
      {/* Terminal Header */}
      <TerminalHeader
        generatedAt={data.generated_at || snapshot.generatedAt}
        status={data.status}
        errors={data.errors}
      />

      {/* Main Grid */}
      <main className="max-w-[1920px] mx-auto px-3 pb-8">
        {/* Row 1: Regime + Yield Curve + Sentiment */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <RegimeIndicator model={data.model} />
          </motion.div>
          <motion.div
            className="lg:col-span-7"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <YieldCurvePanel yieldCurve={data.yield_curve} />
          </motion.div>
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SentimentGauge sentiment={data.sentiment} />
          </motion.div>
        </div>

        {/* Row 2: Signals + Trade Ideas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
          <motion.div
            className="lg:col-span-7"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <SignalConsole signals={data.signals} />
          </motion.div>
          <motion.div
            className="lg:col-span-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <TradeIdeas signals={data.signals} />
          </motion.div>
        </div>

        {/* Row 3: Macro + Credit + Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
          <motion.div
            className="lg:col-span-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <MacroPanel macro={data.macro} />
          </motion.div>
          <motion.div
            className="lg:col-span-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <CreditPanel credit={data.credit} />
          </motion.div>
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <CalendarPanel calendar={data.calendar} />
          </motion.div>
        </div>

        {/* Row 4: ETFs + Portfolio + Model */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
          <motion.div
            className="lg:col-span-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <EtfPanel etfs={data.etfs} />
          </motion.div>
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <PortfolioPanel portfolio={data.portfolio} />
          </motion.div>
          <motion.div
            className="lg:col-span-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
          >
            <ModelDiagnostics model={data.model} />
          </motion.div>
        </div>

        {/* Row 5: Investment Memo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <MemoPanel signals={data.signals} />
        </motion.div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#1e293b] flex items-center justify-between font-mono text-xs text-[#4a5568]">
          <div>
            LNKD BOND TERMINAL | Data: FRED, Treasury.gov, yfinance |{" "}
            <Link href="/" className="text-[#4a9eff] hover:underline">
              lnkd.world
            </Link>
          </div>
          <div>
            {data.data_quality?.warnings?.length > 0 && (
              <span className="text-[#fbbf24] mr-4">
                {data.data_quality.warnings.length} data warnings
              </span>
            )}
            Updated {new Date(data.generated_at || snapshot.generatedAt).toLocaleString()}
          </div>
        </div>
      </main>
    </div>
  );
}
