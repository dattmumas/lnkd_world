"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
    status === "ok"
      ? "#0a8f57"
      : status === "partial"
        ? "#a86e15"
        : "#d23b3b";

  const age = generatedAt
    ? Math.round(
        (Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60)
      )
    : null;

  return (
    <header className="bg-white/85 backdrop-blur-md border-b border-[#e8eaee] sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-6 py-2 flex items-center justify-between">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-[2px] bg-[#0a8f57] group-hover:bg-[#067a49] transition-colors" />
            <span className="font-mono text-[#0a8f57] text-base font-bold tracking-[0.18em] group-hover:text-[#067a49] transition-colors">
              LNKD
            </span>
          </Link>
          <div className="h-4 w-px bg-[#e0e3ea]" />
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5"
          >
            <span className="font-mono text-[13px] text-[#334155] tracking-[0.18em] uppercase font-medium">
              Bond Market Terminal
            </span>
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: statusColor }}
            />
          </motion.div>
        </div>

        {/* Right: Status + Clock */}
        <div className="flex items-center gap-5 font-mono text-xs text-[#374151]">
          {canRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              title={
                refreshError ?? "Regenerate the dashboard from fresh market data"
              }
              className="flex items-center gap-1.5 rounded border border-[#e8eaee] px-2.5 py-1 uppercase tracking-wider text-[#0a8f57] transition-colors hover:border-[#0a8f57] hover:bg-[#0a8f57]/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>
                ↻
              </span>
              {refreshing ? "Updating…" : "Refresh"}
            </button>
          )}
          {refreshError && !refreshing && (
            <span className="text-[#d23b3b]" title={refreshError}>
              refresh failed
            </span>
          )}
          {errors && errors.length > 0 && (
            <span className="text-[#a86e15]">
              {errors.length} warning{errors.length > 1 ? "s" : ""}
            </span>
          )}
          {age !== null && (
            <span>
              DATA AGE:{" "}
              <span className={age > 24 ? "text-[#d23b3b]" : "text-[#6e7682]"}>
                {age}h
              </span>
            </span>
          )}
          <span className="text-[#6e7682] text-sm">
            <LiveClock />
          </span>
        </div>
      </div>
    </header>
  );
}
