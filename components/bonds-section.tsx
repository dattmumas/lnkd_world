"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";
import Link from "next/link";
import Section from "@/components/section";

/**
 * Compact bond market summary for the homepage.
 * Shows regime, top signal, and key rates — links to /bonds for the full terminal.
 */
export default function BondsSection() {
  const snapshot = useQuery(api.bonds.latest);

  const data = useMemo(() => {
    if (!snapshot?.data) return null;
    try {
      return JSON.parse(snapshot.data);
    } catch {
      return null;
    }
  }, [snapshot?.data]);

  // Don't render if no data yet
  if (!data) return null;

  const yc = data.yield_curve?.current;
  const regime = data.model?.regime;
  const bias = data.signals?.aggregated?.overall_bias;
  const topTrade = data.signals?.trade_ideas?.[0];

  // Key tenor values
  const tenors = ["2Y", "5Y", "10Y", "30Y"];
  const spread2s10s =
    yc?.["10Y"] != null && yc?.["2Y"] != null
      ? ((yc["10Y"] - yc["2Y"]) * 100).toFixed(0)
      : null;

  const biasColor =
    bias?.direction === 1
      ? "#00ff88"
      : bias?.direction === -1
        ? "#ff6b6b"
        : "#94a3b8";

  return (
    <Section title="Bond Market" viewAllHref="/bonds">
      {/* Compact dark card */}
      <Link href="/bonds" className="block group">
        <div className="bg-[#111827] rounded-lg border border-[#1e293b] p-4 hover:border-[#4a9eff] transition-colors">
          {/* Top row: Regime + Bias */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {regime?.current && (
                <span className="font-mono text-[10px] bg-[#0f172a] text-[#94a3b8] px-2 py-0.5 rounded-sm uppercase">
                  {regime.current}
                </span>
              )}
              {bias && (
                <span
                  className="font-mono text-[10px] px-2 py-0.5 rounded-sm"
                  style={{ color: biasColor, backgroundColor: biasColor + "15" }}
                >
                  {bias.description}
                </span>
              )}
            </div>
            <span className="font-mono text-[9px] text-[#4a5568]">
              {data.generated_at
                ? new Date(data.generated_at).toLocaleDateString()
                : ""}
            </span>
          </div>

          {/* Yield curve mini bar */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {tenors.map((tenor) => (
              <div key={tenor} className="text-center">
                <div className="font-mono text-[9px] text-[#4a5568]">{tenor}</div>
                <div className="font-mono text-sm text-[#e2e8f0]">
                  {yc?.[tenor] != null ? `${yc[tenor].toFixed(2)}%` : "--"}
                </div>
              </div>
            ))}
          </div>

          {/* 2s10s spread */}
          {spread2s10s && (
            <div className="flex items-center justify-between font-mono text-[10px] mb-2">
              <span className="text-[#4a5568]">2s10s Spread</span>
              <span
                className="text-[#94a3b8]"
                style={{
                  color:
                    Number(spread2s10s) < 0 ? "#ff6b6b" : "#00ff88",
                }}
              >
                {Number(spread2s10s) > 0 ? "+" : ""}
                {spread2s10s}bp
              </span>
            </div>
          )}

          {/* Top trade idea teaser */}
          {topTrade && (
            <div className="pt-2 border-t border-[#1e293b] font-mono text-[10px]">
              <span className="text-[#fbbf24]">TOP IDEA:</span>{" "}
              <span className="text-[#94a3b8]">
                {topTrade.action?.slice(0, 80)}
                {topTrade.action?.length > 80 ? "..." : ""}
              </span>
            </div>
          )}

          {/* View terminal CTA */}
          <div className="mt-3 text-center font-mono text-[10px] text-[#4a9eff] group-hover:text-[#7ac3ff] transition-colors">
            OPEN TERMINAL \u2192
          </div>
        </div>
      </Link>
    </Section>
  );
}
