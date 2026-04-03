"use client";

import { motion } from "framer-motion";

/**
 * Shared panel wrapper for Bloomberg terminal aesthetic.
 * Every dashboard section is wrapped in this.
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
      className={`bg-[#111827] border border-[#1e293b] rounded-sm overflow-hidden ${className}`}
    >
      {/* Panel header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0f172a] border-b border-[#1e293b]">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#94a3b8]">
          {title}
        </span>
        {subtitle && (
          <span className="font-mono text-[10px] text-[#4a5568] ml-auto">
            {subtitle}
          </span>
        )}
      </div>
      {/* Panel content */}
      <div className="p-3">{children}</div>
    </div>
  );
}

/**
 * Animated number that counts up from 0 to target value.
 */
export function AnimatedValue({
  value,
  suffix = "",
  prefix = "",
  decimals = 2,
  color,
  className = "",
}: {
  value: number | null | undefined;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  color?: string;
  className?: string;
}) {
  if (value == null) return <span className="text-[#4a5568]">--</span>;

  return (
    <motion.span
      className={className}
      style={{ color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {prefix}
      {typeof value === "number" ? value.toFixed(decimals) : value}
      {suffix}
    </motion.span>
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
  const sizeMap = { sm: "text-xs", md: "text-sm", lg: "text-lg" };
  const colors = {
    1: "text-[#00ff88]",
    0: "text-[#4a5568]",
    [-1]: "text-[#ff6b6b]",
  };
  const arrows = {
    1: "\u25B2",
    0: "\u25C6",
    [-1]: "\u25BC",
  };

  const d = direction > 0 ? 1 : direction < 0 ? -1 : 0;

  return (
    <span className={`${sizeMap[size]} ${colors[d as keyof typeof colors]}`}>
      {arrows[d as keyof typeof arrows]}
    </span>
  );
}

/**
 * Conviction bar (0-100).
 */
export function ConvictionBar({
  value,
  maxWidth = 80,
}: {
  value: number;
  maxWidth?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 70 ? "#00ff88" : clamped >= 40 ? "#fbbf24" : "#ff6b6b";

  return (
    <div
      className="h-1.5 rounded-full bg-[#1e293b] overflow-hidden"
      style={{ width: maxWidth }}
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
  width = 80,
  height = 24,
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
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  });

  const areaPoints = showArea
    ? `0,${height} ` + points.join(" ") + ` ${width},${height}`
    : "";

  return (
    <svg width={width} height={height} className="inline-block">
      {showArea && (
        <polygon
          points={areaPoints}
          fill={color}
          fillOpacity={0.1}
        />
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Current value dot */}
      <circle
        cx={width}
        cy={parseFloat(points[points.length - 1].split(",")[1])}
        r={2}
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
  if (value == null) return <span className="text-[#4a5568]">--</span>;

  const color = value > 0 ? "#00ff88" : value < 0 ? "#ff6b6b" : "#4a5568";
  const sign = value > 0 ? "+" : "";

  return (
    <span className="font-mono text-xs" style={{ color }}>
      {sign}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
