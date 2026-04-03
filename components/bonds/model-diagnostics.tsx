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
      <Panel title="Model Diagnostics" accent="#4a9eff">
        <div className="text-[#4a5568] font-mono text-xs text-center py-8">
          {model?.model_error || "Model not available"}
        </div>
      </Panel>
    );
  }

  const fit = model.model_fit;
  const scenarios = model.scenarios;
  const validation = model.validation;

  return (
    <Panel title="Model Diagnostics" accent="#4a9eff">
      {/* R-squared and fit metrics */}
      {fit && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[#0f172a] rounded-sm p-2 text-center">
            <div className="font-mono text-[9px] text-[#4a5568] mb-1">R&sup2;</div>
            <motion.div
              className="font-mono text-lg font-bold"
              style={{
                color:
                  (fit.r_squared || 0) > 0.1
                    ? "#00ff88"
                    : (fit.r_squared || 0) > 0.03
                      ? "#fbbf24"
                      : "#ff6b6b",
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              {(fit.r_squared || 0).toFixed(3)}
            </motion.div>
          </div>
          <div className="bg-[#0f172a] rounded-sm p-2 text-center">
            <div className="font-mono text-[9px] text-[#4a5568] mb-1">FEATURES</div>
            <div className="font-mono text-lg font-bold text-[#4a9eff]">
              {fit.features?.length || 0}
            </div>
          </div>
          <div className="bg-[#0f172a] rounded-sm p-2 text-center">
            <div className="font-mono text-[9px] text-[#4a5568] mb-1">OBS</div>
            <div className="font-mono text-lg font-bold text-[#94a3b8]">
              {fit.n_observations || 0}
            </div>
          </div>
        </div>
      )}

      {/* Feature list */}
      {fit?.features && fit.features.length > 0 && (
        <div className="mb-3">
          <div className="font-mono text-[9px] text-[#4a5568] mb-1">FEATURES</div>
          <div className="flex flex-wrap gap-1">
            {fit.features.map((f, i) => (
              <motion.span
                key={f}
                className="bg-[#0f172a] rounded-sm px-1.5 py-0.5 font-mono text-[8px] text-[#94a3b8]"
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
        <div className="mb-3">
          <div className="font-mono text-[9px] text-[#4a5568] mb-1.5">
            SCENARIO ANALYSIS (10Y)
          </div>
          <div className="space-y-1">
            {scenarios.map((s, i) => {
              const yieldChg = s.yield_change || 0;
              const priceChg = s.price_change_pct || 0;

              return (
                <motion.div
                  key={i}
                  className="flex items-center gap-2 bg-[#0f172a] rounded-sm px-2 py-1"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <span className="font-mono text-[9px] text-[#4a5568] w-16">
                    {s.scenario || `${yieldChg > 0 ? "+" : ""}${(yieldChg * 100).toFixed(0)}bp`}
                  </span>
                  <div className="flex-1 relative h-3 bg-[#1e293b] rounded-full overflow-hidden">
                    <motion.div
                      className="absolute top-0 h-full rounded-full"
                      style={{
                        backgroundColor: priceChg >= 0 ? "#00ff88" : "#ff6b6b",
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
                    className="font-mono text-[9px] w-12 text-right"
                    style={{
                      color: priceChg >= 0 ? "#00ff88" : "#ff6b6b",
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
        <div className="pt-2 border-t border-[#1e293b]">
          <div className="font-mono text-[9px] text-[#fbbf24] mb-1">
            MODEL CONFLICTS
          </div>
          {validation.conflicts.map((c, i) => (
            <div
              key={i}
              className="font-mono text-[9px] text-[#4a5568] leading-relaxed"
            >
              {"\u26A0"} {typeof c === "string" ? c : JSON.stringify(c)}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
