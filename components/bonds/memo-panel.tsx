"use client";

import { useState } from "react";
import Panel from "./panel";

export default function MemoPanel({
  signals,
}: {
  signals?: {
    memo: {
      report_date: string;
      executive_summary: string;
      market_regime: {
        overall_direction: number;
        overall_conviction: number;
        key_indicators: string[];
        confidence_level: string;
      };
      signal_summary: {
        signal_type: string;
        direction: string;
        conviction: number;
        source: string;
        rationale: string;
      }[];
      risk_factors: string[];
    };
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const memo = signals?.memo;

  if (!memo) {
    return (
      <Panel title="Investment Memo" note="Plain-language synthesis of the signals above into a narrative read and recommendation.">
        <div className="text-[#FB8B1E] font-mono text-xs text-center py-4">
          No memo generated
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Investment Memo" note="Plain-language synthesis of the signals above into a narrative read and recommendation.">
      {/* Executive summary */}
      <div className="font-mono text-[10px] text-[#FB8B1E] mb-0.5">EXECUTIVE SUMMARY</div>
      <div className="font-mono text-[12px] text-[#F6F3E8] leading-relaxed mb-2">
        {memo.executive_summary}
      </div>

      {/* Key indicators */}
      {memo.market_regime?.key_indicators && memo.market_regime.key_indicators.length > 0 && (
        <div className="mb-2 pt-1.5 border-t border-[#1F1F1F]">
          <div className="font-mono text-[10px] text-[#FB8B1E] mb-0.5">KEY INDICATORS</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4">
            {memo.market_regime.key_indicators.map((ind, i) => (
              <div key={i} className="font-mono text-[11px] text-[#F6F3E8] py-px">
                <span className="text-[#FB8B1E]">&#9656;</span> {ind}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable detail */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="font-mono text-[11px] text-[#54A8FF] hover:text-[#8FC7FF] cursor-pointer"
      >
        {expanded ? "▼ COLLAPSE DETAILS" : "▶ EXPAND DETAILS"}
      </button>

      {expanded && (
        <div>
          {/* Signal summary table */}
          {memo.signal_summary && memo.signal_summary.length > 0 && (
            <div className="mt-2">
              <div className="font-mono text-[10px] text-[#FB8B1E] mb-0.5">SIGNAL TABLE</div>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-[11px]">
                  <thead>
                    <tr className="text-[#FB8B1E] text-left border-b border-[#2E2E2E]">
                      <th className="pr-4 py-0.5 font-normal">TYPE</th>
                      <th className="pr-4 py-0.5 font-normal">DIR</th>
                      <th className="pr-4 py-0.5 font-normal">CONV</th>
                      <th className="pr-4 py-0.5 font-normal">SOURCE</th>
                      <th className="py-0.5 font-normal">RATIONALE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memo.signal_summary.map((sig, i) => (
                      <tr key={i} className="border-b border-[#1C1C1C]">
                        <td className="pr-4 py-[3px] text-[#FB8B1E] uppercase">
                          {sig.signal_type}
                        </td>
                        <td className="pr-4 py-[3px] uppercase">
                          <span
                            style={{
                              color:
                                sig.direction === "bullish"
                                  ? "#00C25B"
                                  : sig.direction === "bearish"
                                    ? "#FF433D"
                                    : "#FB8B1E",
                            }}
                          >
                            {sig.direction}
                          </span>
                        </td>
                        <td className="pr-4 py-[3px] text-[#F6F3E8] tabular-nums">{sig.conviction}</td>
                        <td className="pr-4 py-[3px] text-[#A5A095]">{sig.source}</td>
                        <td className="py-[3px] text-[#A5A095] max-w-xs truncate">
                          {sig.rationale}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Risk factors */}
          {memo.risk_factors && memo.risk_factors.length > 0 && (
            <div className="mt-2 pt-1.5 border-t border-[#1F1F1F]">
              <div className="font-mono text-[10px] text-[#FF433D] mb-0.5">RISK FACTORS</div>
              {memo.risk_factors.map((risk, i) => (
                <div key={i} className="font-mono text-[11px] text-[#A5A095] leading-snug py-px">
                  <span className="text-[#FF433D]">{"⚠"}</span> {risk}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
