"use client";

import { motion } from "framer-motion";
import Panel, { Sparkline, ChangeBadge } from "./panel";

const INDICATOR_META: Record<string, { label: string; unit: string; color: string }> = {
  vix: { label: "VIX", unit: "", color: "#d23b3b" },
  move_index: { label: "MOVE Index", unit: "", color: "#e3700f" },
  breakeven_10y: { label: "10Y Breakeven", unit: "%", color: "#2563eb" },
  breakeven_5y: { label: "5Y Breakeven", unit: "%", color: "#2563eb" },
  fed_funds: { label: "Fed Funds", unit: "%", color: "#0a8f57" },
  baa_spread: { label: "BAA Spread", unit: "bp", color: "#a86e15" },
  consumer_sentiment: { label: "Consumer Sent.", unit: "", color: "#0e9384" },
  cpi: { label: "CPI", unit: "%", color: "#d6307e" },
  unemployment: { label: "Unemployment", unit: "%", color: "#6e7682" },
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
      <Panel title="Macro Indicators" note="Key macro drivers with recent changes and their 1-year percentile (how high or low each reading is versus its own history)." accent="#a86e15">
        <div className="text-[#6e7682] font-mono text-sm text-center py-8">No macro data</div>
      </Panel>
    );
  }

  const keys = DISPLAY_ORDER.filter((k) => macro.indicators[k]);

  return (
    <Panel title="Macro Indicators" note="Key macro drivers with recent changes and their 1-year percentile (how high or low each reading is versus its own history)." accent="#a86e15">
      <div className="space-y-1.5">
        {keys.map((key, i) => {
          const ind = macro.indicators[key];
          const meta = INDICATOR_META[key] || { label: key, unit: "", color: "#6e7682" };
          const zScore = ind.z_score ?? 0;
          const zColor = Math.abs(zScore) > 2 ? "#d23b3b" : Math.abs(zScore) > 1 ? "#a86e15" : "#0a8f57";

          return (
            <motion.div
              key={key}
              className="flex items-center gap-3 bg-[#f6f7f9] rounded px-4 py-2.5"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="font-mono text-xs w-28 shrink-0 text-[#374151]">
                {meta.label}
              </div>
              <div className="font-mono text-base text-[#0f1115] w-16 text-right shrink-0 font-medium">
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
