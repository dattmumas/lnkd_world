"use client";

import { motion } from "framer-motion";
import Panel, { ConvictionBar, DirectionArrow } from "./panel";

const TRADE_TYPE_COLORS: Record<string, string> = {
  duration: "#4a9eff",
  curve: "#a855f7",
  sector: "#fbbf24",
  relative_value: "#00ff88",
};

export default function TradeIdeas({
  signals,
}: {
  signals?: {
    trade_ideas: {
      trade_type: string;
      action: string;
      entry_rationale: string;
      risk: string;
      horizon: string;
      expected_pnl_bps: number;
      stop_loss_trigger: string;
      conviction: number;
    }[];
  };
}) {
  const ideas = signals?.trade_ideas;

  if (!ideas || ideas.length === 0) {
    return (
      <Panel title="Trade Ideas" accent="#fbbf24">
        <div className="text-[#4a5568] font-mono text-xs text-center py-8">
          No trade ideas generated
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Trade Ideas" subtitle={`${ideas.length} active`} accent="#fbbf24">
      <div className="space-y-2">
        {ideas.slice(0, 5).map((idea, i) => {
          const color = TRADE_TYPE_COLORS[idea.trade_type] || "#4a5568";

          return (
            <motion.div
              key={i}
              className="bg-[#0f172a] rounded-sm p-3 border-l-2"
              style={{ borderLeftColor: color }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <span
                    className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm uppercase"
                    style={{
                      backgroundColor: color + "20",
                      color: color,
                    }}
                  >
                    {idea.trade_type}
                  </span>
                  <span className="font-mono text-[9px] text-[#4a5568] ml-2">
                    {idea.horizon}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ConvictionBar value={idea.conviction} maxWidth={60} />
                  <span className="font-mono text-[10px] text-[#94a3b8]">
                    {idea.conviction}
                  </span>
                </div>
              </div>

              {/* Action */}
              <div className="font-mono text-[11px] text-[#e2e8f0] mb-1.5 leading-relaxed">
                {idea.action}
              </div>

              {/* Details */}
              <div className="space-y-1">
                <div className="font-mono text-[9px] text-[#4a5568]">
                  <span className="text-[#00ff88]">ENTRY:</span>{" "}
                  {idea.entry_rationale}
                </div>
                <div className="font-mono text-[9px] text-[#4a5568]">
                  <span className="text-[#ff6b6b]">RISK:</span> {idea.risk}
                </div>
                <div className="font-mono text-[9px] text-[#4a5568]">
                  <span className="text-[#fbbf24]">STOP:</span>{" "}
                  {idea.stop_loss_trigger}
                </div>
              </div>

              {/* Expected P&L */}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="font-mono text-[9px] text-[#4a5568]">
                  EXP. P&L:
                </span>
                <span className="font-mono text-[10px] text-[#00ff88]">
                  +{idea.expected_pnl_bps?.toFixed(0) || "?"}bp
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
