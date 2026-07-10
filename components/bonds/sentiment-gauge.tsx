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
      <Panel title="Sentiment" accent="#FF3EB5">
        <div className="text-[#D89540] font-mono text-xs text-center py-8">
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
      ? "#00D964"
      : normalizedScore < -0.2
        ? "#FF4B4B"
        : "#FFA028";

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
      accent="#FF3EB5"
      note="Composite risk appetite from macro proxies — left/red is risk-off (defensive), right/green is risk-on. The needle marks the current read."
    >
      {/* Sentiment arc gauge */}
      <div className="flex justify-center mb-3">
        <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#2E2E2E"
            strokeWidth={14}
            strokeLinecap="round"
          />
          {/* Gradient arc */}
          <defs>
            <linearGradient id="sentimentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF4B4B" />
              <stop offset="50%" stopColor="#FFA028" />
              <stop offset="100%" stopColor="#00D964" />
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
        <div className="flex items-center justify-between bg-[#141414] rounded px-4 py-2.5">
          <span className="font-mono text-xs text-[#E6E6E6]">SOURCE</span>
          <span className="font-mono text-sm text-[#E6E6E6] uppercase">
            {sentiment.source || "macro_proxy"}
          </span>
        </div>
        <div className="flex items-center justify-between bg-[#141414] rounded px-4 py-2.5">
          <span className="font-mono text-xs text-[#E6E6E6]">CONFIDENCE</span>
          <span
            className="font-mono text-sm uppercase font-medium"
            style={{
              color:
                sentiment.confidence === "high"
                  ? "#00D964"
                  : sentiment.confidence === "medium"
                    ? "#FFA028"
                    : "#FF4B4B",
            }}
          >
            {sentiment.confidence || "low"}
          </span>
        </div>
        <div className="flex items-center justify-between bg-[#141414] rounded px-4 py-2.5">
          <span className="font-mono text-xs text-[#E6E6E6]">DIRECTION</span>
          <span className="font-mono text-sm text-[#E6E6E6] uppercase font-medium">
            {sentiment.direction || "neutral"}
          </span>
        </div>
      </div>

      {/* Components breakdown */}
      {sentiment.components && Object.keys(sentiment.components).length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#2E2E2E]">
          <div className="font-mono text-xs text-[#E6E6E6] mb-2">COMPONENTS</div>
          <div className="space-y-1.5">
            {Object.entries(sentiment.components)
              .filter(([, val]) => val != null && typeof val === "number")
              .map(([key, val]) => (
              <div key={key} className="flex items-center justify-between font-mono text-xs">
                <span className="text-[#D89540]">{key}</span>
                <span
                  style={{
                    color: (val as number) > 0 ? "#00D964" : (val as number) < 0 ? "#FF4B4B" : "#D89540",
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
