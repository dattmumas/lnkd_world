"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Panel, { ChangeBadge } from "./panel";

// Tenor ordering for x-axis
const TENOR_ORDER = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];

function CurveSVG({
  curvePoints,
  historical,
  activeComparison,
  width = 600,
  height = 220,
}: {
  curvePoints: { tenor: string; years: number; yield: number }[];
  historical: Record<string, Record<string, number>>;
  activeComparison: string | null;
  width?: number;
  height?: number;
}) {
  const padding = { top: 20, right: 30, bottom: 30, left: 50 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  if (!curvePoints || curvePoints.length < 2) {
    return (
      <div className="text-[#4a5568] font-mono text-xs text-center py-8">
        Insufficient data for yield curve
      </div>
    );
  }

  // Scale helpers
  const allYields = curvePoints.map((p) => p.yield);
  const compYields = activeComparison && historical[activeComparison]
    ? Object.values(historical[activeComparison])
    : [];
  const allValues = [...allYields, ...compYields];
  const minY = Math.min(...allValues) - 0.15;
  const maxY = Math.max(...allValues) + 0.15;
  const maxX = Math.max(...curvePoints.map((p) => p.years));

  const scaleX = (years: number) => padding.left + (years / maxX) * plotW;
  const scaleY = (yld: number) =>
    padding.top + plotH - ((yld - minY) / (maxY - minY)) * plotH;

  // Build path for current curve
  const currentPath = curvePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.years)},${scaleY(p.yield)}`)
    .join(" ");

  // Build area under curve
  const areaPath = `${currentPath} L ${scaleX(curvePoints[curvePoints.length - 1].years)},${scaleY(minY)} L ${scaleX(curvePoints[0].years)},${scaleY(minY)} Z`;

  // Build comparison path
  let compPath = "";
  if (activeComparison && historical[activeComparison]) {
    const compData = historical[activeComparison];
    const compPoints = curvePoints
      .filter((p) => compData[p.tenor] != null)
      .map((p) => ({ ...p, yield: compData[p.tenor] }));
    compPath = compPoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.years)},${scaleY(p.yield)}`)
      .join(" ");
  }

  // Y-axis ticks
  const yTicks: number[] = [];
  const step = (maxY - minY) / 5;
  for (let i = 0; i <= 5; i++) {
    yTicks.push(minY + step * i);
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Grid lines */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={scaleY(tick)}
            y2={scaleY(tick)}
            stroke="#1e293b"
            strokeWidth={0.5}
          />
          <text
            x={padding.left - 6}
            y={scaleY(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-[#4a5568] text-[9px]"
            fontFamily="monospace"
          >
            {tick.toFixed(2)}%
          </text>
        </g>
      ))}

      {/* X-axis tenor labels */}
      {curvePoints.map((p) => (
        <text
          key={p.tenor}
          x={scaleX(p.years)}
          y={height - 8}
          textAnchor="middle"
          className="fill-[#4a5568] text-[9px]"
          fontFamily="monospace"
        >
          {p.tenor}
        </text>
      ))}

      {/* Area fill */}
      <motion.path
        d={areaPath}
        fill="url(#curveGradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      />

      {/* Gradient definition */}
      <defs>
        <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a9eff" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#4a9eff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Comparison curve */}
      <AnimatePresence>
        {compPath && (
          <motion.path
            d={compPath}
            fill="none"
            stroke="#4a5568"
            strokeWidth={1}
            strokeDasharray="4,3"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
        )}
      </AnimatePresence>

      {/* Current curve line */}
      <motion.path
        d={currentPath}
        fill="none"
        stroke="#4a9eff"
        strokeWidth={2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />

      {/* Data points */}
      {curvePoints.map((p, i) => (
        <motion.circle
          key={p.tenor}
          cx={scaleX(p.years)}
          cy={scaleY(p.yield)}
          r={3}
          fill="#4a9eff"
          stroke="#0a0e17"
          strokeWidth={1.5}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 * i + 0.5, type: "spring" }}
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
        <div className="text-[#4a5568] font-mono text-xs text-center py-12">
          No yield curve data available
        </div>
      </Panel>
    );
  }

  const comparisons = [
    { key: "1w", label: "1W" },
    { key: "1m", label: "1M" },
    { key: "3m", label: "3M" },
    { key: "1y", label: "1Y" },
  ];

  // Key tenor changes vs comparison
  const keyTenors = ["2Y", "5Y", "10Y", "30Y"];

  return (
    <Panel
      title="Treasury Yield Curve"
      subtitle={yieldCurve.as_of ? `As of ${new Date(yieldCurve.as_of).toLocaleDateString()}` : undefined}
      accent="#4a9eff"
    >
      {/* Comparison toggle buttons */}
      <div className="flex items-center gap-1 mb-3">
        <span className="font-mono text-[10px] text-[#4a5568] mr-2">COMPARE:</span>
        {comparisons.map((c) => (
          <button
            key={c.key}
            onClick={() => setComparison(comparison === c.key ? null : c.key)}
            className={`px-2 py-0.5 rounded-sm font-mono text-[10px] transition-colors ${
              comparison === c.key
                ? "bg-[#4a9eff] text-[#0a0e17]"
                : "bg-[#1e293b] text-[#94a3b8] hover:bg-[#2d3748]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Curve visualization */}
      <CurveSVG
        curvePoints={yieldCurve.curve_points}
        historical={yieldCurve.historical || {}}
        activeComparison={comparison}
      />

      {/* Key tenor table */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {keyTenors.map((tenor) => {
          const current = yieldCurve.current[tenor];
          const prev = comparison && yieldCurve.historical[comparison]
            ? yieldCurve.historical[comparison][tenor]
            : null;
          const change = current != null && prev != null ? (current - prev) * 100 : null;

          return (
            <div key={tenor} className="bg-[#0f172a] rounded-sm p-2 text-center">
              <div className="font-mono text-[10px] text-[#4a5568] mb-1">{tenor}</div>
              <div className="font-mono text-sm text-[#e2e8f0]">
                {current != null ? `${current.toFixed(2)}%` : "--"}
              </div>
              {change != null && (
                <div className="mt-0.5">
                  <ChangeBadge value={change} suffix="bp" decimals={0} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Forward rates */}
      {yieldCurve.forward_rates && yieldCurve.forward_rates.length > 0 && (
        <div className="mt-3 pt-2 border-t border-[#1e293b]">
          <div className="font-mono text-[10px] text-[#4a5568] mb-1.5">FORWARD RATES</div>
          <div className="flex flex-wrap gap-3">
            {yieldCurve.forward_rates.map((f) => (
              <div key={`${f.from}-${f.to}`} className="font-mono text-[11px]">
                <span className="text-[#4a5568]">
                  {f.from}\u2192{f.to}
                </span>
                <span className="text-[#94a3b8] ml-1">{f.rate != null ? `${f.rate.toFixed(2)}%` : "--"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
