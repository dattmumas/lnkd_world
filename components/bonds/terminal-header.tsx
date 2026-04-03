"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

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
}: {
  generatedAt: string;
  status: string;
  errors?: string[];
}) {
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

      <div className="max-w-[1920px] mx-auto px-3 py-2 flex items-center justify-between">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-2">
            <span className="font-mono text-[#00ff88] text-sm font-bold tracking-widest group-hover:text-[#4a9eff] transition-colors">
              LNKD
            </span>
          </Link>
          <div className="h-4 w-px bg-[#1e293b]" />
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <span className="font-mono text-xs text-[#94a3b8] tracking-widest uppercase">
              Bond Market Terminal
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: statusColor }}
            />
          </motion.div>
        </div>

        {/* Right: Status + Clock */}
        <div className="flex items-center gap-4 font-mono text-[10px] text-[#4a5568]">
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
          <span className="text-[#94a3b8]">
            <LiveClock />
          </span>
        </div>
      </div>
    </header>
  );
}
