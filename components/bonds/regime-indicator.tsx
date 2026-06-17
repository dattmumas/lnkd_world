"use client";

import { motion } from "framer-motion";
import Panel from "./panel";

const REGIME_COLORS: Record<string, string> = {
  rising_high: "#d23b3b",
  rising_mid: "#e3700f",
  rising_low: "#a86e15",
  falling_high: "#0a8f57",
  falling_mid: "#2563eb",
  falling_low: "#0e9384",
  stable_high: "#a86e15",
  stable_mid: "#6e7682",
  stable_low: "#2563eb",
  unknown: "#a8aeb9",
};

const REGIME_LABELS: Record<string, string> = {
  rising_high: "RISING / HIGH",
  rising_mid: "RISING / MID",
  rising_low: "RISING / LOW",
  falling_high: "FALLING / HIGH",
  falling_mid: "FALLING / MID",
  falling_low: "FALLING / LOW",
  stable_high: "STABLE / HIGH",
  stable_mid: "STABLE / MID",
  stable_low: "STABLE / LOW",
  unknown: "UNKNOWN",
};

export default function RegimeIndicator({
  model,
}: {
  model?: {
    regime: {
      current: string;
      trend: string;
      level: string;
      history: { date: string; regime: string }[];
    };
    prediction?: {
      predicted_change_bps: number;
      direction: string | number;
      ci_90_lower_bps: number;
      ci_90_upper_bps: number;
    };
    validation?: {
      confidence_score: number;
      confidence_level: string;
    };
  };
}) {
  const regime = model?.regime;
  const prediction = model?.prediction;
  const validation = model?.validation;

  const regimeKey = regime?.current || "unknown";
  const color = REGIME_COLORS[regimeKey] || REGIME_COLORS.unknown;
  const label = REGIME_LABELS[regimeKey] || regimeKey.toUpperCase();

  return (
    <Panel title="Regime" note="Where rates sit (trend and level), plus the model 21-day forecast. Check the confidence bar before acting on the number." accent={color}>
      {/* Current regime indicator */}
      <div className="text-center mb-3">
        <motion.div
          className="inline-flex items-center justify-center w-14 h-14 rounded-full border-2 mb-2"
          style={{ borderColor: color }}
          animate={{
            boxShadow: [
              `0 0 0 0 ${color}40`,
              `0 0 0 10px ${color}00`,
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        >
          <motion.div
            className="w-7 h-7 rounded-full"
            style={{ backgroundColor: color }}
            animate={{ scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </motion.div>
        <div className="font-mono text-xs tracking-widest font-medium" style={{ color }}>
          {label}
        </div>
      </div>

      {/* Trend + Level badges */}
      {regime && (
        <div className="flex justify-center gap-2 mb-3">
          <div className="bg-[#f6f7f9] rounded px-2.5 py-1 font-mono text-xs">
            <span className="text-[#374151]">TREND </span>
            <span className="text-[#1f2937] uppercase font-medium">{regime.trend}</span>
          </div>
          <div className="bg-[#f6f7f9] rounded px-2.5 py-1 font-mono text-xs">
            <span className="text-[#374151]">LEVEL </span>
            <span className="text-[#1f2937] uppercase font-medium">{regime.level}</span>
          </div>
        </div>
      )}

      {/* Prediction */}
      {prediction && (
        <div className="bg-[#f6f7f9] rounded p-3 mb-2.5">
          <div className="font-mono text-xs text-[#374151] mb-2">21D FORECAST</div>
          <div className="text-center">
            <motion.div
              className="font-mono text-lg font-bold"
              style={{
                color:
                  (prediction.predicted_change_bps || 0) > 0
                    ? "#d23b3b"
                    : (prediction.predicted_change_bps || 0) < 0
                      ? "#0a8f57"
                      : "#6e7682",
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.3 }}
            >
              {(prediction.predicted_change_bps || 0) > 0 ? "+" : ""}
              {(prediction.predicted_change_bps || 0).toFixed(0)}
              <span className="text-sm font-normal ml-0.5">bp</span>
            </motion.div>
            {prediction.ci_90_lower_bps != null && prediction.ci_90_upper_bps != null && (
              <div className="font-mono text-xs text-[#6e7682] mt-1">
                90% CI: [{prediction.ci_90_lower_bps.toFixed(0)},{" "}
                {prediction.ci_90_upper_bps.toFixed(0)}]
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation confidence */}
      {validation && validation.confidence_score != null && (
        <div className="bg-[#f6f7f9] rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-[#374151]">MODEL CONF</span>
            <span
              className="font-mono text-sm font-bold uppercase"
              style={{
                color:
                  validation.confidence_level === "high"
                    ? "#0a8f57"
                    : validation.confidence_level === "medium"
                      ? "#a86e15"
                      : "#d23b3b",
              }}
            >
              {validation.confidence_level}
            </span>
          </div>
          <div className="h-2 bg-[#e8eaee] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                backgroundColor:
                  (validation.confidence_score || 0) >= 70
                    ? "#0a8f57"
                    : (validation.confidence_score || 0) >= 40
                      ? "#a86e15"
                      : "#d23b3b",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${validation.confidence_score || 0}%` }}
              transition={{ duration: 1 }}
            />
          </div>
          <div className="font-mono text-xs text-[#6e7682] text-center mt-2">
            {(validation.confidence_score || 0).toFixed(0)} / 100
          </div>
        </div>
      )}
    </Panel>
  );
}
