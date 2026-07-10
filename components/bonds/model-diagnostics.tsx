"use client";

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
      <Panel title="Model Diagnostics" note="Out-of-sample model fit and validation. Low confidence means it barely beats a random walk - read this before trusting any forecast.">
        <div className="text-[#FB8B1E] font-mono text-xs text-center py-8">
          {model?.model_error || "Model not available"}
        </div>
      </Panel>
    );
  }

  const fit = model.model_fit;
  const scenarios = model.scenarios;
  const validation = model.validation;

  return (
    <Panel title="Model Diagnostics" note="Out-of-sample model fit and validation. Low confidence means it barely beats a random walk - read this before trusting any forecast.">
      <div className="lg:flex lg:gap-4 font-mono">
        <div className="flex-1 min-w-0">
          {/* Fit metrics */}
          {fit && (
            <div className="flex items-center gap-6 pb-1.5 mb-1.5 border-b border-[#1F1F1F] text-[11px]">
              <div>
                <span className="text-[#FB8B1E]">R&sup2; </span>
                <span
                  className="font-bold tabular-nums"
                  style={{
                    color:
                      (fit.r_squared || 0) > 0.1
                        ? "#00C25B"
                        : (fit.r_squared || 0) > 0.03
                          ? "#FB8B1E"
                          : "#FF433D",
                  }}
                >
                  {(fit.r_squared || 0).toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-[#FB8B1E]">FEATURES </span>
                <span className="text-[#F6F3E8] font-bold tabular-nums">{fit.features?.length || 0}</span>
              </div>
              <div>
                <span className="text-[#FB8B1E]">OBS </span>
                <span className="text-[#F6F3E8] font-bold tabular-nums">{fit.n_observations || 0}</span>
              </div>
            </div>
          )}

          {/* Feature list */}
          {fit?.features && fit.features.length > 0 && (
            <div className="mb-1.5 text-[10px] leading-snug">
              <span className="text-[#FB8B1E]">FEATURE SET </span>
              <span className="text-[#A5A095]">{fit.features.join(" · ")}</span>
            </div>
          )}

          {/* Validation conflicts */}
          {validation?.conflicts && validation.conflicts.length > 0 && (
            <div className="pt-1.5 border-t border-[#1F1F1F]">
              <div className="text-[10px] text-[#FB8B1E] mb-0.5">MODEL CONFLICTS</div>
              {validation.conflicts.map((c, i) => (
                <div key={i} className="text-[10px] text-[#A5A095] leading-snug py-px">
                  {"⚠"} {typeof c === "string" ? c : JSON.stringify(c)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scenario analysis */}
        {scenarios && scenarios.length > 0 && (
          <div className="mt-2 lg:mt-0 lg:w-[340px] lg:shrink-0 lg:border-l lg:border-[#1F1F1F] lg:pl-4">
            <div className="text-[10px] text-[#FB8B1E] mb-0.5">SCENARIO ANALYSIS (10Y)</div>
            {scenarios.map((s, i) => {
              const yieldChg = s.yield_change || 0;
              const priceChg = s.price_change_pct || 0;

              return (
                <div key={i} className="flex items-center gap-2 py-[3px] border-b border-[#1C1C1C] text-[11px]">
                  <span className="text-[#F6F3E8] w-16 shrink-0 tabular-nums">
                    {s.scenario || `${yieldChg > 0 ? "+" : ""}${(yieldChg * 100).toFixed(0)}bp`}
                  </span>
                  <div className="flex-1 relative h-[9px] bg-[#1A1A1A]">
                    <div className="absolute left-1/2 top-0 h-full w-px bg-[#2E2E2E]" />
                    <div
                      className="absolute top-0 h-full"
                      style={{
                        backgroundColor: priceChg >= 0 ? "#00C25B" : "#FF433D",
                        left: priceChg >= 0 ? "50%" : undefined,
                        right: priceChg < 0 ? "50%" : undefined,
                        width: `${Math.min(50, Math.abs(priceChg) * 5)}%`,
                      }}
                    />
                  </div>
                  <span
                    className="w-14 text-right font-bold tabular-nums"
                    style={{ color: priceChg >= 0 ? "#00C25B" : "#FF433D" }}
                  >
                    {priceChg >= 0 ? "+" : ""}
                    {priceChg.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
