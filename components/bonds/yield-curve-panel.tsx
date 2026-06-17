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
  const height = 104;
  const pad = { top: 14, right: 20, bottom: 26, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  if (!curvePoints || curvePoints.length < 2) {
    return (
      <div className="text-[#6e7682] font-mono text-sm text-center py-10">
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
          <line x1={pad.left} x2={width - pad.right} y1={sy(tick)} y2={sy(tick)} stroke="#e8eaee" strokeWidth={0.5} />
          <text x={pad.left - 10} y={sy(tick)} textAnchor="end" dominantBaseline="middle" fill="#374151" fontSize={10} fontFamily="monospace">
            {tick.toFixed(2)}%
          </text>
        </g>
      ))}

      {/* X labels */}
      {curvePoints.map((p) => (
        <text key={p.tenor} x={sx(p.years)} y={height - 10} textAnchor="middle" fill="#374151" fontSize={10} fontFamily="monospace">
          {p.tenor}
        </text>
      ))}

      {/* Area fill */}
      <defs>
        <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a8f57" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#0a8f57" stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path d={areaPath} fill="url(#curveGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />

      {/* Comparison curve */}
      <AnimatePresence>
        {compPath && (
          <motion.path
            d={compPath}
            fill="none"
            stroke="#6b7280"
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
        stroke="#0a8f57"
        strokeWidth={2}
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
          r={3}
          fill="#0a8f57"
          stroke="#ffffff"
          strokeWidth={1.5}
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
      <Panel title="Yield Curve" accent="#0a8f57">
        <div className="text-[#6e7682] font-mono text-sm text-center py-10">No yield curve data</div>
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
      accent="#0a8f57"
      note="Treasury yield at each maturity. A normal curve slopes up; when it inverts (short rates above long), it has historically preceded recessions. Toggle a date to compare."
    >
      {/* Comparison toggles */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-xs text-[#6e7682]">Compare:</span>
        {comparisons.map((c) => (
          <button
            key={c.key}
            onClick={() => setComparison(comparison === c.key ? null : c.key)}
            className={`px-2.5 py-0.5 rounded font-mono text-[11px] transition-colors ${
              comparison === c.key
                ? "bg-[#0a8f57] text-[#ffffff] font-medium"
                : "bg-[#e8eaee] text-[#6e7682] hover:bg-[#dfe2e8]"
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
      <div className="mt-3 grid grid-cols-4 gap-2">
        {keyTenors.map((tenor) => {
          const current = yieldCurve.current[tenor];
          const prev =
            comparison && yieldCurve.historical[comparison]
              ? yieldCurve.historical[comparison][tenor]
              : null;
          const change = current != null && prev != null ? (current - prev) * 100 : null;

          return (
            <div key={tenor} className="bg-[#f6f7f9] rounded p-2 text-center">
              <div className="font-mono text-xs text-[#6e7682] mb-1">{tenor}</div>
              <div className="font-mono text-base font-bold text-[#0f1115]">
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
        <div className="mt-3 pt-2.5 border-t border-[#e8eaee]">
          <div className="font-mono text-xs text-[#6e7682] mb-2 tracking-wide">FORWARD RATES</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {yieldCurve.forward_rates.map((f) => (
              <div key={`${f.from}-${f.to}`} className="font-mono text-sm">
                <span className="text-[#6e7682]">{f.from}&rarr;{f.to}</span>
                <span className="text-[#1f2937] ml-2 font-medium">
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
