"use client";

import { motion } from "framer-motion";
import Panel, { DirectionArrow, ConvictionBar } from "./panel";

const SIGNAL_LABELS: Record<string, { label: string; color: string }> = {
  rate_direction: { label: "Rate Direction", color: "#62B0FF" },
  curve_shape: { label: "Curve Shape", color: "#00C8FF" },
  sector_allocation: { label: "Sector", color: "#FFA028" },
  duration_positioning: { label: "Duration", color: "#00D964" },
  credit_cycle: { label: "Credit Cycle", color: "#FFA028" },
  sentiment_bias: { label: "Sentiment", color: "#FF3EB5" },
};

export default function SignalConsole({
  signals,
}: {
  signals?: {
    signals: { signal_type: string; direction: number; conviction: number; source: string; rationale: string }[];
    aggregated: {
      composite_by_type: Record<string, { direction: number; conviction: number; count: number }>;
      overall_bias: { direction: number; conviction: number; description: string };
      signal_agreement: number;
      confidence_level: string;
      n_signals: number;
    };
  };
}) {
  if (!signals?.aggregated) {
    return (
      <Panel title="Signal Console" note="Directional reads across rates, curve, sectors and sentiment. Agreement and conviction show how aligned and strong the signals are." accent="#00D964">
        <div className="text-[#D89540] font-mono text-sm text-center py-8">No signals</div>
      </Panel>
    );
  }

  const { aggregated, signals: rawSignals } = signals;
  const bias = aggregated.overall_bias;
  const confColor: Record<string, string> = { high: "#00D964", medium: "#FFA028", low: "#FF4B4B" };

  return (
    <Panel title="Signal Console" note="Directional reads across rates, curve, sectors and sentiment. Agreement and conviction show how aligned and strong the signals are." subtitle={`${aggregated.n_signals} signals`} accent="#00D964">
      {/* Overall bias */}
      <div className="bg-[#141414] rounded p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <DirectionArrow direction={bias.direction} size="lg" />
            <span className="font-mono text-base text-[#E6E6E6] font-medium">{bias.description}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-mono text-xs text-[#E6E6E6]">Agreement</div>
              <div className="font-mono text-lg text-[#E6E6E6] font-bold">{aggregated.signal_agreement?.toFixed(0)}%</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs text-[#E6E6E6]">Confidence</div>
              <div className="font-mono text-lg font-bold uppercase" style={{ color: confColor[aggregated.confidence_level] || "#D89540" }}>
                {aggregated.confidence_level}
              </div>
            </div>
          </div>
        </div>
        <div className="h-2.5 bg-[#2E2E2E] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #FF4B4B, #FFA028, #00D964)" }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, bias.conviction || 0)}%` }}
            transition={{ duration: 1 }}
          />
        </div>
      </div>

      {/* Composite signals */}
      <div className="space-y-2">
        {Object.entries(aggregated.composite_by_type).map(([type, data], i) => {
          const meta = SIGNAL_LABELS[type] || { label: type, color: "#D89540" };
          return (
            <motion.div
              key={type}
              className="flex items-center gap-4 bg-[#141414] rounded px-4 py-3"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: meta.color }} />
              <div className="font-mono text-sm text-[#E6E6E6] w-28">{meta.label}</div>
              <DirectionArrow direction={data.direction} size="md" />
              <div className="flex-1">
                <ConvictionBar value={data.conviction} maxWidth={160} height={6} />
              </div>
              <div className="font-mono text-sm text-[#E6E6E6] w-10 text-right font-medium">{data.conviction?.toFixed(0)}</div>
              <div className="font-mono text-xs text-[#D89540]">({data.count})</div>
            </motion.div>
          );
        })}
      </div>

      {/* Expandable raw signals */}
      {rawSignals && rawSignals.length > 0 && (
        <details className="mt-4">
          <summary className="font-mono text-xs text-[#E6E6E6] cursor-pointer hover:text-[#D89540] transition-colors">
            View all {rawSignals.length} individual signals
          </summary>
          <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
            {rawSignals.map((sig, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2 bg-[#141414] rounded">
                <DirectionArrow direction={sig.direction} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs">
                    <span style={{ color: SIGNAL_LABELS[sig.signal_type]?.color || "#D89540" }}>
                      {sig.signal_type}
                    </span>
                    <span className="text-[#D89540] ml-2">{sig.source}</span>
                  </div>
                  <div className="font-mono text-xs text-[#D89540] mt-0.5 leading-relaxed">{sig.rationale}</div>
                </div>
                <div className="font-mono text-xs text-[#E6E6E6] shrink-0">{sig.conviction}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </Panel>
  );
}
