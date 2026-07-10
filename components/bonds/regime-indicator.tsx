"use client";

import Panel from "./panel";

const REGIME_COLORS: Record<string, string> = {
  rising_high: "#FF433D",
  rising_mid: "#FB8B1E",
  rising_low: "#FB8B1E",
  falling_high: "#00C25B",
  falling_mid: "#54A8FF",
  falling_low: "#54A8FF",
  stable_high: "#FB8B1E",
  stable_mid: "#FB8B1E",
  stable_low: "#54A8FF",
  unknown: "#A5A095",
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

function ConfidenceBlocks({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * 20);
  const color = clamped >= 70 ? "#00C25B" : clamped >= 40 ? "#FB8B1E" : "#FF433D";
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={i}
          className="flex-1 h-[9px]"
          style={{ backgroundColor: i < filled ? color : "#1F1F1F" }}
        />
      ))}
    </div>
  );
}

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

  const predBps = prediction?.predicted_change_bps || 0;
  const predColor = predBps > 0 ? "#FF433D" : predBps < 0 ? "#00C25B" : "#FB8B1E";

  return (
    <Panel title="Rate Regime" note="Where rates sit (trend and level), plus the model 21-day forecast. Check the confidence bar before acting on the number." accent={color}>
      <div className="font-mono">
        {/* Current regime readout */}
        <div className="flex items-baseline justify-between gap-3 pb-1.5 mb-1.5 border-b border-[#1F1F1F]">
          <span className="text-[10px] text-[#FB8B1E]">CURRENT REGIME</span>
          <span className="text-[15px] font-bold tracking-[0.08em]" style={{ color }}>
            {label}
          </span>
        </div>

        {regime && (
          <>
            <div className="flex items-center justify-between py-[3px] border-b border-[#1C1C1C] text-[11px]">
              <span className="text-[#FB8B1E]">TREND</span>
              <span className="text-[#F6F3E8] uppercase font-bold">{regime.trend}</span>
            </div>
            <div className="flex items-center justify-between py-[3px] border-b border-[#1C1C1C] text-[11px]">
              <span className="text-[#FB8B1E]">LEVEL</span>
              <span className="text-[#F6F3E8] uppercase font-bold">{regime.level}</span>
            </div>
          </>
        )}

        {/* Prediction */}
        {prediction && (
          <div className="flex items-center justify-between py-[3px] border-b border-[#1C1C1C] text-[11px]">
            <span className="text-[#FB8B1E]">21D FORECAST (10Y)</span>
            <span className="tabular-nums">
              <span className="text-[13px] font-bold" style={{ color: predColor }}>
                {predBps > 0 ? "+" : ""}
                {predBps.toFixed(0)}bp
              </span>
              {prediction.ci_90_lower_bps != null && prediction.ci_90_upper_bps != null && (
                <span className="text-[#7C7C7C] ml-2">
                  90% CI [{prediction.ci_90_lower_bps.toFixed(0)}, {prediction.ci_90_upper_bps.toFixed(0)}]
                </span>
              )}
            </span>
          </div>
        )}

        {/* Validation confidence */}
        {validation && validation.confidence_score != null && (
          <div className="pt-1.5">
            <div className="flex items-center justify-between mb-1 text-[11px]">
              <span className="text-[#FB8B1E]">MODEL CONFIDENCE</span>
              <span className="tabular-nums">
                <span
                  className="font-bold uppercase"
                  style={{
                    color:
                      validation.confidence_level === "high"
                        ? "#00C25B"
                        : validation.confidence_level === "medium"
                          ? "#FB8B1E"
                          : "#FF433D",
                  }}
                >
                  {validation.confidence_level}
                </span>
                <span className="text-[#F6F3E8] ml-2">
                  {(validation.confidence_score || 0).toFixed(0)}/100
                </span>
              </span>
            </div>
            <ConfidenceBlocks score={validation.confidence_score || 0} />
          </div>
        )}
      </div>
    </Panel>
  );
}
