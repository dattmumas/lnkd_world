"use client";

import Panel, { Sparkline, ChangeBadge } from "./panel";

function CorrelationMatrix({
  correlation,
}: {
  correlation: { tickers: string[]; values: number[][] };
}) {
  const { tickers, values } = correlation;

  // Signed heat: green for positive, red for negative, black at zero.
  const cellStyle = (v: number, isDiag: boolean) => {
    if (isDiag) return { backgroundColor: "#111111", color: "#5C5C5C" };
    const alpha = Math.min(0.85, Math.abs(v) * 0.85);
    return {
      backgroundColor:
        v >= 0 ? `rgba(0, 130, 60, ${alpha})` : `rgba(180, 40, 40, ${alpha})`,
      color: "#E6E6E6",
    };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-px">
        <thead>
          <tr>
            <th className="font-mono text-[10px] text-[#D89540] font-normal" />
            {tickers.map((t) => (
              <th key={t} className="font-mono text-[10px] text-[#D89540] font-normal pb-0.5">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map((rowT, i) => (
            <tr key={rowT}>
              <td className="font-mono text-[10px] text-[#D89540] text-right pr-1.5">
                {rowT}
              </td>
              {values[i].map((v, j) => (
                <td
                  key={j}
                  className="h-6 min-w-8 text-center font-mono text-[10px] tabular-nums"
                  style={cellStyle(v ?? 0, i === j)}
                >
                  {i !== j ? (v ?? 0).toFixed(1) : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EtfPanel({
  etfs,
}: {
  etfs?: {
    available: boolean;
    etfs: {
      ticker: string;
      name: string;
      price: number;
      return_1d: number;
      return_1w: number;
      return_1m: number;
      return_ytd: number;
      sparkline: { date: string; value: number }[];
    }[];
    correlation: { tickers: string[]; values: number[][] } | null;
    as_of: string;
  };
}) {
  if (!etfs?.available) {
    return (
      <Panel title="Bond ETFs" note="Returns for bond ETFs across maturities and credit. Longer-duration funds move most when rates change.">
        <div className="text-[#D89540] font-mono text-sm text-center py-8">
          No ETF data
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Bond ETFs" note="Returns for bond ETFs across maturities and credit. Longer-duration funds move most when rates change.">
      <div className="lg:flex lg:gap-4">
        {/* ETF table */}
        <div className="flex-1 min-w-0">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-left text-[#D89540] border-b border-[#2E2E2E]">
                <th className="py-0.5 font-normal">TICKER</th>
                <th className="py-0.5 font-normal text-right">PX</th>
                <th className="py-0.5 font-normal text-right">1D</th>
                <th className="py-0.5 font-normal text-center">90D</th>
                <th className="py-0.5 font-normal text-right">1M</th>
                <th className="py-0.5 font-normal text-right">YTD</th>
              </tr>
            </thead>
            <tbody>
              {etfs.etfs.map((etf) => (
                <tr key={etf.ticker} className="border-b border-[#141414]">
                  <td className="py-[3px] text-[#62B0FF] font-bold">{etf.ticker}</td>
                  <td className="py-[3px] text-right text-[#FFE24A] font-bold tabular-nums">
                    {etf.price != null ? etf.price.toFixed(2) : "--"}
                  </td>
                  <td className="py-[3px] text-right">
                    <ChangeBadge value={etf.return_1d} suffix="%" decimals={1} />
                  </td>
                  <td className="py-[3px] text-center leading-none">
                    <Sparkline
                      data={etf.sparkline}
                      width={80}
                      height={14}
                      color={etf.return_1m >= 0 ? "#00D964" : "#FF4B4B"}
                    />
                  </td>
                  <td className="py-[3px] text-right">
                    <ChangeBadge value={etf.return_1m} suffix="%" decimals={1} />
                  </td>
                  <td className="py-[3px] text-right">
                    <ChangeBadge value={etf.return_ytd} suffix="%" decimals={1} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Correlation matrix */}
        {etfs.correlation && (
          <div className="mt-3 lg:mt-0 lg:w-[360px] lg:shrink-0 lg:border-l lg:border-[#1F1F1F] lg:pl-4">
            <div className="font-mono text-[10px] text-[#D89540] mb-1">
              CORRELATION MATRIX (60D)
            </div>
            <CorrelationMatrix correlation={etfs.correlation} />
          </div>
        )}
      </div>
    </Panel>
  );
}
