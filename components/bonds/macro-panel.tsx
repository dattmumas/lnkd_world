"use client";

import Panel, { Sparkline, ChangeBadge } from "./panel";

const INDICATOR_META: Record<string, { label: string; unit: string }> = {
  vix: { label: "VIX", unit: "" },
  move_index: { label: "MOVE INDEX", unit: "" },
  breakeven_10y: { label: "10Y BREAKEVEN", unit: "%" },
  breakeven_5y: { label: "5Y BREAKEVEN", unit: "%" },
  fed_funds: { label: "FED FUNDS", unit: "%" },
  baa_spread: { label: "BAA SPREAD", unit: "bp" },
  consumer_sentiment: { label: "CONSUMER SENT", unit: "" },
  cpi: { label: "CPI", unit: "%" },
  unemployment: { label: "UNEMPLOYMENT", unit: "%" },
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
      <Panel title="Macro Indicators" note="Key macro drivers with recent changes and their 1-year percentile (how high or low each reading is versus its own history).">
        <div className="text-[#FB8B1E] font-mono text-sm text-center py-8">No macro data</div>
      </Panel>
    );
  }

  const keys = DISPLAY_ORDER.filter((k) => macro.indicators[k]);

  return (
    <Panel title="Macro Indicators" note="Key macro drivers with recent changes and their 1-year percentile (how high or low each reading is versus its own history).">
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="text-left text-[#FB8B1E] border-b border-[#2E2E2E]">
            <th className="py-0.5 font-normal">INDICATOR</th>
            <th className="py-0.5 font-normal text-right">LAST</th>
            <th className="py-0.5 font-normal text-right">1D CHG</th>
            <th className="py-0.5 font-normal text-center">90D</th>
            <th className="py-0.5 font-normal text-right">1Y Z</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const ind = macro.indicators[key];
            const meta = INDICATOR_META[key] || { label: key.toUpperCase(), unit: "" };
            const zScore = ind.z_score ?? 0;
            const zColor = Math.abs(zScore) > 2 ? "#FF433D" : Math.abs(zScore) > 1 ? "#FB8B1E" : "#00C25B";

            return (
              <tr key={key} className="border-b border-[#1C1C1C]">
                <td className="py-[3px] text-[#F6F3E8]">{meta.label}</td>
                <td className="py-[3px] text-right text-[#F6F3E8] font-bold tabular-nums">
                  {ind.current != null ? ind.current.toFixed(meta.unit === "%" || meta.unit === "bp" ? 2 : 1) : "--"}
                </td>
                <td className="py-[3px] text-right">
                  <ChangeBadge value={ind.change_1d} decimals={2} />
                </td>
                <td className="py-[3px] text-center leading-none">
                  <Sparkline data={ind.sparkline} width={80} height={14} color="#FB8B1E" />
                </td>
                <td className="py-[3px] text-right tabular-nums" style={{ color: zColor }}>
                  {zScore > 0 ? "+" : ""}{zScore.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
