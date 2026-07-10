"use client";

import Panel, { DirectionArrow, ConvictionBar } from "./panel";

const SIGNAL_LABELS: Record<string, { label: string }> = {
  rate_direction: { label: "RATE DIRECTION" },
  curve_shape: { label: "CURVE SHAPE" },
  sector_allocation: { label: "SECTOR" },
  duration_positioning: { label: "DURATION" },
  credit_cycle: { label: "CREDIT CYCLE" },
  sentiment_bias: { label: "SENTIMENT" },
};

export default function SignalConsole({
  signals,
}: {
  signals?: {
    signals: { signal_type: string; direction: number; conviction: number; source: string; rationale: string }[];
    aggregated: {
      composite_by_type: Record<string, { direction: number; conviction: number; count: number }>;
      overall_bias: { direction: number; conviction: number; description: string };
      signal_agreement: number;
      confidence_level: string;
      n_signals: number;
    };
  };
}) {
  if (!signals?.aggregated) {
    return (
      <Panel title="Signal Console" note="Directional reads across rates, curve, sectors and sentiment. Agreement and conviction show how aligned and strong the signals are.">
        <div className="text-[#D89540] font-mono text-sm text-center py-8">No signals</div>
      </Panel>
    );
  }

  const { aggregated, signals: rawSignals } = signals;
  const bias = aggregated.overall_bias;
  const confColor: Record<string, string> = { high: "#00D964", medium: "#FFA028", low: "#FF4B4B" };

  return (
    <Panel title="Signal Console" note="Directional reads across rates, curve, sectors and sentiment. Agreement and conviction show how aligned and strong the signals are." subtitle={`${aggregated.n_signals} signals`}>
      {/* Overall bias strip */}
      <div className="flex items-center justify-between gap-3 pb-1.5 mb-1.5 border-b border-[#2E2E2E] font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <DirectionArrow direction={bias.direction} size="md" />
          <span className="text-[12px] text-[#FFE24A] font-bold uppercase truncate">
            {bias.description}
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-[11px]">
          <div>
            <span className="text-[#D89540]">AGMT </span>
            <span className="text-[#E6E6E6] font-bold tabular-nums">
              {aggregated.signal_agreement?.toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-[#D89540]">CONF </span>
            <span className="font-bold uppercase" style={{ color: confColor[aggregated.confidence_level] || "#D89540" }}>
              {aggregated.confidence_level}
            </span>
          </div>
        </div>
      </div>

      {/* Composite signals */}
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="text-left text-[#D89540] border-b border-[#2E2E2E]">
            <th className="py-0.5 font-normal">SIGNAL</th>
            <th className="py-0.5 font-normal">DIR</th>
            <th className="py-0.5 font-normal">CONVICTION</th>
            <th className="py-0.5 font-normal text-right">SCORE</th>
            <th className="py-0.5 font-normal text-right">N</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(aggregated.composite_by_type).map(([type, data]) => {
            const meta = SIGNAL_LABELS[type] || { label: type.toUpperCase() };
            return (
              <tr key={type} className="border-b border-[#141414]">
                <td className="py-[3px] text-[#E6E6E6]">{meta.label}</td>
                <td className="py-[3px]">
                  <DirectionArrow direction={data.direction} size="sm" />
                </td>
                <td className="py-[3px]">
                  <ConvictionBar value={data.conviction} segments={14} />
                </td>
                <td className="py-[3px] text-right text-[#FFE24A] font-bold tabular-nums">
                  {data.conviction?.toFixed(0)}
                </td>
                <td className="py-[3px] text-right text-[#5C5C5C] tabular-nums">{data.count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Expandable raw signals */}
      {rawSignals && rawSignals.length > 0 && (
        <details className="mt-2">
          <summary className="font-mono text-[11px] text-[#62B0FF] cursor-pointer hover:text-[#8FC7FF]">
            VIEW ALL {rawSignals.length} INDIVIDUAL SIGNALS
          </summary>
          <div className="mt-1.5 max-h-64 overflow-y-auto">
            {rawSignals.map((sig, i) => (
              <div key={i} className="flex items-start gap-2 py-1 border-b border-[#141414] font-mono">
                <DirectionArrow direction={sig.direction} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px]">
                    <span className="text-[#FFA028] uppercase">{sig.signal_type}</span>
                    <span className="text-[#5C5C5C] ml-2">{sig.source}</span>
                  </div>
                  <div className="text-[10px] text-[#8F8F8F] mt-0.5 leading-snug">{sig.rationale}</div>
                </div>
                <div className="text-[10px] text-[#E6E6E6] shrink-0 tabular-nums">{sig.conviction}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </Panel>
  );
}
