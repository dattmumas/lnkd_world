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
      <Panel title="Sentiment" accent="#d6307e">
        <div className="text-[#6e7682] font-mono text-xs text-center py-8">
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
      ? "#0a8f57"
      : normalizedScore < -0.2
        ? "#d23b3b"
        : "#a86e15";

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
    <Panel
      title="Market Sentiment"
      accent="#d6307e"
      note="Composite risk appetite from macro proxies — left/red is risk-off (defensive), right/green is risk-on. The needle marks the current read."
    >
      {/* Sentiment arc gauge */}
      <div className="flex justify-center mb-3">
        <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#e8eaee"
            strokeWidth={14}
            strokeLinecap="round"
          />
          {/* Gradient arc */}
          <defs>
            <linearGradient id="sentimentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d23b3b" />
              <stop offset="50%" stopColor="#a86e15" />
              <stop offset="100%" stopColor="#0a8f57" />
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
        <div className="flex items-center justify-between bg-[#f6f7f9] rounded px-4 py-2.5">
          <span className="font-mono text-xs text-[#374151]">SOURCE</span>
          <span className="font-mono text-sm text-[#1f2937] uppercase">
            {sentiment.source || "macro_proxy"}
          </span>
        </div>
        <div className="flex items-center justify-between bg-[#f6f7f9] rounded px-4 py-2.5">
          <span className="font-mono text-xs text-[#374151]">CONFIDENCE</span>
          <span
            className="font-mono text-sm uppercase font-medium"
            style={{
              color:
                sentiment.confidence === "high"
                  ? "#0a8f57"
                  : sentiment.confidence === "medium"
                    ? "#a86e15"
                    : "#d23b3b",
            }}
          >
            {sentiment.confidence || "low"}
          </span>
        </div>
        <div className="flex items-center justify-between bg-[#f6f7f9] rounded px-4 py-2.5">
          <span className="font-mono text-xs text-[#374151]">DIRECTION</span>
          <span className="font-mono text-sm text-[#1f2937] uppercase font-medium">
            {sentiment.direction || "neutral"}
          </span>
        </div>
      </div>

      {/* Components breakdown */}
      {sentiment.components && Object.keys(sentiment.components).length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#e8eaee]">
          <div className="font-mono text-xs text-[#374151] mb-2">COMPONENTS</div>
          <div className="space-y-1.5">
            {Object.entries(sentiment.components)
              .filter(([, val]) => val != null && typeof val === "number")
              .map(([key, val]) => (
              <div key={key} className="flex items-center justify-between font-mono text-xs">
                <span className="text-[#6e7682]">{key}</span>
                <span
                  style={{
                    color: (val as number) > 0 ? "#0a8f57" : (val as number) < 0 ? "#d23b3b" : "#6e7682",
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
