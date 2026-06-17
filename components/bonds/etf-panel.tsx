"use client";

import { motion } from "framer-motion";
import Panel, { Sparkline, ChangeBadge } from "./panel";

function CorrelationMatrix({
  correlation,
}: {
  correlation: { tickers: string[]; values: number[][] };
}) {
  const { tickers, values } = correlation;

  const cellColor = (v: number) => {
    if (v >= 0.8) return "#00ff88";
    if (v >= 0.5) return "#4a9eff";
    if (v >= 0.2) return "#1e293b";
    if (v >= -0.2) return "#4a5568";
    if (v >= -0.5) return "#f97316";
    return "#ff6b6b";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="font-mono text-xs text-[#94a3b8] p-1" />
            {tickers.map((t) => (
              <th key={t} className="font-mono text-xs text-[#94a3b8] p-1">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map((rowT, i) => (
            <tr key={rowT}>
              <td className="font-mono text-xs text-[#94a3b8] p-1 text-right pr-2">
                {rowT}
              </td>
              {values[i].map((v, j) => (
                <td key={j} className="p-1">
                  <motion.div
                    className="w-full aspect-square rounded flex items-center justify-center font-mono text-[10px]"
                    style={{
                      backgroundColor: cellColor(v),
                      opacity: i === j ? 0.3 : 0.6 + Math.abs(v) * 0.4,
                      color: Math.abs(v) > 0.5 ? "#0a0e17" : "#e2e8f0",
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: (i * tickers.length + j) * 0.01 }}
                  >
                    {i !== j ? (v ?? 0).toFixed(1) : ""}
                  </motion.div>
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
      <Panel title="Bond ETFs" accent="#a855f7">
        <div className="text-[#94a3b8] font-mono text-sm text-center py-12">
          No ETF data
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Bond ETFs" accent="#a855f7">
      {/* ETF table */}
      <div className="space-y-1.5 mb-4">
        {etfs.etfs.map((etf, i) => (
          <motion.div
            key={etf.ticker}
            className="flex items-center gap-3 bg-[#0f172a] rounded px-4 py-2.5"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="font-mono text-sm text-[#4a9eff] w-10 shrink-0 font-medium">
              {etf.ticker}
            </div>
            <div className="font-mono text-base text-[#f1f5f9] w-16 text-right shrink-0 font-medium">
              ${etf.price != null ? etf.price.toFixed(1) : "--"}
            </div>
            <div className="shrink-0 w-16">
              <ChangeBadge value={etf.return_1d} suffix="%" decimals={1} />
            </div>
            <div className="flex-1 min-w-0">
              <Sparkline
                data={etf.sparkline}
                width={120}
                height={28}
                color={etf.return_1m >= 0 ? "#00ff88" : "#ff6b6b"}
              />
            </div>
            <div className="shrink-0 w-16 text-right">
              <ChangeBadge value={etf.return_ytd} suffix="%" decimals={1} />
            </div>
            <div className="font-mono text-xs text-[#94a3b8] shrink-0">YTD</div>
          </motion.div>
        ))}
      </div>

      {/* Correlation matrix */}
      {etfs.correlation && (
        <div className="pt-3 border-t border-[#1e293b]">
          <div className="font-mono text-xs text-[#cbd5e1] mb-2 tracking-wide">
            CORRELATION MATRIX (60D)
          </div>
          <CorrelationMatrix correlation={etfs.correlation} />
        </div>
      )}
    </Panel>
  );
}
