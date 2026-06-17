"use client";

import { motion } from "framer-motion";
import Panel, { DirectionArrow, ConvictionBar } from "./panel";

const SIGNAL_LABELS: Record<string, { label: string; color: string }> = {
  rate_direction: { label: "Rate Direction", color: "#4a9eff" },
  curve_shape: { label: "Curve Shape", color: "#a855f7" },
  sector_allocation: { label: "Sector", color: "#fbbf24" },
  duration_positioning: { label: "Duration", color: "#00ff88" },
  credit_cycle: { label: "Credit Cycle", color: "#f97316" },
  sentiment_bias: { label: "Sentiment", color: "#ec4899" },
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
      <Panel title="Signal Console" accent="#00ff88">
        <div className="text-[#94a3b8] font-mono text-sm text-center py-12">No signals</div>
      </Panel>
    );
  }

  const { aggregated, signals: rawSignals } = signals;
  const bias = aggregated.overall_bias;
  const confColor: Record<string, string> = { high: "#00ff88", medium: "#fbbf24", low: "#ff6b6b" };

  return (
    <Panel title="Signal Console" subtitle={`${aggregated.n_signals} signals`} accent="#00ff88">
      {/* Overall bias */}
      <div className="bg-[#0f172a] rounded p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <DirectionArrow direction={bias.direction} size="lg" />
            <span className="font-mono text-base text-[#e2e8f0] font-medium">{bias.description}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="font-mono text-xs text-[#cbd5e1]">Agreement</div>
              <div className="font-mono text-lg text-[#e2e8f0] font-bold">{aggregated.signal_agreement?.toFixed(0)}%</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs text-[#cbd5e1]">Confidence</div>
              <div className="font-mono text-lg font-bold uppercase" style={{ color: confColor[aggregated.confidence_level] || "#94a3b8" }}>
                {aggregated.confidence_level}
              </div>
            </div>
          </div>
        </div>
        <div className="h-2.5 bg-[#1e293b] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #ff6b6b, #fbbf24, #00ff88)" }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, bias.conviction || 0)}%` }}
            transition={{ duration: 1 }}
          />
        </div>
      </div>

      {/* Composite signals */}
      <div className="space-y-2">
        {Object.entries(aggregated.composite_by_type).map(([type, data], i) => {
          const meta = SIGNAL_LABELS[type] || { label: type, color: "#94a3b8" };
          return (
            <motion.div
              key={type}
              className="flex items-center gap-4 bg-[#0f172a] rounded px-4 py-3"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: meta.color }} />
              <div className="font-mono text-sm text-[#cbd5e1] w-28">{meta.label}</div>
              <DirectionArrow direction={data.direction} size="md" />
              <div className="flex-1">
                <ConvictionBar value={data.conviction} maxWidth={160} height={6} />
              </div>
              <div className="font-mono text-sm text-[#e2e8f0] w-10 text-right font-medium">{data.conviction?.toFixed(0)}</div>
              <div className="font-mono text-xs text-[#94a3b8]">({data.count})</div>
            </motion.div>
          );
        })}
      </div>

      {/* Expandable raw signals */}
      {rawSignals && rawSignals.length > 0 && (
        <details className="mt-4">
          <summary className="font-mono text-xs text-[#cbd5e1] cursor-pointer hover:text-[#94a3b8] transition-colors">
            View all {rawSignals.length} individual signals
          </summary>
          <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
            {rawSignals.map((sig, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2 bg-[#0f172a] rounded">
                <DirectionArrow direction={sig.direction} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs">
                    <span style={{ color: SIGNAL_LABELS[sig.signal_type]?.color || "#94a3b8" }}>
                      {sig.signal_type}
                    </span>
                    <span className="text-[#94a3b8] ml-2">{sig.source}</span>
                  </div>
                  <div className="font-mono text-xs text-[#94a3b8] mt-0.5 leading-relaxed">{sig.rationale}</div>
                </div>
                <div className="font-mono text-xs text-[#cbd5e1] shrink-0">{sig.conviction}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </Panel>
  );
}
