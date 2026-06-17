"use client";

import { motion } from "framer-motion";
import Panel from "./panel";

const ALLOCATION_COLORS: Record<string, string> = {
  treasuries_short: "#2563eb",
  treasuries_mid: "#0a8f57",
  treasuries_long: "#0e9384",
  ig_corporate: "#a86e15",
  hy_corporate: "#d23b3b",
  tips: "#e3700f",
  cash: "#a8aeb9",
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
  size = 180,
}: {
  allocation: Record<string, number>;
  size?: number;
}) {
  const entries = Object.entries(allocation).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const r = size / 2 - 12;
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
      color: ALLOCATION_COLORS[key] || "#a8aeb9",
      pct: (value / total) * 100,
    };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[180px] mx-auto">
      {segments.map((seg, i) => (
        <motion.path
          key={seg.key}
          d={seg.d}
          fill={seg.color}
          fillOpacity={0.8}
          stroke="#ffffff"
          strokeWidth={1.5}
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
      <Panel title="Portfolio" accent="#0a8f57">
        <div className="text-[#6e7682] font-mono text-sm text-center py-8">
          No portfolio data
        </div>
      </Panel>
    );
  }

  const alloc = portfolio.allocation || {};
  const base = portfolio.base_allocation || {};

  return (
    <Panel title="Portfolio Allocation" note="Suggested duration and sector tilts implied by the aggregated signals - a starting point, not a mandate." accent="#0a8f57">
      {/* Donut */}
      <DonutChart allocation={alloc} />

      {/* Legend / breakdown */}
      <div className="mt-4 space-y-2">
        {Object.entries(alloc)
          .sort(([, a], [, b]) => b - a)
          .map(([key, value]) => {
            const color = ALLOCATION_COLORS[key] || "#a8aeb9";
            const label = ALLOCATION_LABELS[key] || key;
            const baseVal = base[key] || 0;
            const diff = value - baseVal;

            return (
              <div
                key={key}
                className="flex items-center gap-3 font-mono text-sm"
              >
                <div
                  className="w-3 h-3 rounded shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[#374151] w-20">{label}</span>
                <span className="text-[#0f1115] w-12 text-right font-medium">
                  {(value * 100).toFixed(0)}%
                </span>
                {Math.abs(diff) > 0.005 && (
                  <span
                    className="text-xs"
                    style={{ color: diff > 0 ? "#0a8f57" : "#d23b3b" }}
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
        <div className="mt-4 pt-3 border-t border-[#e8eaee]">
          <div className="font-mono text-xs text-[#374151]">
            TILTS: {portfolio.tilts_applied.map((t) => t.signal_type).join(", ")}
          </div>
        </div>
      )}
    </Panel>
  );
}
