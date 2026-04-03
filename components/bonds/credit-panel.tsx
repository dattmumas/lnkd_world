"use client";

import { motion } from "framer-motion";
import Panel, { Sparkline, ChangeBadge } from "./panel";

const SPREAD_LABELS: Record<string, { label: string; color: string }> = {
  aaa_oas: { label: "AAA", color: "#00ff88" },
  baa_oas: { label: "BAA", color: "#4a9eff" },
  ig_oas: { label: "IG", color: "#a855f7" },
  hy_oas: { label: "HY", color: "#fbbf24" },
  bbb_oas: { label: "BBB", color: "#f97316" },
  ccc_oas: { label: "CCC", color: "#ff6b6b" },
};

function CreditCycleGauge({
  cycle,
}: {
  cycle: { current: number; interpretation: string; sparkline: { date: string; value: number }[] };
}) {
  // Map cycle indicator (-3 to +3 range) to gauge position
  const position = Math.max(0, Math.min(100, (cycle.current + 3) / 6 * 100));

  return (
    <div className="bg-[#0f172a] rounded-sm p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-[#4a5568] uppercase">
          Credit Cycle
        </span>
        <span className="font-mono text-[10px] text-[#94a3b8]">
          {cycle.interpretation}
        </span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-3 bg-gradient-to-r from-[#00ff88] via-[#fbbf24] to-[#ff6b6b] rounded-full overflow-hidden mb-2">
        <motion.div
          className="absolute top-0 w-3 h-3 bg-white rounded-full border-2 border-[#0a0e17] shadow-lg"
          style={{ left: `calc(${position}% - 6px)` }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        />
      </div>
      <div className="flex justify-between font-mono text-[8px] text-[#4a5568]">
        <span>RISK-ON</span>
        <span>NEUTRAL</span>
        <span>RISK-OFF</span>
      </div>

      {/* Mini sparkline */}
      {cycle.sparkline && (
        <div className="mt-2 flex justify-center">
          <Sparkline data={cycle.sparkline} width={120} height={20} color="#fbbf24" showArea />
        </div>
      )}
    </div>
  );
}

export default function CreditPanel({
  credit,
}: {
  credit?: {
    available: boolean;
    current_spreads: Record<string, number>;
    time_series: Record<string, { date: string; value: number }[]>;
    credit_cycle: {
      current: number;
      interpretation: string;
      sparkline: { date: string; value: number }[];
    } | null;
    sector_rv: { sector: string; rv_score: number; signal: string }[] | null;
    as_of: string;
  };
}) {
  if (!credit?.available) {
    return (
      <Panel title="Credit Spreads" accent="#f97316">
        <div className="text-[#4a5568] font-mono text-xs text-center py-8">
          No credit data
        </div>
      </Panel>
    );
  }

  // Order spreads by risk
  const spreadOrder = ["aaa_oas", "baa_oas", "ig_oas", "bbb_oas", "hy_oas", "ccc_oas"];
  const keys = spreadOrder.filter((k) => credit.current_spreads[k] != null);

  return (
    <Panel title="Credit Spreads" accent="#f97316">
      {/* Credit cycle gauge */}
      {credit.credit_cycle && <CreditCycleGauge cycle={credit.credit_cycle} />}

      {/* Spread table */}
      <div className="space-y-1">
        {keys.map((key, i) => {
          const meta = SPREAD_LABELS[key] || { label: key, color: "#4a5568" };
          const current = credit.current_spreads[key];
          const series = credit.time_series[key];

          return (
            <motion.div
              key={key}
              className="flex items-center gap-2 bg-[#0f172a] rounded-sm px-2 py-1.5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                className="font-mono text-[10px] w-8 shrink-0"
                style={{ color: meta.color }}
              >
                {meta.label}
              </div>
              <div className="font-mono text-[11px] text-[#e2e8f0] w-14 text-right shrink-0">
                {current != null ? current.toFixed(0) : "--"}
                <span className="text-[#4a5568] text-[9px]">bp</span>
              </div>
              <div className="flex-1 min-w-0">
                {series && (
                  <Sparkline
                    data={series.slice(-60)}
                    width={100}
                    height={18}
                    color={meta.color}
                    showArea
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Sector RV scores */}
      {credit.sector_rv && credit.sector_rv.length > 0 && (
        <div className="mt-3 pt-2 border-t border-[#1e293b]">
          <div className="font-mono text-[10px] text-[#4a5568] mb-1.5">
            RELATIVE VALUE
          </div>
          <div className="flex flex-wrap gap-2">
            {credit.sector_rv.map((s) => {
              const score = s.rv_score ?? 0;
              const color =
                score > 0.5
                  ? "#00ff88"
                  : score < -0.5
                    ? "#ff6b6b"
                    : "#4a5568";
              return (
                <div
                  key={s.sector}
                  className="bg-[#0f172a] rounded-sm px-2 py-1 font-mono text-[10px]"
                >
                  <span className="text-[#94a3b8]">{s.sector}</span>
                  <span className="ml-1" style={{ color }}>
                    {score > 0 ? "+" : ""}
                    {score.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
