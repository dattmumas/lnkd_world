"use client";

/**
 * Hand-rolled SVG line chart (no chart dep — same approach as hero-graph.tsx).
 * Generic: the Overview tab feeds it follower counts, the Analytics tab feeds
 * it reply-ROI series and per-post sparklines. Each series is normalized to its
 * own y-range so two series with different units can be compared by shape.
 */

export interface ChartPoint {
  x: number; // ms epoch (or any increasing value)
  y: number;
  label: string; // tooltip text
}

interface LineChartProps {
  series: ChartPoint[];
  series2?: ChartPoint[]; // dashed secondary series, own y-scale
  height?: number;
  formatY?: (n: number) => string;
}

const W = 600;
const PAD = { top: 12, right: 8, bottom: 8, left: 8 };

function path(points: ChartPoint[], h: number, xr: [number, number], yr: [number, number]): string {
  const [x0, x1] = xr;
  const [y0, y1] = yr;
  const xs = (x: number) =>
    PAD.left + ((x - x0) / Math.max(x1 - x0, 1)) * (W - PAD.left - PAD.right);
  const ys = (y: number) =>
    h - PAD.bottom - ((y - y0) / Math.max(y1 - y0, 1)) * (h - PAD.top - PAD.bottom);
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(p.x).toFixed(1)},${ys(p.y).toFixed(1)}`).join(" ");
}

export function LineChart({ series, series2, height = 200, formatY }: LineChartProps) {
  if (series.length < 2) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Not enough data yet — the chart appears after two snapshots.
      </p>
    );
  }
  const fmt = formatY ?? ((n: number) => String(n));
  const xr: [number, number] = [
    Math.min(...series.map((p) => p.x), ...(series2 ?? []).map((p) => p.x)),
    Math.max(...series.map((p) => p.x), ...(series2 ?? []).map((p) => p.x)),
  ];
  const range = (pts: ChartPoint[]): [number, number] => {
    const lo = Math.min(...pts.map((p) => p.y));
    const hi = Math.max(...pts.map((p) => p.y));
    return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
  };
  const yr = range(series);
  const d = path(series, height, xr, yr);
  const area = `${d} L${W - PAD.right},${height - PAD.bottom} L${PAD.left},${height - PAD.bottom} Z`;
  const xs = (x: number) =>
    PAD.left + ((x - xr[0]) / Math.max(xr[1] - xr[0], 1)) * (W - PAD.left - PAD.right);
  const ys = (y: number) =>
    height - PAD.bottom - ((y - yr[0]) / Math.max(yr[1] - yr[0], 1)) * (height - PAD.top - PAD.bottom);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label="Line chart"
      >
        <path d={area} fill="var(--color-accent)" opacity="0.08" />
        <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
        {series2 && series2.length >= 2 && (
          <path
            d={path(series2, height, xr, range(series2))}
            fill="none"
            stroke="var(--color-text-secondary)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}
        {series.map((p) => (
          <circle key={p.x} cx={xs(p.x)} cy={ys(p.y)} r="3" fill="var(--color-accent)">
            <title>{p.label}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mt-1">
        <span>
          {fmt(yr[0])} – {fmt(yr[1])}
        </span>
        <span>latest: {fmt(series[series.length - 1].y)}</span>
      </div>
    </div>
  );
}
