"use client";

import { motion } from "framer-motion";
import Panel, { DirectionArrow, ConvictionBar } from "./panel";

const SIGNAL_LABELS: Record<string, { label: string; color: string }> = {
  rate_direction: { label: "Rate Direction", color: "#2563eb" },
  curve_shape: { label: "Curve Shape", color: "#0e9384" },
  sector_allocation: { label: "Sector", color: "#a86e15" },
  duration_positioning: { label: "Duration", color: "#0a8f57" },
  credit_cycle: { label: "Credit Cycle", color: "#e3700f" },
  sentiment_bias: { label: "Sentiment", color: "#d6307e" },
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
      <Panel title="Signal Console" note="Directional reads across rates, curve, sectors and sentiment. Agreement and conviction show how aligned and strong the signals are." accent="#0a8f57">
        <div className="text-[#6e7682] font-mono text-sm text-center py-8">No signals</div>
      </Panel>
    );
  }

  const { aggregated, signals: rawSignals } = signals;
  const bias = aggregated.overall_bias;
  const confColor: Record<string, string> = { high: "#0a8f57", medium: "#a86e15", low: "#d23b3b" };

  return (
    <Panel title="Signal Console" note="Directional reads across rates, curve, sectors and sentiment. Agreement and conviction show how aligned and strong the signals are." subtitle={`${aggregated.n_signals} signals`} accent="#0a8f57">
      {/* Overall bias */}
      <div className="bg-[#f6f7f9] rounded p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <DirectionArrow direction={bias.direction} size="lg" />
            <span className="font-mono text-base text-[#1f2937] font-medium">{bias.description}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-mono text-xs text-[#374151]">Agreement</div>
              <div className="font-mono text-lg text-[#1f2937] font-bold">{aggregated.signal_agreement?.toFixed(0)}%</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs text-[#374151]">Confidence</div>
              <div className="font-mono text-lg font-bold uppercase" style={{ color: confColor[aggregated.confidence_level] || "#6e7682" }}>
                {aggregated.confidence_level}
              </div>
            </div>
          </div>
        </div>
        <div className="h-2.5 bg-[#e8eaee] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #d23b3b, #a86e15, #0a8f57)" }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, bias.conviction || 0)}%` }}
            transition={{ duration: 1 }}
          />
        </div>
      </div>

      {/* Composite signals */}
      <div className="space-y-2">
        {Object.entries(aggregated.composite_by_type).map(([type, data], i) => {
          const meta = SIGNAL_LABELS[type] || { label: type, color: "#6e7682" };
          return (
            <motion.div
              key={type}
              className="flex items-center gap-4 bg-[#f6f7f9] rounded px-4 py-3"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: meta.color }} />
              <div className="font-mono text-sm text-[#374151] w-28">{meta.label}</div>
              <DirectionArrow direction={data.direction} size="md" />
              <div className="flex-1">
                <ConvictionBar value={data.conviction} maxWidth={160} height={6} />
              </div>
              <div className="font-mono text-sm text-[#1f2937] w-10 text-right font-medium">{data.conviction?.toFixed(0)}</div>
              <div className="font-mono text-xs text-[#6e7682]">({data.count})</div>
            </motion.div>
          );
        })}
      </div>

      {/* Expandable raw signals */}
      {rawSignals && rawSignals.length > 0 && (
        <details className="mt-4">
          <summary className="font-mono text-xs text-[#374151] cursor-pointer hover:text-[#6e7682] transition-colors">
            View all {rawSignals.length} individual signals
          </summary>
          <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
            {rawSignals.map((sig, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2 bg-[#f6f7f9] rounded">
                <DirectionArrow direction={sig.direction} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs">
                    <span style={{ color: SIGNAL_LABELS[sig.signal_type]?.color || "#6e7682" }}>
                      {sig.signal_type}
                    </span>
                    <span className="text-[#6e7682] ml-2">{sig.source}</span>
                  </div>
                  <div className="font-mono text-xs text-[#6e7682] mt-0.5 leading-relaxed">{sig.rationale}</div>
                </div>
                <div className="font-mono text-xs text-[#374151] shrink-0">{sig.conviction}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </Panel>
  );
}
