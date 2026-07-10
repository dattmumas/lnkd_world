"use client";

import Panel, { Sparkline, ChangeBadge } from "./panel";

const INDICATOR_META: Record<string, { label: string; unit: string; color: string }> = {
  vix: { label: "VIX", unit: "", color: "#FF4B4B" },
  move_index: { label: "MOVE INDEX", unit: "", color: "#FFA028" },
  breakeven_10y: { label: "10Y BREAKEVEN", unit: "%", color: "#62B0FF" },
  breakeven_5y: { label: "5Y BREAKEVEN", unit: "%", color: "#62B0FF" },
  fed_funds: { label: "FED FUNDS", unit: "%", color: "#00D964" },
  baa_spread: { label: "BAA SPREAD", unit: "bp", color: "#FFA028" },
  consumer_sentiment: { label: "CONSUMER SENT", unit: "", color: "#62B0FF" },
  cpi: { label: "CPI", unit: "%", color: "#FF3EB5" },
  unemployment: { label: "UNEMPLOYMENT", unit: "%", color: "#D89540" },
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
        <div className="text-[#D89540] font-mono text-sm text-center py-8">No macro data</div>
      </Panel>
    );
  }

  const keys = DISPLAY_ORDER.filter((k) => macro.indicators[k]);

  return (
    <Panel title="Macro Indicators" note="Key macro drivers with recent changes and their 1-year percentile (how high or low each reading is versus its own history).">
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="text-left text-[#D89540] border-b border-[#2E2E2E]">
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
            const meta = INDICATOR_META[key] || { label: key.toUpperCase(), unit: "", color: "#D89540" };
            const zScore = ind.z_score ?? 0;
            const zColor = Math.abs(zScore) > 2 ? "#FF4B4B" : Math.abs(zScore) > 1 ? "#FFA028" : "#00D964";

            return (
              <tr key={key} className="border-b border-[#141414]">
                <td className="py-[3px] text-[#E6E6E6]">{meta.label}</td>
                <td className="py-[3px] text-right text-[#FFE24A] font-bold tabular-nums">
                  {ind.current != null ? ind.current.toFixed(meta.unit === "%" || meta.unit === "bp" ? 2 : 1) : "--"}
                </td>
                <td className="py-[3px] text-right">
                  <ChangeBadge value={ind.change_1d} decimals={2} />
                </td>
                <td className="py-[3px] text-center leading-none">
                  <Sparkline data={ind.sparkline} width={80} height={14} color={meta.color} />
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
