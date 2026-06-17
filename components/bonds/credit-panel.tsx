"use client";

import { motion } from "framer-motion";
import Panel, { Sparkline } from "./panel";

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
  const position = Math.max(0, Math.min(100, (cycle.current + 3) / 6 * 100));

  return (
    <div className="bg-[#0f172a] rounded p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs text-[#cbd5e1] tracking-wide">CREDIT CYCLE</span>
        <span className="font-mono text-sm text-[#e2e8f0]">{cycle.interpretation}</span>
      </div>
      <div className="relative h-4 bg-gradient-to-r from-[#00ff88] via-[#fbbf24] to-[#ff6b6b] rounded-full overflow-visible mb-2">
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full border-2 border-[#0a0e17] shadow-lg"
          style={{ left: `calc(${position}% - 10px)` }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: "spring" }}
        />
      </div>
      <div className="flex justify-between font-mono text-xs text-[#cbd5e1]">
        <span>RISK-ON</span>
        <span>NEUTRAL</span>
        <span>RISK-OFF</span>
      </div>
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
    credit_cycle: { current: number; interpretation: string; sparkline: { date: string; value: number }[] } | null;
    sector_rv: { sector: string; rv_score: number; signal: string }[] | null;
    as_of: string;
  };
}) {
  if (!credit?.available) {
    return (
      <Panel title="Credit Spreads" accent="#f97316">
        <div className="text-[#94a3b8] font-mono text-sm text-center py-12">No credit data</div>
      </Panel>
    );
  }

  const spreadOrder = ["aaa_oas", "ig_oas", "bbb_oas", "hy_oas", "ccc_oas"];
  const keys = spreadOrder.filter((k) => credit.current_spreads[k] != null);

  return (
    <Panel title="Credit Spreads" accent="#f97316">
      {credit.credit_cycle && <CreditCycleGauge cycle={credit.credit_cycle} />}

      <div className="space-y-1.5">
        {keys.map((key, i) => {
          const meta = SPREAD_LABELS[key] || { label: key, color: "#94a3b8" };
          const current = credit.current_spreads[key];
          const series = credit.time_series[key];

          return (
            <motion.div
              key={key}
              className="flex items-center gap-3 bg-[#0f172a] rounded px-4 py-2.5"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="font-mono text-sm w-10 shrink-0 font-medium" style={{ color: meta.color }}>
                {meta.label}
              </div>
              <div className="font-mono text-base text-[#f1f5f9] w-16 text-right shrink-0 font-medium">
                {current != null ? current.toFixed(0) : "--"}
                <span className="text-[#cbd5e1] text-xs ml-0.5">bp</span>
              </div>
              <div className="flex-1 min-w-0">
                {series && <Sparkline data={series.slice(-60)} width={140} height={28} color={meta.color} showArea />}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Sector RV */}
      {credit.sector_rv && credit.sector_rv.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#1e293b]">
          <div className="font-mono text-xs text-[#cbd5e1] mb-2 tracking-wide">RELATIVE VALUE</div>
          <div className="flex flex-wrap gap-2">
            {credit.sector_rv.map((s) => {
              const score = s.rv_score ?? 0;
              const color = score > 0.5 ? "#00ff88" : score < -0.5 ? "#ff6b6b" : "#94a3b8";
              return (
                <div key={s.sector} className="bg-[#0f172a] rounded px-3 py-1.5 font-mono text-sm">
                  <span className="text-[#e2e8f0]">{s.sector}</span>
                  <span className="ml-2 font-medium" style={{ color }}>
                    {score > 0 ? "+" : ""}{score.toFixed(2)}
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
