"use client";

import { motion } from "framer-motion";
import Panel, { ConvictionBar } from "./panel";

const TYPE_COLORS: Record<string, string> = {
  duration: "#2563eb",
  curve: "#0e9384",
  sector: "#a86e15",
  relative_value: "#0a8f57",
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
      <Panel title="Trade Ideas" note="Model-suggested trades with rationale and horizon. Ideas to research, not advice - size to your own risk." accent="#a86e15">
        <div className="text-[#6e7682] font-mono text-sm text-center py-8">No trade ideas</div>
      </Panel>
    );
  }

  return (
    <Panel title="Trade Ideas" note="Model-suggested trades with rationale and horizon. Ideas to research, not advice - size to your own risk." subtitle={`${ideas.length} active`} accent="#a86e15">
      <div className="space-y-3">
        {ideas.slice(0, 4).map((idea, i) => {
          const color = TYPE_COLORS[idea.trade_type] || "#6e7682";

          return (
            <motion.div
              key={i}
              className="bg-[#f6f7f9] rounded p-4 border-l-3"
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
                  <span className="font-mono text-xs text-[#374151]">{idea.horizon}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ConvictionBar value={idea.conviction} maxWidth={80} height={5} />
                  <span className="font-mono text-sm text-[#6e7682] font-medium">{idea.conviction}</span>
                </div>
              </div>

              {/* Action */}
              <div className="font-mono text-sm text-[#0f1115] mb-3 leading-relaxed">
                {idea.action}
              </div>

              {/* Details grid */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="text-[#374151]">
                  <span className="text-[#0a8f57] font-medium">ENTRY</span>{" "}
                  {idea.entry_rationale}
                </div>
                <div className="text-[#374151]">
                  <span className="text-[#d23b3b] font-medium">RISK</span>{" "}
                  {idea.risk}
                </div>
                <div className="text-[#374151]">
                  <span className="text-[#a86e15] font-medium">STOP</span>{" "}
                  {idea.stop_loss_trigger}
                </div>
              </div>

              {/* Expected P&L */}
              <div className="mt-2 pt-2 border-t border-[#e8eaee] flex items-center gap-2">
                <span className="font-mono text-xs text-[#374151]">Expected P&L:</span>
                <span className="font-mono text-sm text-[#0a8f57] font-medium">
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
