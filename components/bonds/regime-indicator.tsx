"use client";

import { motion } from "framer-motion";
import Panel from "./panel";

const REGIME_COLORS: Record<string, string> = {
  rising_high: "#ff6b6b",
  rising_mid: "#f97316",
  rising_low: "#fbbf24",
  falling_high: "#00ff88",
  falling_mid: "#4a9eff",
  falling_low: "#a855f7",
  stable_high: "#fbbf24",
  stable_mid: "#94a3b8",
  stable_low: "#4a9eff",
  unknown: "#4a5568",
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
    <Panel title="Regime" accent={color}>
      {/* Current regime indicator */}
      <div className="text-center mb-4">
        <motion.div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 mb-2"
          style={{ borderColor: color }}
          animate={{
            boxShadow: [
              `0 0 0 0 ${color}40`,
              `0 0 0 8px ${color}00`,
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        >
          <motion.div
            className="w-8 h-8 rounded-full"
            style={{ backgroundColor: color }}
            animate={{ scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </motion.div>
        <div className="font-mono text-[10px] tracking-widest" style={{ color }}>
          {label}
        </div>
      </div>

      {/* Trend + Level badges */}
      {regime && (
        <div className="flex justify-center gap-2 mb-3">
          <div className="bg-[#0f172a] rounded-sm px-2 py-1 font-mono text-[9px]">
            <span className="text-[#4a5568]">TREND </span>
            <span className="text-[#94a3b8] uppercase">{regime.trend}</span>
          </div>
          <div className="bg-[#0f172a] rounded-sm px-2 py-1 font-mono text-[9px]">
            <span className="text-[#4a5568]">LEVEL </span>
            <span className="text-[#94a3b8] uppercase">{regime.level}</span>
          </div>
        </div>
      )}

      {/* Prediction */}
      {prediction && (
        <div className="bg-[#0f172a] rounded-sm p-2 mb-2">
          <div className="font-mono text-[9px] text-[#4a5568] mb-1">21D FORECAST</div>
          <div className="text-center">
            <motion.div
              className="font-mono text-xl font-bold"
              style={{
                color:
                  (prediction.predicted_change_bps || 0) > 0
                    ? "#ff6b6b"
                    : (prediction.predicted_change_bps || 0) < 0
                      ? "#00ff88"
                      : "#94a3b8",
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.3 }}
            >
              {(prediction.predicted_change_bps || 0) > 0 ? "+" : ""}
              {(prediction.predicted_change_bps || 0).toFixed(0)}
              <span className="text-xs font-normal">bp</span>
            </motion.div>
            {prediction.ci_90_lower_bps != null && prediction.ci_90_upper_bps != null && (
              <div className="font-mono text-[9px] text-[#4a5568] mt-0.5">
                90% CI: [{prediction.ci_90_lower_bps.toFixed(0)},{" "}
                {prediction.ci_90_upper_bps.toFixed(0)}]
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation confidence */}
      {validation && validation.confidence_score != null && (
        <div className="bg-[#0f172a] rounded-sm p-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-[#4a5568]">MODEL CONF</span>
            <span
              className="font-mono text-[10px] font-bold uppercase"
              style={{
                color:
                  validation.confidence_level === "high"
                    ? "#00ff88"
                    : validation.confidence_level === "medium"
                      ? "#fbbf24"
                      : "#ff6b6b",
              }}
            >
              {validation.confidence_level}
            </span>
          </div>
          <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden mt-1">
            <motion.div
              className="h-full rounded-full"
              style={{
                backgroundColor:
                  (validation.confidence_score || 0) >= 70
                    ? "#00ff88"
                    : (validation.confidence_score || 0) >= 40
                      ? "#fbbf24"
                      : "#ff6b6b",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${validation.confidence_score || 0}%` }}
              transition={{ duration: 1 }}
            />
          </div>
          <div className="font-mono text-[9px] text-[#4a5568] text-center mt-1">
            {(validation.confidence_score || 0).toFixed(0)} / 100
          </div>
        </div>
      )}
    </Panel>
  );
}
