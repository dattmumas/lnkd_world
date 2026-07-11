"use client";

import Panel from "./panel";

function ScoreBlocks({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * 12);
  const color = clamped >= 60 ? "#00C25B" : clamped >= 30 ? "#FB8B1E" : "#FF433D";
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className="w-[5px] h-[8px]"
          style={{ backgroundColor: i < filled ? color : "#1F1F1F" }}
        />
      ))}
    </div>
  );
}

export default function ModelDiagnostics({
  model,
}: {
  model?: {
    available: boolean;
    model_fit?: {
      r_squared: number;
      features: string[];
      n_observations: number;
      n_train?: number;
      n_test?: number;
      cv_n_folds?: number;
      combo_weight?: number;
      model_type?: string;
    };
    scenarios?: {
      scenario?: string;
      yield_change?: number;
      price_change_pct?: number;
    }[];
    validation?: {
      confidence_score: number;
      confidence_level: string | null;
      components?: Record<
        string,
        { score: number; weight: number; label: string }
      >;
      key_finding?: string;
      conflicts: unknown[];
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
  const components = validation?.components
    ? Object.entries(validation.components)
    : [];

  return (
    <Panel title="Model Diagnostics" note="Out-of-sample model fit and validation. Low confidence means it barely beats a random walk - read this before trusting any forecast.">
      <div className="lg:flex lg:gap-4 font-mono">
        <div className="flex-1 min-w-0">
          {/* Fit metrics */}
          {fit && (
            <div className="flex items-center gap-5 flex-wrap pb-1.5 mb-1.5 border-b border-[#1F1F1F] text-[11px]">
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
                <span className="text-[#F6F3E8] font-bold tabular-nums">
                  {fit.n_observations || 0}
                  {fit.n_train != null && fit.n_test != null && (
                    <span className="text-[#7C7C7C] font-normal">
                      {" "}({fit.n_train}/{fit.n_test})
                    </span>
                  )}
                </span>
              </div>
              {fit.cv_n_folds != null && (
                <div>
                  <span className="text-[#FB8B1E]">CV FOLDS </span>
                  <span className="text-[#F6F3E8] font-bold tabular-nums">{fit.cv_n_folds}</span>
                </div>
              )}
              {fit.combo_weight != null && (
                <div title="Fraction of the raw model forecast kept after shrinking toward the random walk on out-of-sample evidence">
                  <span className="text-[#FB8B1E]">RW SHRINK </span>
                  <span className="text-[#F6F3E8] font-bold tabular-nums">
                    ×{fit.combo_weight.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Confidence breakdown */}
          {components.length > 0 && (
            <div className="mb-1.5">
              <div className="text-[10px] text-[#FB8B1E] mb-0.5">
                CONFIDENCE BREAKDOWN
                {validation?.confidence_score != null && (
                  <span className="text-[#F6F3E8] font-bold ml-2 tabular-nums">
                    {validation.confidence_score.toFixed(0)}/100
                  </span>
                )}
                {validation?.confidence_level && (
                  <span className="text-[#F6F3E8] uppercase ml-1.5">
                    {validation.confidence_level}
                  </span>
                )}
              </div>
              {components.map(([name, c]) => (
                <div
                  key={name}
                  className="flex items-center gap-2 py-[2px] border-b border-[#1C1C1C] text-[10px]"
                >
                  <span className="text-[#F6F3E8] w-32 shrink-0 uppercase">
                    {name.replace(/_/g, " ")}
                  </span>
                  <ScoreBlocks score={c.score} />
                  <span className="text-[#7C7C7C] w-8 text-right tabular-nums shrink-0">
                    {(c.weight * 100).toFixed(0)}%
                  </span>
                  <span className="text-[#A5A095] truncate">{c.label}</span>
                </div>
              ))}
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
              {validation.conflicts.map((c, i) => {
                const conflict = c as { description?: string; resolution?: string };
                const text =
                  typeof c === "string"
                    ? c
                    : conflict.description
                      ? `${conflict.description}${conflict.resolution ? ` — ${conflict.resolution}` : ""}`
                      : JSON.stringify(c);
                return (
                  <div key={i} className="text-[10px] text-[#A5A095] leading-snug py-px">
                    {"⚠"} {text}
                  </div>
                );
              })}
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
