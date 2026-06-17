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
      ? "#00ff88"
      : status === "partial"
        ? "#fbbf24"
        : "#ff6b6b";

  const age = generatedAt
    ? Math.round(
        (Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60)
      )
    : null;

  return (
    <header className="bg-[#0f172a] border-b border-[#1e293b] sticky top-0 z-50">
      {/* Top accent line */}
      <motion.div
        className="h-[2px] bg-gradient-to-r from-[#00ff88] via-[#4a9eff] to-[#a855f7]"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{ transformOrigin: "left" }}
      />

      <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-2">
            <span className="font-mono text-[#00ff88] text-base font-bold tracking-widest group-hover:text-[#4a9eff] transition-colors">
              LNKD
            </span>
          </Link>
          <div className="h-5 w-px bg-[#1e293b]" />
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <span className="font-mono text-sm text-[#94a3b8] tracking-widest uppercase">
              Bond Market Terminal
            </span>
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: statusColor }}
            />
          </motion.div>
        </div>

        {/* Right: Status + Clock */}
        <div className="flex items-center gap-5 font-mono text-xs text-[#cbd5e1]">
          {canRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              title={
                refreshError ?? "Regenerate the dashboard from fresh market data"
              }
              className="flex items-center gap-1.5 rounded border border-[#1e293b] px-2.5 py-1 uppercase tracking-wider text-[#00ff88] transition-colors hover:border-[#00ff88] hover:bg-[#00ff88]/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>
                ↻
              </span>
              {refreshing ? "Updating…" : "Refresh"}
            </button>
          )}
          {refreshError && !refreshing && (
            <span className="text-[#ff6b6b]" title={refreshError}>
              refresh failed
            </span>
          )}
          {errors && errors.length > 0 && (
            <span className="text-[#fbbf24]">
              {errors.length} warning{errors.length > 1 ? "s" : ""}
            </span>
          )}
          {age !== null && (
            <span>
              DATA AGE:{" "}
              <span className={age > 24 ? "text-[#ff6b6b]" : "text-[#94a3b8]"}>
                {age}h
              </span>
            </span>
          )}
          <span className="text-[#94a3b8] text-sm">
            <LiveClock />
          </span>
        </div>
      </div>
    </header>
  );
}
