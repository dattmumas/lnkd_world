"use client";

import Panel, { ConvictionBar } from "./panel";

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
      <Panel title="Trade Ideas" note="Model-suggested trades with rationale and horizon. Ideas to research, not advice - size to your own risk.">
        <div className="text-[#FB8B1E] font-mono text-sm text-center py-8">No trade ideas</div>
      </Panel>
    );
  }

  return (
    <Panel title="Trade Ideas" note="Model-suggested trades with rationale and horizon. Ideas to research, not advice - size to your own risk." subtitle={`${ideas.length} active`}>
      {ideas.slice(0, 4).map((idea, i) => {
        return (
          <div
            key={i}
            className={`py-1.5 font-mono ${i > 0 ? "border-t border-[#1F1F1F]" : "pt-0"}`}
          >
            {/* Header line */}
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="text-[10px] uppercase">
                <span className="font-bold text-[#FB8B1E]">
                  [{idea.trade_type.replace("_", " ")}]
                </span>
                <span className="text-[#7C7C7C] ml-2">{idea.horizon}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ConvictionBar value={idea.conviction} />
                <span className="text-[11px] text-[#F6F3E8] font-bold tabular-nums">
                  {idea.conviction}
                </span>
              </div>
            </div>

            {/* Action */}
            <div className="text-[12px] text-[#F6F3E8] font-bold mb-1 leading-snug">
              {idea.action}
            </div>

            {/* Details */}
            <div className="space-y-px text-[10px] leading-snug text-[#A5A095]">
              <div>
                <span className="text-[#00C25B]">ENTRY</span> {idea.entry_rationale}
              </div>
              <div>
                <span className="text-[#FF433D]">RISK </span> {idea.risk}
              </div>
              <div>
                <span className="text-[#FB8B1E]">STOP </span> {idea.stop_loss_trigger}
              </div>
              <div>
                <span className="text-[#FB8B1E]">EXP P&L</span>{" "}
                <span className="text-[#00C25B] tabular-nums">
                  +{idea.expected_pnl_bps?.toFixed(0) || "?"}bp
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
