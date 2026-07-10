"use client";

import Panel from "./panel";

const ALLOCATION_COLORS: Record<string, string> = {
  treasuries_short: "#62B0FF",
  treasuries_mid: "#00D964",
  treasuries_long: "#FFE24A",
  ig_corporate: "#FFA028",
  hy_corporate: "#FF4B4B",
  tips: "#FF3EB5",
  cash: "#8F8F8F",
};

const ALLOCATION_LABELS: Record<string, string> = {
  treasuries_short: "TSY SHORT",
  treasuries_mid: "TSY MID",
  treasuries_long: "TSY LONG",
  ig_corporate: "IG CORP",
  hy_corporate: "HY CORP",
  tips: "TIPS",
  cash: "CASH",
};

export default function PortfolioPanel({
  portfolio,
}: {
  portfolio?: {
    allocation: Record<string, number>;
    base_allocation: Record<string, number>;
    tilts_applied: { signal_type: string; direction: number; tilt_size: number }[];
    conviction_score: number;
    error?: string;
  };
}) {
  if (!portfolio || portfolio.error) {
    return (
      <Panel title="Portfolio Allocation">
        <div className="text-[#D89540] font-mono text-sm text-center py-8">
          No portfolio data
        </div>
      </Panel>
    );
  }

  const alloc = portfolio.allocation || {};
  const base = portfolio.base_allocation || {};
  const entries = Object.entries(alloc)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, v]) => sum + v, 0) || 1;

  return (
    <Panel title="Portfolio Allocation" note="Suggested duration and sector tilts implied by the aggregated signals - a starting point, not a mandate.">
      {/* Stacked allocation bar */}
      <div className="flex h-3 w-full mb-2">
        {entries.map(([key, value]) => (
          <div
            key={key}
            style={{
              width: `${(value / total) * 100}%`,
              backgroundColor: ALLOCATION_COLORS[key] || "#8F8F8F",
            }}
          />
        ))}
      </div>

      {/* Weights table */}
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="text-left text-[#D89540] border-b border-[#2E2E2E]">
            <th className="py-0.5 font-normal">SLEEVE</th>
            <th className="py-0.5 font-normal text-right">WGT</th>
            <th className="py-0.5 font-normal text-right">VS BASE</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => {
            const color = ALLOCATION_COLORS[key] || "#8F8F8F";
            const label = ALLOCATION_LABELS[key] || key.toUpperCase();
            const baseVal = base[key] || 0;
            const diff = value - baseVal;
            const hasTilt = Math.abs(diff) > 0.005;

            return (
              <tr key={key} className="border-b border-[#141414]">
                <td className="py-[3px]">
                  <span
                    className="inline-block w-2 h-2 mr-1.5"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[#E6E6E6]">{label}</span>
                </td>
                <td className="py-[3px] text-right text-[#FFE24A] font-bold tabular-nums">
                  {(value * 100).toFixed(0)}%
                </td>
                <td
                  className="py-[3px] text-right tabular-nums"
                  style={{
                    color: hasTilt ? (diff > 0 ? "#00D964" : "#FF4B4B") : "#5C5C5C",
                  }}
                >
                  {hasTilt ? `${diff > 0 ? "+" : ""}${(diff * 100).toFixed(0)}%` : "--"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Tilts applied */}
      {(() => {
        const tilts = (portfolio.tilts_applied ?? [])
          .map((t) => t.signal_type)
          .filter(Boolean);
        if (tilts.length === 0) return null;
        return (
          <div className="mt-1.5 font-mono text-[10px]">
            <span className="text-[#D89540]">TILTS </span>
            <span className="text-[#8F8F8F] uppercase">{tilts.join(" · ")}</span>
          </div>
        );
      })()}
    </Panel>
  );
}
