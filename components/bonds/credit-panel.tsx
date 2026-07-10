"use client";

import { motion } from "framer-motion";
import Panel, { Sparkline } from "./panel";

const SPREAD_LABELS: Record<string, { label: string; color: string }> = {
  aaa_oas: { label: "AAA", color: "#00D964" },
  baa_oas: { label: "BAA", color: "#62B0FF" },
  ig_oas: { label: "IG", color: "#00C8FF" },
  hy_oas: { label: "HY", color: "#FFA028" },
  bbb_oas: { label: "BBB", color: "#FFA028" },
  ccc_oas: { label: "CCC", color: "#FF4B4B" },
};

function CreditCycleGauge({
  cycle,
}: {
  cycle: { current: number; interpretation: string; sparkline: { date: string; value: number }[] };
}) {
  const position = Math.max(0, Math.min(100, (cycle.current + 3) / 6 * 100));

  return (
    <div className="bg-[#141414] rounded p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs text-[#E6E6E6] tracking-wide">CREDIT CYCLE</span>
        <span className="font-mono text-sm text-[#E6E6E6]">{cycle.interpretation}</span>
      </div>
      <div className="relative h-4 bg-gradient-to-r from-[#00D964] via-[#FFA028] to-[#FF4B4B] rounded-full overflow-visible mb-2">
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-[#0B0B0B] rounded-full border-2 border-[#ffffff] shadow-lg"
          style={{ left: `calc(${position}% - 10px)` }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: "spring" }}
        />
      </div>
      <div className="flex justify-between font-mono text-xs text-[#E6E6E6]">
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
      <Panel title="Credit Spreads" note="Corporate yield premiums over Treasuries. Wider spreads mean more risk aversion; the cycle gauge flags early vs late cycle." accent="#FFA028">
        <div className="text-[#D89540] font-mono text-sm text-center py-8">No credit data</div>
      </Panel>
    );
  }

  const spreadOrder = ["aaa_oas", "ig_oas", "bbb_oas", "hy_oas", "ccc_oas"];
  const keys = spreadOrder.filter((k) => credit.current_spreads[k] != null);

  return (
    <Panel title="Credit Spreads" note="Corporate yield premiums over Treasuries. Wider spreads mean more risk aversion; the cycle gauge flags early vs late cycle." accent="#FFA028">
      {credit.credit_cycle && <CreditCycleGauge cycle={credit.credit_cycle} />}

      <div className="space-y-1.5">
        {keys.map((key, i) => {
          const meta = SPREAD_LABELS[key] || { label: key, color: "#D89540" };
          const current = credit.current_spreads[key];
          const series = credit.time_series[key];

          return (
            <motion.div
              key={key}
              className="flex items-center gap-3 bg-[#141414] rounded px-4 py-2.5"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="font-mono text-sm w-10 shrink-0 font-medium" style={{ color: meta.color }}>
                {meta.label}
              </div>
              <div className="font-mono text-base text-[#E6E6E6] w-16 text-right shrink-0 font-medium">
                {current != null ? current.toFixed(0) : "--"}
                <span className="text-[#E6E6E6] text-xs ml-0.5">bp</span>
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
        <div className="mt-4 pt-3 border-t border-[#2E2E2E]">
          <div className="font-mono text-xs text-[#E6E6E6] mb-2 tracking-wide">RELATIVE VALUE</div>
          <div className="flex flex-wrap gap-2">
            {credit.sector_rv.map((s, i) => {
              const score = s.rv_score ?? 0;
              const color = score > 0.5 ? "#00D964" : score < -0.5 ? "#FF4B4B" : "#D89540";
              return (
                <div key={`${s.sector ?? "rv"}-${i}`} className="bg-[#141414] rounded px-3 py-1.5 font-mono text-sm">
                  <span className="text-[#E6E6E6]">{s.sector}</span>
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
