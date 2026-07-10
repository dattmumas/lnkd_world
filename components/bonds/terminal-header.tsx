"use client";

import Link from "next/link";
import { useState, useEffect, type JSX } from "react";

interface TerminalHeaderProps {
  generatedAt: string;
  status: string;
  errors?: string[];
  canRefresh?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshError?: string | null;
}

function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="tabular-nums">{time}</span>;
}

/**
 * Bloomberg-style command bar: black strip, an amber command line with a
 * blinking block cursor, red function box on the right. Sticky.
 */
export default function TerminalHeader({
  generatedAt,
  status,
  errors,
  canRefresh = false,
  refreshing = false,
  onRefresh,
  refreshError,
}: TerminalHeaderProps): JSX.Element {
  const statusColor =
    status === "ok" ? "#00D964" : status === "partial" ? "#FFA028" : "#FF4B4B";
  const statusLabel =
    status === "ok" ? "LIVE" : status === "partial" ? "PARTIAL" : "STALE";

  // Clamped at 0 — pipeline timestamps can lack a timezone and parse ahead
  // of local time, which read as a nonsense negative age.
  const age = generatedAt
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60)
        )
      )
    : null;

  return (
    <header className="bg-[#000000] border-b border-[#2E2E2E] sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-6 py-1.5 flex items-center justify-between gap-4">
        {/* Left: command line */}
        <div className="flex items-center gap-3 min-w-0 font-mono">
          <Link
            href="/"
            className="text-[#FFA028] text-[13px] font-bold tracking-[0.12em] hover:text-[#FFC46B] shrink-0"
          >
            LNKD
          </Link>
          <span className="text-[#2E2E2E] shrink-0">|</span>
          <span className="text-[13px] tracking-[0.08em] uppercase truncate">
            <span className="text-[#E6E6E6]">BOND</span>
            <span className="text-[#D89540]">&nbsp;MKT&nbsp;</span>
            <span className="text-[#FFA028] font-bold">&lt;GO&gt;</span>
            <span className="inline-block w-[7px] h-[13px] bg-[#FFA028] ml-1.5 align-middle animate-pulse" />
          </span>
          <span
            className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-1.5 py-0.5 shrink-0"
            style={{ color: statusColor, border: `1px solid ${statusColor}` }}
          >
            <span
              className="w-1.5 h-1.5 animate-pulse"
              style={{ backgroundColor: statusColor }}
            />
            {statusLabel}
          </span>
        </div>

        {/* Right: function boxes + status + clock */}
        <div className="flex items-center gap-4 font-mono text-xs shrink-0">
          {canRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              title={
                refreshError ?? "Regenerate the dashboard from fresh market data"
              }
              className="bg-[#B3231A] text-[#FFFFFF] px-2.5 py-1 font-bold uppercase tracking-wider hover:bg-[#D42B20] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? "UPDATING…" : "REFRESH"}
            </button>
          )}
          {refreshError && !refreshing && (
            <span className="text-[#FF4B4B]" title={refreshError}>
              REFRESH FAILED
            </span>
          )}
          {errors && errors.length > 0 && (
            <span className="text-[#FFA028]">
              {errors.length} WARN{errors.length > 1 ? "S" : ""}
            </span>
          )}
          {age !== null && (
            <span className="text-[#D89540] hidden md:inline">
              AGE{" "}
              <span className={age > 24 ? "text-[#FF4B4B]" : "text-[#E6E6E6]"}>
                {age}H
              </span>
            </span>
          )}
          <span className="text-[#FFA028] text-[13px] font-bold">
            <LiveClock />
          </span>
        </div>
      </div>
    </header>
  );
}
