"use client";

import { motion } from "framer-motion";
import Panel from "./panel";

export default function SentimentGauge({
  sentiment,
}: {
  sentiment?: {
    composite_score: number;
    direction: string;
    confidence: string;
    source: string;
    components?: Record<string, number>;
  };
}) {
  if (!sentiment) {
    return (
      <Panel title="Sentiment" accent="#ec4899">
        <div className="text-[#94a3b8] font-mono text-xs text-center py-8">
          No sentiment data
        </div>
      </Panel>
    );
  }

  const score = sentiment.composite_score || 0;
  const normalizedScore = Math.max(-1, Math.min(1, score));
  const gaugePosition = ((normalizedScore + 1) / 2) * 100;

  const sentimentColor =
    normalizedScore > 0.2
      ? "#00ff88"
      : normalizedScore < -0.2
        ? "#ff6b6b"
        : "#fbbf24";

  const sentimentLabel =
    normalizedScore > 0.5
      ? "STRONGLY BULLISH"
      : normalizedScore > 0.2
        ? "BULLISH"
        : normalizedScore > -0.2
          ? "NEUTRAL"
          : normalizedScore > -0.5
            ? "BEARISH"
            : "STRONGLY BEARISH";

  return (
    <Panel title="Market Sentiment" accent="#ec4899">
      {/* Sentiment arc gauge */}
      <div className="flex justify-center mb-5">
        <svg viewBox="0 0 200 120" className="w-full max-w-[240px]">
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#1e293b"
            strokeWidth={14}
            strokeLinecap="round"
          />
          {/* Gradient arc */}
          <defs>
            <linearGradient id="sentimentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff6b6b" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#00ff88" />
            </linearGradient>
          </defs>
          <motion.path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="url(#sentimentGrad)"
            strokeWidth={14}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
          {/* Needle */}
          <motion.g
            initial={{ rotate: -90 }}
            animate={{ rotate: -90 + gaugePosition * 1.8 }}
            transition={{ duration: 1.5, type: "spring" }}
            style={{ transformOrigin: "100px 100px" }}
          >
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="30"
              stroke={sentimentColor}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r={5} fill={sentimentColor} />
          </motion.g>
          {/* Score text */}
          <text
            x="100"
            y="88"
            textAnchor="middle"
            className="text-[20px] font-bold"
            fontFamily="monospace"
            fill={sentimentColor}
          >
            {normalizedScore > 0 ? "+" : ""}
            {normalizedScore.toFixed(2)}
          </text>
        </svg>
      </div>

      {/* Label */}
      <div className="text-center mb-4">
        <motion.div
          className="font-mono text-sm tracking-widest font-medium"
          style={{ color: sentimentColor }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {sentimentLabel}
        </motion.div>
      </div>

      {/* Metadata */}
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-[#0f172a] rounded px-4 py-2.5">
          <span className="font-mono text-xs text-[#cbd5e1]">SOURCE</span>
          <span className="font-mono text-sm text-[#e2e8f0] uppercase">
            {sentiment.source || "macro_proxy"}
          </span>
        </div>
        <div className="flex items-center justify-between bg-[#0f172a] rounded px-4 py-2.5">
          <span className="font-mono text-xs text-[#cbd5e1]">CONFIDENCE</span>
          <span
            className="font-mono text-sm uppercase font-medium"
            style={{
              color:
                sentiment.confidence === "high"
                  ? "#00ff88"
                  : sentiment.confidence === "medium"
                    ? "#fbbf24"
                    : "#ff6b6b",
            }}
          >
            {sentiment.confidence || "low"}
          </span>
        </div>
        <div className="flex items-center justify-between bg-[#0f172a] rounded px-4 py-2.5">
          <span className="font-mono text-xs text-[#cbd5e1]">DIRECTION</span>
          <span className="font-mono text-sm text-[#e2e8f0] uppercase font-medium">
            {sentiment.direction || "neutral"}
          </span>
        </div>
      </div>

      {/* Components breakdown */}
      {sentiment.components && Object.keys(sentiment.components).length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#1e293b]">
          <div className="font-mono text-xs text-[#cbd5e1] mb-2">COMPONENTS</div>
          <div className="space-y-1.5">
            {Object.entries(sentiment.components)
              .filter(([, val]) => val != null && typeof val === "number")
              .map(([key, val]) => (
              <div key={key} className="flex items-center justify-between font-mono text-xs">
                <span className="text-[#94a3b8]">{key}</span>
                <span
                  style={{
                    color: (val as number) > 0 ? "#00ff88" : (val as number) < 0 ? "#ff6b6b" : "#94a3b8",
                  }}
                >
                  {(val as number) > 0 ? "+" : ""}
                  {(val as number).toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
