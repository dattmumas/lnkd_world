"use client";

import { motion } from "framer-motion";

/**
 * Shared panel wrapper — Bloomberg terminal aesthetic.
 * Bigger, more readable, proper spacing.
 */
export default function Panel({
  title,
  subtitle,
  accent = "#4a9eff",
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-[#111827] border border-[#1e293b] rounded overflow-hidden h-full ${className}`}
    >
      {/* Panel header bar */}
      <div className="flex items-center gap-2.5 px-5 py-2.5 bg-[#0f172a] border-b border-[#1e293b]">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
        <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#cbd5e1] font-medium">
          {title}
        </span>
        {subtitle && (
          <span className="font-mono text-xs text-[#94a3b8] ml-auto">
            {subtitle}
          </span>
        )}
      </div>
      {/* Panel content */}
      <div className="p-5">{children}</div>
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
    1: "#00ff88",
    0: "#94a3b8",
    [-1]: "#ff6b6b",
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
    clamped >= 70 ? "#00ff88" : clamped >= 40 ? "#fbbf24" : "#ff6b6b";

  return (
    <div
      className="rounded-full bg-[#1e293b] overflow-hidden"
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
  color = "#4a9eff",
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
  if (value == null) return <span className="text-[#64748b]">--</span>;

  const color = value > 0 ? "#00ff88" : value < 0 ? "#ff6b6b" : "#94a3b8";
  const sign = value > 0 ? "+" : "";

  return (
    <span className="font-mono text-sm" style={{ color }}>
      {sign}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
