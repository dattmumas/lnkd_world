"use client";

import { motion } from "framer-motion";
import Panel, { DirectionArrow, ConvictionBar } from "./panel";

const SIGNAL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  rate_direction: { label: "RATE DIR", color: "#4a9eff" },
  curve_shape: { label: "CURVE", color: "#a855f7" },
  sector_allocation: { label: "SECTOR", color: "#fbbf24" },
  duration_positioning: { label: "DURATION", color: "#00ff88" },
  credit_cycle: { label: "CREDIT", color: "#f97316" },
  sentiment_bias: { label: "SENTIMENT", color: "#ec4899" },
};

export default function SignalConsole({
  signals,
}: {
  signals?: {
    signals: {
      signal_type: string;
      direction: number;
      conviction: number;
      source: string;
      rationale: string;
    }[];
    aggregated: {
      composite_by_type: Record<
        string,
        { direction: number; conviction: number; count: number }
      >;
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
        <div className="text-[#4a5568] font-mono text-xs text-center py-8">
          No signals generated
        </div>
      </Panel>
    );
  }

  const { aggregated, signals: rawSignals } = signals;
  const bias = aggregated.overall_bias;
  const confidenceColors: Record<string, string> = {
    high: "#00ff88",
    medium: "#fbbf24",
    low: "#ff6b6b",
  };

  return (
    <Panel title="Signal Console" subtitle={`${aggregated.n_signals} signals`} accent="#00ff88">
      {/* Overall bias bar */}
      <div className="bg-[#0f172a] rounded-sm p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DirectionArrow direction={bias.direction} size="lg" />
            <span className="font-mono text-sm text-[#e2e8f0]">
              {bias.description}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-[10px] text-[#4a5568]">AGREEMENT</div>
              <div className="font-mono text-sm text-[#e2e8f0]">
                {aggregated.signal_agreement?.toFixed(0)}%
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] text-[#4a5568]">CONFIDENCE</div>
              <div
                className="font-mono text-sm font-bold uppercase"
                style={{
                  color: confidenceColors[aggregated.confidence_level] || "#4a5568",
                }}
              >
                {aggregated.confidence_level}
              </div>
            </div>
          </div>
        </div>
        {/* Conviction meter */}
        <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, #ff6b6b, #fbbf24, #00ff88)`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, bias.conviction || 0)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Composite signals by type */}
      <div className="space-y-1.5">
        {Object.entries(aggregated.composite_by_type).map(([type, data], i) => {
          const meta = SIGNAL_TYPE_LABELS[type] || { label: type, color: "#4a5568" };
          return (
            <motion.div
              key={type}
              className="flex items-center gap-3 bg-[#0f172a] rounded-sm px-3 py-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div
                className="w-1 h-6 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              <div className="font-mono text-[10px] text-[#94a3b8] w-20 uppercase">
                {meta.label}
              </div>
              <DirectionArrow direction={data.direction} />
              <div className="flex-1">
                <ConvictionBar value={data.conviction} maxWidth={120} />
              </div>
              <div className="font-mono text-[10px] text-[#4a5568] w-12 text-right">
                {data.conviction?.toFixed(0)}
              </div>
              <div className="font-mono text-[10px] text-[#4a5568]">
                ({data.count})
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Individual signal details (collapsible) */}
      {rawSignals && rawSignals.length > 0 && (
        <details className="mt-3">
          <summary className="font-mono text-[10px] text-[#4a5568] cursor-pointer hover:text-[#94a3b8] transition-colors">
            VIEW ALL {rawSignals.length} SIGNALS
          </summary>
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {rawSignals.map((sig, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-2 py-1.5 bg-[#0f172a] rounded-sm"
              >
                <DirectionArrow direction={sig.direction} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-[#94a3b8]">
                    <span
                      className="uppercase"
                      style={{
                        color: SIGNAL_TYPE_LABELS[sig.signal_type]?.color || "#4a5568",
                      }}
                    >
                      {sig.signal_type}
                    </span>
                    <span className="text-[#4a5568] ml-1">&middot; {sig.source}</span>
                  </div>
                  <div className="font-mono text-[10px] text-[#4a5568] truncate">
                    {sig.rationale}
                  </div>
                </div>
                <div className="font-mono text-[10px] text-[#4a5568] shrink-0">
                  {sig.conviction}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </Panel>
  );
}
