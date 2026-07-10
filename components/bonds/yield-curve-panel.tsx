"use client";

import { useState } from "react";
import Panel, { ChangeBadge } from "./panel";

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
  const pad = { top: 10, right: 16, bottom: 22, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  if (!curvePoints || curvePoints.length < 2) {
    return (
      <div className="text-[#FB8B1E] font-mono text-sm text-center py-10">
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
          <line x1={pad.left} x2={width - pad.right} y1={sy(tick)} y2={sy(tick)} stroke="#1F1F1F" strokeWidth={0.5} />
          <text x={pad.left - 8} y={sy(tick)} textAnchor="end" dominantBaseline="middle" fill="#A5A095" fontSize={8.5} fontFamily="monospace">
            {tick.toFixed(2)}
          </text>
        </g>
      ))}

      {/* X labels */}
      {curvePoints.map((p) => (
        <text key={p.tenor} x={sx(p.years)} y={height - 8} textAnchor="middle" fill="#A5A095" fontSize={8.5} fontFamily="monospace">
          {p.tenor}
        </text>
      ))}

      {/* Comparison curve */}
      {compPath && (
        <path
          d={compPath}
          fill="none"
          stroke="#54A8FF"
          strokeWidth={1}
          strokeDasharray="4,3"
          opacity={0.8}
        />
      )}

      {/* Main curve */}
      <path d={currentPath} fill="none" stroke="#FB8B1E" strokeWidth={1.5} />

      {/* Data points */}
      {curvePoints.map((p) => (
        <rect
          key={p.tenor}
          x={sx(p.years) - 1.75}
          y={sy(p.yield) - 1.75}
          width={3.5}
          height={3.5}
          fill="#F6F3E8"
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
      <Panel title="Yield Curve">
        <div className="text-[#FB8B1E] font-mono text-sm text-center py-10">No yield curve data</div>
      </Panel>
    );
  }

  const comparisons = [
    { key: "1w", label: "1W" },
    { key: "1m", label: "1M" },
    { key: "3m", label: "3M" },
    { key: "1y", label: "1Y" },
  ];

  const keyTenors = ["2Y", "5Y", "10Y", "30Y"];

  return (
    <Panel
      title="US Treasury Yield Curve"
      subtitle={yieldCurve.as_of ? new Date(yieldCurve.as_of).toLocaleDateString() : undefined}
      note="Treasury yield at each maturity. A normal curve slopes up; when it inverts (short rates above long), it has historically preceded recessions. Toggle a date to compare."
    >
      <div className="lg:flex lg:items-stretch lg:gap-4">
        <div className="flex-1 min-w-0">
          {/* Comparison toggles */}
          <div className="flex items-center gap-1 mb-1.5 font-mono text-[10px]">
            <span className="text-[#FB8B1E] mr-1 uppercase">Compare</span>
            {comparisons.map((c) => (
              <button
                key={c.key}
                onClick={() => setComparison(comparison === c.key ? null : c.key)}
                className={`px-2 py-px border font-bold ${
                  comparison === c.key
                    ? "bg-[#FB8B1E] text-[#000000] border-[#FB8B1E]"
                    : "text-[#FB8B1E] border-[#2E2E2E] hover:border-[#FB8B1E]"
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
        </div>

        {/* Key tenors + forwards, right rail on wide screens */}
        <div className="mt-2 lg:mt-0 lg:w-72 lg:shrink-0 lg:border-l lg:border-[#1F1F1F] lg:pl-4 font-mono">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[#FB8B1E] border-b border-[#2E2E2E]">
                <th className="py-0.5 font-normal">TENOR</th>
                <th className="py-0.5 font-normal text-right">YLD</th>
                <th className="py-0.5 font-normal text-right">
                  CHG{comparison ? ` v ${comparison.toUpperCase()}` : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {keyTenors.map((tenor) => {
                const current = yieldCurve.current[tenor];
                const prev =
                  comparison && yieldCurve.historical[comparison]
                    ? yieldCurve.historical[comparison][tenor]
                    : null;
                const change = current != null && prev != null ? (current - prev) * 100 : null;

                return (
                  <tr key={tenor} className="border-b border-[#1C1C1C]">
                    <td className="py-[3px] text-[#E0C010] font-bold">{tenor}</td>
                    <td className="py-[3px] text-right text-[#F6F3E8] font-bold tabular-nums">
                      {current != null ? current.toFixed(2) : "--"}
                    </td>
                    <td className="py-[3px] text-right">
                      {change != null ? (
                        <ChangeBadge value={change} suffix="bp" decimals={0} />
                      ) : (
                        <span className="text-[#7C7C7C]">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Forward rates */}
          {yieldCurve.forward_rates && yieldCurve.forward_rates.length > 0 && (
            <div className="mt-1.5">
              <div className="text-[10px] text-[#FB8B1E] mb-0.5">FWD RATES</div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                {yieldCurve.forward_rates.map((f) => (
                  <div key={`${f.from}-${f.to}`}>
                    <span className="text-[#A5A095]">{f.from}&rarr;{f.to}</span>
                    <span className="text-[#F6F3E8] ml-1.5 tabular-nums">
                      {f.rate != null ? f.rate.toFixed(2) : "--"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
