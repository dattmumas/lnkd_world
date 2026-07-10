"use client";

import { motion } from "framer-motion";
import { type JSX } from "react";

interface PanelProps {
  title: string;
  subtitle?: string;
  note?: string;
  accent?: string;
  className?: string;
  /** Drop `h-full` so the card takes its intrinsic height (needed in masonry). */
  fitContent?: boolean;
  children: React.ReactNode;
}

/**
 * Shared panel wrapper for the bonds dashboard — Bloomberg register: black
 * panel, hairline gray border, amber title strip. `h-full` by default (for
 * matched-height rows); pass `fitContent` inside a masonry column.
 */
export default function Panel({
  title,
  subtitle,
  note,
  accent = "#FFA028",
  className = "",
  fitContent = false,
  children,
}: PanelProps): JSX.Element {
  return (
    <div
      className={`bg-[#0B0B0B] border border-[#2E2E2E] rounded-none overflow-hidden ${fitContent ? "" : "h-full"} ${className}`}
    >
      {/* Panel header bar */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[#000000] border-b border-[#2E2E2E]">
        <div className="w-1.5 h-1.5" style={{ backgroundColor: accent }} />
        <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#FFA028] font-bold">
          {title}
        </span>
        {subtitle && (
          <span className="font-mono text-[11px] text-[#D89540] ml-auto tabular-nums">
            {subtitle}
          </span>
        )}
      </div>
      {/* Optional plain-English explainer for users */}
      {note && (
        <p className="px-3.5 pt-2.5 text-[11px] leading-snug text-[#8F8F8F]">
          {note}
        </p>
      )}
      {/* Panel content */}
      <div className="p-3.5">{children}</div>
    </div>
  );
}

/**
 * Direction arrow with color coding.
 */
export function DirectionArrow({
  direction,
  size = "sm",
}: {
  direction: number;
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = { sm: "text-sm", md: "text-base", lg: "text-xl" };
  const colors: Record<number, string> = {
    1: "#00D964",
    0: "#D89540",
    [-1]: "#FF4B4B",
  };
  const arrows: Record<number, string> = {
    1: "\u25B2",
    0: "\u25C6",
    [-1]: "\u25BC",
  };

  const d = direction > 0 ? 1 : direction < 0 ? -1 : 0;

  return (
    <span className={`${sizeMap[size]}`} style={{ color: colors[d] }}>
      {arrows[d]}
    </span>
  );
}

/**
 * Conviction bar (0-100).
 */
export function ConvictionBar({
  value,
  maxWidth = 120,
  height = 6,
}: {
  value: number;
  maxWidth?: number;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 70 ? "#00D964" : clamped >= 40 ? "#FFA028" : "#FF4B4B";

  return (
    <div
      className="rounded-full bg-[#2E2E2E] overflow-hidden"
      style={{ width: maxWidth, height }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

/**
 * Mini sparkline using SVG polyline.
 */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "#62B0FF",
  showArea = false,
}: {
  data: { value: number }[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
}) {
  if (!data || data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const areaPoints = showArea
    ? `0,${height} ` + points.join(" ") + ` ${width},${height}`
    : "";

  return (
    <svg width={width} height={height} className="inline-block">
      {showArea && (
        <polygon points={areaPoints} fill={color} fillOpacity={0.1} />
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={parseFloat(points[points.length - 1].split(",")[1])}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}

/**
 * Change badge with color.
 */
export function ChangeBadge({
  value,
  suffix = "",
  decimals = 2,
}: {
  value: number | null | undefined;
  suffix?: string;
  decimals?: number;
}) {
  if (value == null) return <span className="text-[#8F8F8F]">--</span>;

  const color = value > 0 ? "#00D964" : value < 0 ? "#FF4B4B" : "#D89540";
  const sign = value > 0 ? "+" : "";

  return (
    <span className="font-mono text-sm" style={{ color }}>
      {sign}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
