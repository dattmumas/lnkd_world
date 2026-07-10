"use client";

import Panel, { Sparkline } from "./panel";

const SPREAD_LABELS: Record<string, string> = {
  aaa_oas: "AAA",
  baa_oas: "BAA",
  ig_oas: "IG",
  hy_oas: "HY",
  bbb_oas: "BBB",
  ccc_oas: "CCC",
};

function CreditCycleStrip({
  cycle,
}: {
  cycle: { current: number; interpretation: string; sparkline: { date: string; value: number }[] };
}) {
  const position = Math.max(0, Math.min(100, ((cycle.current + 3) / 6) * 100));

  return (
    <div className="mb-2 pb-2 border-b border-[#1F1F1F] font-mono">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#FB8B1E]">CREDIT CYCLE</span>
        <span className="text-[11px] text-[#F6F3E8] font-bold uppercase">{cycle.interpretation}</span>
      </div>
      <div className="relative h-[7px] bg-[#1A1A1A]">
        {/* zone ticks at the thirds */}
        <div className="absolute left-1/3 top-0 h-full w-px bg-[#2E2E2E]" />
        <div className="absolute left-2/3 top-0 h-full w-px bg-[#2E2E2E]" />
        {/* position marker */}
        <div
          className="absolute top-[-3px] h-[13px] w-[3px] bg-[#FB8B1E]"
          style={{ left: `calc(${position}% - 1px)` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-[#7C7C7C] mt-0.5">
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
      <Panel title="Credit Spreads" note="Corporate yield premiums over Treasuries. Wider spreads mean more risk aversion; the cycle gauge flags early vs late cycle.">
        <div className="text-[#FB8B1E] font-mono text-sm text-center py-8">No credit data</div>
      </Panel>
    );
  }

  const spreadOrder = ["aaa_oas", "ig_oas", "bbb_oas", "hy_oas", "ccc_oas"];
  const keys = spreadOrder.filter((k) => credit.current_spreads[k] != null);

  return (
    <Panel title="Credit Spreads" note="Corporate yield premiums over Treasuries. Wider spreads mean more risk aversion; the cycle gauge flags early vs late cycle.">
      {credit.credit_cycle && <CreditCycleStrip cycle={credit.credit_cycle} />}

      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="text-left text-[#FB8B1E] border-b border-[#2E2E2E]">
            <th className="py-0.5 font-normal">RATING</th>
            <th className="py-0.5 font-normal text-right">OAS</th>
            <th className="py-0.5 font-normal text-center">60D</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const label = SPREAD_LABELS[key] || key.toUpperCase();
            const current = credit.current_spreads[key];
            const series = credit.time_series[key];

            return (
              <tr key={key} className="border-b border-[#1C1C1C]">
                <td className="py-[3px] font-bold text-[#E0C010]">{label}</td>
                <td className="py-[3px] text-right tabular-nums">
                  <span className="text-[#F6F3E8] font-bold">
                    {current != null ? current.toFixed(0) : "--"}
                  </span>
                  <span className="text-[#7C7C7C] text-[9px] ml-0.5">bp</span>
                </td>
                <td className="py-[3px] text-center leading-none">
                  {series && <Sparkline data={series.slice(-60)} width={110} height={14} color="#FB8B1E" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Sector RV */}
      {credit.sector_rv && credit.sector_rv.length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-[#1F1F1F]">
          <div className="font-mono text-[10px] text-[#FB8B1E] mb-0.5">RELATIVE VALUE</div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px]">
            {credit.sector_rv.map((s, i) => {
              const score = s.rv_score ?? 0;
              const color = score > 0.5 ? "#00C25B" : score < -0.5 ? "#FF433D" : "#FB8B1E";
              return (
                <div key={`${s.sector ?? "rv"}-${i}`}>
                  <span className="text-[#A5A095]">{s.sector}</span>
                  <span className="ml-1.5 tabular-nums" style={{ color }}>
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
