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
      <Panel title="Investment Memo" accent="#a855f7">
        <div className="text-[#94a3b8] font-mono text-xs text-center py-4">
          No memo generated
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Investment Memo" accent="#a855f7">
      {/* Executive summary with typewriter-style reveal */}
      <div className="bg-[#0f172a] rounded p-5 mb-4 border-l-3 border-[#a855f7]" style={{ borderLeftWidth: 3, borderLeftColor: "#a855f7" }}>
        <div className="font-mono text-xs text-[#a855f7] mb-2 tracking-widest">
          EXECUTIVE SUMMARY
        </div>
        <motion.div
          className="font-mono text-sm text-[#f1f5f9] leading-relaxed"
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
          <div className="font-mono text-xs text-[#cbd5e1] mb-2">
            KEY INDICATORS
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {memo.market_regime.key_indicators.map((ind, i) => (
              <motion.div
                key={i}
                className="bg-[#0f172a] rounded px-3 py-2 font-mono text-xs text-[#94a3b8]"
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
        className="font-mono text-xs text-[#4a9eff] hover:text-[#7ac3ff] transition-colors cursor-pointer"
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
                <div className="font-mono text-xs text-[#cbd5e1] mb-2">
                  SIGNAL TABLE
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs">
                    <thead>
                      <tr className="text-[#cbd5e1] text-left">
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
                          className="border-t border-[#1e293b] text-[#94a3b8]"
                        >
                          <td className="pr-4 py-2 text-[#4a9eff]">
                            {sig.signal_type}
                          </td>
                          <td className="pr-4 py-2">
                            <span
                              style={{
                                color:
                                  sig.direction === "bullish"
                                    ? "#00ff88"
                                    : sig.direction === "bearish"
                                      ? "#ff6b6b"
                                      : "#94a3b8",
                              }}
                            >
                              {sig.direction}
                            </span>
                          </td>
                          <td className="pr-4 py-2">{sig.conviction}</td>
                          <td className="pr-4 py-2 text-[#94a3b8]">{sig.source}</td>
                          <td className="py-2 text-[#94a3b8] max-w-xs truncate">
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
              <div className="mt-4 pt-3 border-t border-[#1e293b]">
                <div className="font-mono text-xs text-[#ff6b6b] mb-2">
                  RISK FACTORS
                </div>
                <div className="space-y-1.5">
                  {memo.risk_factors.map((risk, i) => (
                    <div
                      key={i}
                      className="font-mono text-xs text-[#94a3b8] leading-relaxed"
                    >
                      <span className="text-[#ff6b6b]">{"\u26A0"}</span> {risk}
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
