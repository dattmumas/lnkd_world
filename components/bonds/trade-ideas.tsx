"use client";

import { motion } from "framer-motion";
import Panel, { ConvictionBar } from "./panel";

const TYPE_COLORS: Record<string, string> = {
  duration: "#62B0FF",
  curve: "#00C8FF",
  sector: "#FFA028",
  relative_value: "#00D964",
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
      <Panel title="Trade Ideas" note="Model-suggested trades with rationale and horizon. Ideas to research, not advice - size to your own risk." accent="#FFA028">
        <div className="text-[#D89540] font-mono text-sm text-center py-8">No trade ideas</div>
      </Panel>
    );
  }

  return (
    <Panel title="Trade Ideas" note="Model-suggested trades with rationale and horizon. Ideas to research, not advice - size to your own risk." subtitle={`${ideas.length} active`} accent="#FFA028">
      <div className="space-y-3">
        {ideas.slice(0, 4).map((idea, i) => {
          const color = TYPE_COLORS[idea.trade_type] || "#D89540";

          return (
            <motion.div
              key={i}
              className="bg-[#141414] rounded p-4 border-l-3"
              style={{ borderLeftWidth: 3, borderLeftColor: color }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[11px] px-2 py-0.5 rounded uppercase font-medium"
                    style={{ backgroundColor: color + "20", color }}
                  >
                    {idea.trade_type}
                  </span>
                  <span className="font-mono text-xs text-[#E6E6E6]">{idea.horizon}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ConvictionBar value={idea.conviction} maxWidth={80} height={5} />
                  <span className="font-mono text-sm text-[#D89540] font-medium">{idea.conviction}</span>
                </div>
              </div>

              {/* Action */}
              <div className="font-mono text-sm text-[#E6E6E6] mb-3 leading-relaxed">
                {idea.action}
              </div>

              {/* Details grid */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="text-[#E6E6E6]">
                  <span className="text-[#00D964] font-medium">ENTRY</span>{" "}
                  {idea.entry_rationale}
                </div>
                <div className="text-[#E6E6E6]">
                  <span className="text-[#FF4B4B] font-medium">RISK</span>{" "}
                  {idea.risk}
                </div>
                <div className="text-[#E6E6E6]">
                  <span className="text-[#FFA028] font-medium">STOP</span>{" "}
                  {idea.stop_loss_trigger}
                </div>
              </div>

              {/* Expected P&L */}
              <div className="mt-2 pt-2 border-t border-[#2E2E2E] flex items-center gap-2">
                <span className="font-mono text-xs text-[#E6E6E6]">Expected P&L:</span>
                <span className="font-mono text-sm text-[#00D964] font-medium">
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
