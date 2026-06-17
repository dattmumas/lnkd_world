"use client";

import { motion } from "framer-motion";

/**
 * Shared panel wrapper — Bloomberg terminal aesthetic.
 * Bigger, more readable, proper spacing.
 */
export default function Panel({
  title,
  subtitle,
  note,
  accent = "#2563eb",
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  note?: string;
  accent?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white border border-[#e6e8ee] rounded-lg overflow-hidden h-full shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.03)] ${className}`}
    >
      {/* Panel header bar */}
      <div className="flex items-center gap-2 px-3.5 py-2 bg-[#fafbfc] border-b border-[#eef0f3]">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
        <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-[#4a5160] font-semibold">
          {title}
        </span>
        {subtitle && (
          <span className="font-mono text-[11px] text-[#6e7682] ml-auto tabular-nums">
            {subtitle}
          </span>
        )}
      </div>
      {/* Optional plain-English explainer for users */}
      {note && (
        <p className="px-3.5 pt-2.5 text-[11px] leading-snug text-[#6b7280]">
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
    1: "#0a8f57",
    0: "#6e7682",
    [-1]: "#d23b3b",
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
    clamped >= 70 ? "#0a8f57" : clamped >= 40 ? "#a86e15" : "#d23b3b";

  return (
    <div
      className="rounded-full bg-[#e8eaee] overflow-hidden"
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
  color = "#2563eb",
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
  if (value == null) return <span className="text-[#6b7280]">--</span>;

  const color = value > 0 ? "#0a8f57" : value < 0 ? "#d23b3b" : "#6e7682";
  const sign = value > 0 ? "+" : "";

  return (
    <span className="font-mono text-sm" style={{ color }}>
      {sign}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
