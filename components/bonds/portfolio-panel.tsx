"use client";

import { motion } from "framer-motion";
import Panel from "./panel";

const ALLOCATION_COLORS: Record<string, string> = {
  treasuries_short: "#4a9eff",
  treasuries_mid: "#00ff88",
  treasuries_long: "#a855f7",
  ig_corporate: "#fbbf24",
  hy_corporate: "#ff6b6b",
  tips: "#f97316",
  cash: "#4a5568",
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

function DonutChart({
  allocation,
  size = 120,
}: {
  allocation: Record<string, number>;
  size?: number;
}) {
  const entries = Object.entries(allocation).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;

  let cumulative = 0;
  const segments = entries.map(([key, value]) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;

    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const innerR = r * 0.6;
    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);

    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
      "Z",
    ].join(" ");

    return {
      key,
      d,
      color: ALLOCATION_COLORS[key] || "#4a5568",
      pct: (value / total) * 100,
    };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[140px] mx-auto">
      {segments.map((seg, i) => (
        <motion.path
          key={seg.key}
          d={seg.d}
          fill={seg.color}
          fillOpacity={0.8}
          stroke="#111827"
          strokeWidth={1}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.1, type: "spring" }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
    </svg>
  );
}

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
      <Panel title="Portfolio" accent="#00ff88">
        <div className="text-[#4a5568] font-mono text-xs text-center py-8">
          No portfolio data
        </div>
      </Panel>
    );
  }

  const alloc = portfolio.allocation || {};
  const base = portfolio.base_allocation || {};

  return (
    <Panel title="Portfolio Allocation" accent="#00ff88">
      {/* Donut */}
      <DonutChart allocation={alloc} />

      {/* Legend / breakdown */}
      <div className="mt-3 space-y-1">
        {Object.entries(alloc)
          .sort(([, a], [, b]) => b - a)
          .map(([key, value]) => {
            const color = ALLOCATION_COLORS[key] || "#4a5568";
            const label = ALLOCATION_LABELS[key] || key;
            const baseVal = base[key] || 0;
            const diff = value - baseVal;

            return (
              <div
                key={key}
                className="flex items-center gap-2 font-mono text-[10px]"
              >
                <div
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[#94a3b8] w-16">{label}</span>
                <span className="text-[#e2e8f0] w-10 text-right">
                  {(value * 100).toFixed(0)}%
                </span>
                {Math.abs(diff) > 0.005 && (
                  <span
                    className="text-[9px]"
                    style={{ color: diff > 0 ? "#00ff88" : "#ff6b6b" }}
                  >
                    ({diff > 0 ? "+" : ""}
                    {(diff * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
            );
          })}
      </div>

      {/* Tilts applied */}
      {portfolio.tilts_applied && portfolio.tilts_applied.length > 0 && (
        <div className="mt-3 pt-2 border-t border-[#1e293b]">
          <div className="font-mono text-[9px] text-[#4a5568]">
            TILTS: {portfolio.tilts_applied.map((t) => t.signal_type).join(", ")}
          </div>
        </div>
      )}
    </Panel>
  );
}
