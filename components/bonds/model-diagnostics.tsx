"use client";

import { motion } from "framer-motion";
import Panel from "./panel";

export default function ModelDiagnostics({
  model,
}: {
  model?: {
    available: boolean;
    model_fit?: {
      r_squared: number;
      features: string[];
      n_observations: number;
    };
    scenarios?: {
      scenario?: string;
      yield_change?: number;
      price_change_pct?: number;
    }[];
    validation?: {
      confidence_score: number;
      confidence_level: string;
      conflicts: string[];
    };
    model_error?: string;
  };
}) {
  if (!model?.available) {
    return (
      <Panel title="Model Diagnostics" note="Out-of-sample model fit and validation. Low confidence means it barely beats a random walk - read this before trusting any forecast." accent="#62B0FF">
        <div className="text-[#D89540] font-mono text-xs text-center py-8">
          {model?.model_error || "Model not available"}
        </div>
      </Panel>
    );
  }

  const fit = model.model_fit;
  const scenarios = model.scenarios;
  const validation = model.validation;

  return (
    <Panel title="Model Diagnostics" note="Out-of-sample model fit and validation. Low confidence means it barely beats a random walk - read this before trusting any forecast." accent="#62B0FF">
      {/* R-squared and fit metrics */}
      {fit && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-[#141414] rounded p-3 text-center">
            <div className="font-mono text-xs text-[#E6E6E6] mb-1">R&sup2;</div>
            <motion.div
              className="font-mono text-lg font-bold"
              style={{
                color:
                  (fit.r_squared || 0) > 0.1
                    ? "#00D964"
                    : (fit.r_squared || 0) > 0.03
                      ? "#FFA028"
                      : "#FF4B4B",
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              {(fit.r_squared || 0).toFixed(3)}
            </motion.div>
          </div>
          <div className="bg-[#141414] rounded p-3 text-center">
            <div className="font-mono text-xs text-[#E6E6E6] mb-1">FEATURES</div>
            <div className="font-mono text-lg font-bold text-[#62B0FF]">
              {fit.features?.length || 0}
            </div>
          </div>
          <div className="bg-[#141414] rounded p-3 text-center">
            <div className="font-mono text-xs text-[#E6E6E6] mb-1">OBS</div>
            <div className="font-mono text-lg font-bold text-[#E6E6E6]">
              {fit.n_observations || 0}
            </div>
          </div>
        </div>
      )}

      {/* Feature list */}
      {fit?.features && fit.features.length > 0 && (
        <div className="mb-4">
          <div className="font-mono text-xs text-[#E6E6E6] mb-2">FEATURES</div>
          <div className="flex flex-wrap gap-1.5">
            {fit.features.map((f, i) => (
              <motion.span
                key={f}
                className="bg-[#141414] rounded px-2 py-1 font-mono text-xs text-[#E6E6E6]"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                {f}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {/* Scenario analysis */}
      {scenarios && scenarios.length > 0 && (
        <div className="mb-4">
          <div className="font-mono text-xs text-[#E6E6E6] mb-2">
            SCENARIO ANALYSIS (10Y)
          </div>
          <div className="space-y-1.5">
            {scenarios.map((s, i) => {
              const yieldChg = s.yield_change || 0;
              const priceChg = s.price_change_pct || 0;

              return (
                <motion.div
                  key={i}
                  className="flex items-center gap-3 bg-[#141414] rounded px-4 py-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <span className="font-mono text-xs text-[#E6E6E6] w-20">
                    {s.scenario || `${yieldChg > 0 ? "+" : ""}${(yieldChg * 100).toFixed(0)}bp`}
                  </span>
                  <div className="flex-1 relative h-4 bg-[#2E2E2E] rounded-full overflow-hidden">
                    <motion.div
                      className="absolute top-0 h-full rounded-full"
                      style={{
                        backgroundColor: priceChg >= 0 ? "#00D964" : "#FF4B4B",
                        left: priceChg >= 0 ? "50%" : undefined,
                        right: priceChg < 0 ? "50%" : undefined,
                        width: `${Math.min(50, Math.abs(priceChg) * 5)}%`,
                      }}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(50, Math.abs(priceChg) * 5)}%`,
                      }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                    />
                  </div>
                  <span
                    className="font-mono text-sm w-14 text-right font-medium"
                    style={{
                      color: priceChg >= 0 ? "#00D964" : "#FF4B4B",
                    }}
                  >
                    {priceChg >= 0 ? "+" : ""}
                    {priceChg.toFixed(1)}%
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation conflicts */}
      {validation?.conflicts && validation.conflicts.length > 0 && (
        <div className="pt-3 border-t border-[#2E2E2E]">
          <div className="font-mono text-xs text-[#FFA028] mb-2">
            MODEL CONFLICTS
          </div>
          {validation.conflicts.map((c, i) => (
            <div
              key={i}
              className="font-mono text-xs text-[#D89540] leading-relaxed mb-1"
            >
              {"\u26A0"} {typeof c === "string" ? c : JSON.stringify(c)}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
