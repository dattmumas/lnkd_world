"use client";

import { motion } from "framer-motion";
import Panel, { Sparkline, ChangeBadge } from "./panel";

const INDICATOR_META: Record<string, { label: string; unit: string; color: string }> = {
  vix: { label: "VIX", unit: "", color: "#ff6b6b" },
  move_index: { label: "MOVE Index", unit: "", color: "#f97316" },
  breakeven_10y: { label: "10Y Breakeven", unit: "%", color: "#4a9eff" },
  breakeven_5y: { label: "5Y Breakeven", unit: "%", color: "#4a9eff" },
  fed_funds: { label: "Fed Funds", unit: "%", color: "#00ff88" },
  baa_spread: { label: "BAA Spread", unit: "bp", color: "#fbbf24" },
  consumer_sentiment: { label: "Consumer Sent.", unit: "", color: "#a855f7" },
  cpi: { label: "CPI", unit: "%", color: "#ec4899" },
  unemployment: { label: "Unemployment", unit: "%", color: "#94a3b8" },
};

const DISPLAY_ORDER = ["vix", "move_index", "fed_funds", "breakeven_10y", "baa_spread", "consumer_sentiment", "cpi", "unemployment", "breakeven_5y"];

export default function MacroPanel({
  macro,
}: {
  macro?: {
    indicators: Record<string, {
      current: number;
      change_1d: number;
      change_1w: number;
      change_1m: number;
      z_score: number;
      percentile_1y: number;
      sparkline: { date: string; value: number }[];
    }>;
    as_of: string;
  };
}) {
  if (!macro?.indicators) {
    return (
      <Panel title="Macro Indicators" accent="#fbbf24">
        <div className="text-[#94a3b8] font-mono text-sm text-center py-12">No macro data</div>
      </Panel>
    );
  }

  const keys = DISPLAY_ORDER.filter((k) => macro.indicators[k]);

  return (
    <Panel title="Macro Indicators" accent="#fbbf24">
      <div className="space-y-1.5">
        {keys.map((key, i) => {
          const ind = macro.indicators[key];
          const meta = INDICATOR_META[key] || { label: key, unit: "", color: "#94a3b8" };
          const zScore = ind.z_score ?? 0;
          const zColor = Math.abs(zScore) > 2 ? "#ff6b6b" : Math.abs(zScore) > 1 ? "#fbbf24" : "#00ff88";

          return (
            <motion.div
              key={key}
              className="flex items-center gap-3 bg-[#0f172a] rounded px-4 py-2.5"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="font-mono text-xs w-28 shrink-0" style={{ color: meta.color }}>
                {meta.label}
              </div>
              <div className="font-mono text-base text-[#f1f5f9] w-16 text-right shrink-0 font-medium">
                {ind.current != null ? ind.current.toFixed(meta.unit === "%" || meta.unit === "bp" ? 2 : 1) : "--"}
              </div>
              <div className="shrink-0 w-16">
                <ChangeBadge value={ind.change_1d} decimals={2} />
              </div>
              <div className="flex-1 min-w-0">
                <Sparkline data={ind.sparkline} width={100} height={28} color={meta.color} />
              </div>
              <div className="font-mono text-xs shrink-0 w-10 text-right" style={{ color: zColor }}>
                {zScore > 0 ? "+" : ""}{zScore.toFixed(1)}z
              </div>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
