"use client";

import { motion } from "framer-motion";
import Panel from "./panel";

const REGIME_COLORS: Record<string, string> = {
  rising_high: "#FF4B4B",
  rising_mid: "#FFA028",
  rising_low: "#FFA028",
  falling_high: "#00D964",
  falling_mid: "#62B0FF",
  falling_low: "#00C8FF",
  stable_high: "#FFA028",
  stable_mid: "#D89540",
  stable_low: "#62B0FF",
  unknown: "#8F8F8F",
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
          <div className="bg-[#141414] rounded px-2.5 py-1 font-mono text-xs">
            <span className="text-[#E6E6E6]">TREND </span>
            <span className="text-[#E6E6E6] uppercase font-medium">{regime.trend}</span>
          </div>
          <div className="bg-[#141414] rounded px-2.5 py-1 font-mono text-xs">
            <span className="text-[#E6E6E6]">LEVEL </span>
            <span className="text-[#E6E6E6] uppercase font-medium">{regime.level}</span>
          </div>
        </div>
      )}

      {/* Prediction */}
      {prediction && (
        <div className="bg-[#141414] rounded p-3 mb-2.5">
          <div className="font-mono text-xs text-[#E6E6E6] mb-2">21D FORECAST</div>
          <div className="text-center">
            <motion.div
              className="font-mono text-lg font-bold"
              style={{
                color:
                  (prediction.predicted_change_bps || 0) > 0
                    ? "#FF4B4B"
                    : (prediction.predicted_change_bps || 0) < 0
                      ? "#00D964"
                      : "#D89540",
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
              <div className="font-mono text-xs text-[#D89540] mt-1">
                90% CI: [{prediction.ci_90_lower_bps.toFixed(0)},{" "}
                {prediction.ci_90_upper_bps.toFixed(0)}]
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation confidence */}
      {validation && validation.confidence_score != null && (
        <div className="bg-[#141414] rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-[#E6E6E6]">MODEL CONF</span>
            <span
              className="font-mono text-sm font-bold uppercase"
              style={{
                color:
                  validation.confidence_level === "high"
                    ? "#00D964"
                    : validation.confidence_level === "medium"
                      ? "#FFA028"
                      : "#FF4B4B",
              }}
            >
              {validation.confidence_level}
            </span>
          </div>
          <div className="h-2 bg-[#2E2E2E] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                backgroundColor:
                  (validation.confidence_score || 0) >= 70
                    ? "#00D964"
                    : (validation.confidence_score || 0) >= 40
                      ? "#FFA028"
                      : "#FF4B4B",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${validation.confidence_score || 0}%` }}
              transition={{ duration: 1 }}
            />
          </div>
          <div className="font-mono text-xs text-[#D89540] text-center mt-2">
            {(validation.confidence_score || 0).toFixed(0)} / 100
          </div>
        </div>
      )}
    </Panel>
  );
}
