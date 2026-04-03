"use client";

import { motion } from "framer-motion";
import Panel, { Sparkline, ChangeBadge } from "./panel";

const INDICATOR_META: Record<string, { label: string; format: string; color: string }> = {
  vix: { label: "VIX", format: "", color: "#ff6b6b" },
  move_index: { label: "MOVE", format: "", color: "#f97316" },
  breakeven_10y: { label: "10Y BEI", format: "%", color: "#4a9eff" },
  breakeven_5y: { label: "5Y BEI", format: "%", color: "#4a9eff" },
  fed_funds: { label: "FED FUNDS", format: "%", color: "#00ff88" },
  baa_spread: { label: "BAA SPR", format: "bp", color: "#fbbf24" },
  consumer_sentiment: { label: "CONSUMER", format: "", color: "#a855f7" },
  cpi: { label: "CPI", format: "%", color: "#ec4899" },
  unemployment: { label: "UNEMP", format: "%", color: "#4a5568" },
};

export default function MacroPanel({
  macro,
}: {
  macro?: {
    indicators: Record<
      string,
      {
        current: number;
        change_1d: number;
        change_1w: number;
        change_1m: number;
        z_score: number;
        percentile_1y: number;
        sparkline: { date: string; value: number }[];
      }
    >;
    as_of: string;
  };
}) {
  if (!macro?.indicators) {
    return (
      <Panel title="Macro Indicators" accent="#fbbf24">
        <div className="text-[#4a5568] font-mono text-xs text-center py-8">
          No macro data
        </div>
      </Panel>
    );
  }

  // Priority order for display
  const displayOrder = [
    "vix",
    "move_index",
    "fed_funds",
    "breakeven_10y",
    "baa_spread",
    "consumer_sentiment",
    "cpi",
    "unemployment",
    "breakeven_5y",
  ];

  const keys = displayOrder.filter((k) => macro.indicators[k]);

  return (
    <Panel title="Macro Indicators" accent="#fbbf24">
      <div className="space-y-1">
        {keys.map((key, i) => {
          const ind = macro.indicators[key];
          const meta = INDICATOR_META[key] || { label: key, format: "", color: "#4a5568" };

          // Z-score bar
          const zScore = ind.z_score ?? 0;
          const zColor =
            Math.abs(zScore) > 2
              ? "#ff6b6b"
              : Math.abs(zScore) > 1
                ? "#fbbf24"
                : "#00ff88";

          return (
            <motion.div
              key={key}
              className="flex items-center gap-2 bg-[#0f172a] rounded-sm px-2 py-1.5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                className="font-mono text-[10px] w-16 shrink-0 uppercase"
                style={{ color: meta.color }}
              >
                {meta.label}
              </div>
              <div className="font-mono text-[11px] text-[#e2e8f0] w-14 text-right shrink-0">
                {ind.current != null ? ind.current.toFixed(meta.format === "%" || meta.format === "bp" ? 2 : 1) : "--"}
                <span className="text-[#4a5568] text-[9px]">{meta.format}</span>
              </div>
              <div className="shrink-0">
                <ChangeBadge value={ind.change_1d} decimals={2} />
              </div>
              <div className="flex-1 min-w-0">
                <Sparkline
                  data={ind.sparkline}
                  width={70}
                  height={18}
                  color={meta.color}
                />
              </div>
              <div
                className="font-mono text-[9px] shrink-0"
                style={{ color: zColor }}
                title={`Z-score: ${zScore.toFixed(2)}`}
              >
                {zScore > 0 ? "+" : ""}
                {zScore.toFixed(1)}z
              </div>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
