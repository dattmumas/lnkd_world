"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Panel, { ChangeBadge } from "./panel";

const TENOR_YEARS: Record<string, number> = {
  "1M": 1/12, "3M": 0.25, "6M": 0.5, "1Y": 1, "2Y": 2, "3Y": 3,
  "5Y": 5, "7Y": 7, "10Y": 10, "20Y": 20, "30Y": 30,
};

function CurveSVG({
  curvePoints,
  historical,
  activeComparison,
}: {
  curvePoints: { tenor: string; years: number; yield: number }[];
  historical: Record<string, Record<string, number>>;
  activeComparison: string | null;
}) {
  const width = 700;
  const height = 300;
  const pad = { top: 30, right: 40, bottom: 40, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  if (!curvePoints || curvePoints.length < 2) {
    return (
      <div className="text-[#94a3b8] font-mono text-sm text-center py-16">
        Insufficient data
      </div>
    );
  }

  const allYields = curvePoints.map((p) => p.yield);
  const compYields =
    activeComparison && historical[activeComparison]
      ? Object.values(historical[activeComparison])
      : [];
  const allValues = [...allYields, ...compYields];
  const minY = Math.min(...allValues) - 0.2;
  const maxY = Math.max(...allValues) + 0.2;
  const maxX = Math.max(...curvePoints.map((p) => p.years));

  const sx = (years: number) => pad.left + (years / maxX) * plotW;
  const sy = (yld: number) => pad.top + plotH - ((yld - minY) / (maxY - minY)) * plotH;

  const currentPath = curvePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.years)},${sy(p.yield)}`)
    .join(" ");

  const areaPath = `${currentPath} L ${sx(curvePoints[curvePoints.length - 1].years)},${sy(minY)} L ${sx(curvePoints[0].years)},${sy(minY)} Z`;

  let compPath = "";
  if (activeComparison && historical[activeComparison]) {
    const cd = historical[activeComparison];
    const cp = curvePoints.filter((p) => cd[p.tenor] != null).map((p) => ({ ...p, yield: cd[p.tenor] }));
    if (cp.length > 1) {
      compPath = cp.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.years)},${sy(p.yield)}`).join(" ");
    }
  }

  const yTicks: number[] = [];
  const step = (maxY - minY) / 5;
  for (let i = 0; i <= 5; i++) yTicks.push(minY + step * i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Grid */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={sy(tick)} y2={sy(tick)} stroke="#1e293b" strokeWidth={0.5} />
          <text x={pad.left - 10} y={sy(tick)} textAnchor="end" dominantBaseline="middle" fill="#cbd5e1" fontSize={12} fontFamily="monospace">
            {tick.toFixed(2)}%
          </text>
        </g>
      ))}

      {/* X labels */}
      {curvePoints.map((p) => (
        <text key={p.tenor} x={sx(p.years)} y={height - 10} textAnchor="middle" fill="#cbd5e1" fontSize={12} fontFamily="monospace">
          {p.tenor}
        </text>
      ))}

      {/* Area fill */}
      <defs>
        <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a9eff" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#4a9eff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path d={areaPath} fill="url(#curveGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />

      {/* Comparison curve */}
      <AnimatePresence>
        {compPath && (
          <motion.path
            d={compPath}
            fill="none"
            stroke="#64748b"
            strokeWidth={1.5}
            strokeDasharray="6,4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>

      {/* Main curve */}
      <motion.path
        d={currentPath}
        fill="none"
        stroke="#4a9eff"
        strokeWidth={2.5}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />

      {/* Data points */}
      {curvePoints.map((p, i) => (
        <motion.circle
          key={p.tenor}
          cx={sx(p.years)}
          cy={sy(p.yield)}
          r={4}
          fill="#4a9eff"
          stroke="#0a0e17"
          strokeWidth={2}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.08 * i + 0.4, type: "spring" }}
        />
      ))}
    </svg>
  );
}

export default function YieldCurvePanel({
  yieldCurve,
}: {
  yieldCurve?: {
    current: Record<string, number>;
    curve_points: { tenor: string; years: number; yield: number }[];
    historical: Record<string, Record<string, number>>;
    spot_rates: { tenor: string; rate: number }[];
    forward_rates: { from: string; to: string; rate: number }[];
    time_series: Record<string, { date: string; value: number }[]>;
    as_of: string;
  };
}) {
  const [comparison, setComparison] = useState<string | null>(null);

  if (!yieldCurve) {
    return (
      <Panel title="Yield Curve" accent="#4a9eff">
        <div className="text-[#94a3b8] font-mono text-sm text-center py-16">No yield curve data</div>
      </Panel>
    );
  }

  const comparisons = [
    { key: "1w", label: "1W ago" },
    { key: "1m", label: "1M ago" },
    { key: "3m", label: "3M ago" },
    { key: "1y", label: "1Y ago" },
  ];

  const keyTenors = ["2Y", "5Y", "10Y", "30Y"];

  return (
    <Panel
      title="Treasury Yield Curve"
      subtitle={yieldCurve.as_of ? new Date(yieldCurve.as_of).toLocaleDateString() : undefined}
      accent="#4a9eff"
    >
      {/* Comparison toggles */}
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-xs text-[#94a3b8]">Compare:</span>
        {comparisons.map((c) => (
          <button
            key={c.key}
            onClick={() => setComparison(comparison === c.key ? null : c.key)}
            className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
              comparison === c.key
                ? "bg-[#4a9eff] text-[#0a0e17] font-medium"
                : "bg-[#1e293b] text-[#94a3b8] hover:bg-[#2d3748]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <CurveSVG
        curvePoints={yieldCurve.curve_points}
        historical={yieldCurve.historical || {}}
        activeComparison={comparison}
      />

      {/* Key tenors */}
      <div className="mt-4 grid grid-cols-4 gap-4">
        {keyTenors.map((tenor) => {
          const current = yieldCurve.current[tenor];
          const prev =
            comparison && yieldCurve.historical[comparison]
              ? yieldCurve.historical[comparison][tenor]
              : null;
          const change = current != null && prev != null ? (current - prev) * 100 : null;

          return (
            <div key={tenor} className="bg-[#0f172a] rounded p-3 text-center">
              <div className="font-mono text-xs text-[#94a3b8] mb-1">{tenor}</div>
              <div className="font-mono text-xl font-bold text-[#f1f5f9]">
                {current != null ? `${current.toFixed(2)}%` : "--"}
              </div>
              {change != null && (
                <div className="mt-1">
                  <ChangeBadge value={change} suffix="bp" decimals={0} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Forward rates */}
      {yieldCurve.forward_rates && yieldCurve.forward_rates.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#1e293b]">
          <div className="font-mono text-xs text-[#94a3b8] mb-2 tracking-wide">FORWARD RATES</div>
          <div className="flex flex-wrap gap-4">
            {yieldCurve.forward_rates.map((f) => (
              <div key={`${f.from}-${f.to}`} className="font-mono text-sm">
                <span className="text-[#94a3b8]">{f.from}&rarr;{f.to}</span>
                <span className="text-[#e2e8f0] ml-2 font-medium">
                  {f.rate != null ? `${f.rate.toFixed(2)}%` : "--"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
