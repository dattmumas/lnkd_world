import { type JSX } from "react";

interface PanelProps {
  title: string;
  subtitle?: string;
  note?: string;
  accent?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared panel wrapper for the bonds dashboard — Bloomberg register: flat
 * black tile, hairline border, thin amber title strip. Always `h-full` so
 * grid rows tile edge-to-edge with no voids.
 */
export default function Panel({
  title,
  subtitle,
  note,
  accent = "#FB8B1E",
  className = "",
  children,
}: PanelProps): JSX.Element {
  return (
    <div className={`bg-[#000000] border border-[#2E2E2E] h-full ${className}`}>
      {/* Panel title strip */}
      <div className="flex items-center gap-1.5 px-2 py-[3px] bg-[#141414] border-b border-[#2E2E2E]">
        <div className="w-1.5 h-1.5" style={{ backgroundColor: accent }} />
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#FB8B1E] font-bold">
          {title}
        </span>
        {subtitle && (
          <span className="font-mono text-[10px] text-[#FB8B1E] ml-auto tabular-nums uppercase">
            {subtitle}
          </span>
        )}
      </div>
      {/* Optional plain-English explainer for users */}
      {note && (
        <p className="px-2 pt-1.5 text-[10px] leading-snug text-[#7C7C7C]">
          {note}
        </p>
      )}
      {/* Panel content */}
      <div className="p-2">{children}</div>
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
  const sizeMap = { sm: "text-[11px]", md: "text-sm", lg: "text-base" };
  const colors: Record<number, string> = {
    1: "#00C25B",
    0: "#FB8B1E",
    [-1]: "#FF433D",
  };
  const arrows: Record<number, string> = {
    1: "▲",
    0: "◆",
    [-1]: "▼",
  };

  const d = direction > 0 ? 1 : direction < 0 ? -1 : 0;

  return (
    <span className={`${sizeMap[size]}`} style={{ color: colors[d] }}>
      {arrows[d]}
    </span>
  );
}

/**
 * Conviction bar (0-100) — flat segmented blocks, terminal style.
 */
export function ConvictionBar({
  value,
  segments = 10,
}: {
  value: number;
  segments?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round((clamped / 100) * segments);
  const color =
    clamped >= 70 ? "#00C25B" : clamped >= 40 ? "#FB8B1E" : "#FF433D";

  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          className="w-[6px] h-[9px]"
          style={{ backgroundColor: i < filled ? color : "#1F1F1F" }}
        />
      ))}
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
  color = "#FB8B1E",
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
        <polygon points={areaPoints} fill={color} fillOpacity={0.08} />
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
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
  if (value == null) return <span className="text-[#7C7C7C]">--</span>;

  const color = value > 0 ? "#00C25B" : value < 0 ? "#FF433D" : "#FB8B1E";
  const sign = value > 0 ? "+" : "";

  return (
    <span className="font-mono text-[11px] tabular-nums" style={{ color }}>
      {sign}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
