"use client";

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
      <Panel title="Market Sentiment">
        <div className="text-[#D89540] font-mono text-xs text-center py-8">
          No sentiment data
        </div>
      </Panel>
    );
  }

  const score = sentiment.composite_score || 0;
  const normalizedScore = Math.max(-1, Math.min(1, score));
  const position = ((normalizedScore + 1) / 2) * 100;

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
      note="Composite risk appetite from macro proxies — left/red is risk-off (defensive), right/green is risk-on. The marker shows the current read."
    >
      <div className="font-mono">
        {/* Score readout */}
        <div className="flex items-baseline justify-between gap-3 pb-1.5 mb-1.5 border-b border-[#1F1F1F]">
          <span className="text-[10px] text-[#D89540]">COMPOSITE SCORE</span>
          <span>
            <span className="text-[15px] font-bold tabular-nums" style={{ color: sentimentColor }}>
              {normalizedScore > 0 ? "+" : ""}
              {normalizedScore.toFixed(2)}
            </span>
            <span className="text-[11px] font-bold tracking-[0.08em] ml-2" style={{ color: sentimentColor }}>
              {sentimentLabel}
            </span>
          </span>
        </div>

        {/* Scale */}
        <div className="mb-2">
          <div className="relative h-[7px] bg-[#1A1A1A]">
            <div className="absolute left-1/2 top-0 h-full w-px bg-[#2E2E2E]" />
            <div
              className="absolute top-[-3px] h-[13px] w-[3px]"
              style={{ left: `calc(${position}% - 1px)`, backgroundColor: sentimentColor }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-[#5C5C5C] mt-0.5">
            <span>RISK-OFF -1.0</span>
            <span>0</span>
            <span>+1.0 RISK-ON</span>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between py-[3px] border-b border-[#141414] text-[11px]">
          <span className="text-[#D89540]">SOURCE</span>
          <span className="text-[#E6E6E6] uppercase">{sentiment.source || "macro_proxy"}</span>
        </div>
        <div className="flex items-center justify-between py-[3px] border-b border-[#141414] text-[11px]">
          <span className="text-[#D89540]">CONFIDENCE</span>
          <span
            className="uppercase font-bold"
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
        <div className="flex items-center justify-between py-[3px] border-b border-[#141414] text-[11px]">
          <span className="text-[#D89540]">DIRECTION</span>
          <span className="text-[#E6E6E6] uppercase font-bold">{sentiment.direction || "neutral"}</span>
        </div>

        {/* Components breakdown */}
        {sentiment.components && Object.keys(sentiment.components).length > 0 && (
          <div className="mt-1.5">
            <div className="text-[10px] text-[#D89540] mb-0.5">COMPONENTS</div>
            {Object.entries(sentiment.components)
              .filter(([, val]) => val != null && typeof val === "number")
              .map(([key, val]) => (
                <div key={key} className="flex items-center justify-between py-px text-[11px]">
                  <span className="text-[#8F8F8F]">{key}</span>
                  <span
                    className="tabular-nums"
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
        )}
      </div>
    </Panel>
  );
}
