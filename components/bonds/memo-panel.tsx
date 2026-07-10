"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
      <Panel title="Investment Memo" note="Plain-language synthesis of the signals above into a narrative read and recommendation." accent="#00C8FF">
        <div className="text-[#D89540] font-mono text-xs text-center py-4">
          No memo generated
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Investment Memo" note="Plain-language synthesis of the signals above into a narrative read and recommendation." accent="#00C8FF">
      {/* Executive summary with typewriter-style reveal */}
      <div className="bg-[#141414] rounded p-3.5 mb-4 border-l-3 border-[#00C8FF]" style={{ borderLeftWidth: 3, borderLeftColor: "#00C8FF" }}>
        <div className="font-mono text-xs text-[#00C8FF] mb-2 tracking-widest">
          EXECUTIVE SUMMARY
        </div>
        <motion.div
          className="font-mono text-sm text-[#E6E6E6] leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          {memo.executive_summary}
        </motion.div>
      </div>

      {/* Key indicators */}
      {memo.market_regime?.key_indicators && memo.market_regime.key_indicators.length > 0 && (
        <div className="mb-4">
          <div className="font-mono text-xs text-[#E6E6E6] mb-2">
            KEY INDICATORS
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {memo.market_regime.key_indicators.map((ind, i) => (
              <motion.div
                key={i}
                className="bg-[#141414] rounded px-3 py-2 font-mono text-xs text-[#D89540]"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                {ind}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable detail */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="font-mono text-xs text-[#62B0FF] hover:text-[#62B0FF] transition-colors cursor-pointer"
      >
        {expanded ? "\u25BC COLLAPSE DETAILS" : "\u25B6 EXPAND DETAILS"}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Signal summary table */}
            {memo.signal_summary && memo.signal_summary.length > 0 && (
              <div className="mt-4">
                <div className="font-mono text-xs text-[#E6E6E6] mb-2">
                  SIGNAL TABLE
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs">
                    <thead>
                      <tr className="text-[#E6E6E6] text-left">
                        <th className="pr-4 py-2">Type</th>
                        <th className="pr-4 py-2">Dir</th>
                        <th className="pr-4 py-2">Conv</th>
                        <th className="pr-4 py-2">Source</th>
                        <th className="py-2">Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memo.signal_summary.map((sig, i) => (
                        <tr
                          key={i}
                          className="border-t border-[#2E2E2E] text-[#D89540]"
                        >
                          <td className="pr-4 py-2 text-[#62B0FF]">
                            {sig.signal_type}
                          </td>
                          <td className="pr-4 py-2">
                            <span
                              style={{
                                color:
                                  sig.direction === "bullish"
                                    ? "#00D964"
                                    : sig.direction === "bearish"
                                      ? "#FF4B4B"
                                      : "#D89540",
                              }}
                            >
                              {sig.direction}
                            </span>
                          </td>
                          <td className="pr-4 py-2">{sig.conviction}</td>
                          <td className="pr-4 py-2 text-[#D89540]">{sig.source}</td>
                          <td className="py-2 text-[#D89540] max-w-xs truncate">
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
              <div className="mt-4 pt-3 border-t border-[#2E2E2E]">
                <div className="font-mono text-xs text-[#FF4B4B] mb-2">
                  RISK FACTORS
                </div>
                <div className="space-y-1.5">
                  {memo.risk_factors.map((risk, i) => (
                    <div
                      key={i}
                      className="font-mono text-xs text-[#D89540] leading-relaxed"
                    >
                      <span className="text-[#FF4B4B]">{"\u26A0"}</span> {risk}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
