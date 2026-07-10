"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The LNKD mark: the black square printed slightly off-register — the red
 * plate lands 12% offset behind the ink, the way a rushed press run looks.
 * A white ledger notch is knocked out of the ink layer.
 *
 * Pass `interactive` (masthead instances) and the cursor becomes a pencil:
 * you can scribble on the mark, and each stroke fades out five seconds after
 * it was drawn. Static instances (nav, breadcrumbs) skip all of it.
 */

interface Stroke {
  id: number;
  d: string;
  fading: boolean;
}

const PENCIL_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'%3E%3Cpath d='M2 16 L3.2 11.8 L13 2 L16 5 L6.2 14.8 Z' fill='%23F7F4EE' stroke='%23141210' stroke-width='1.4'/%3E%3Cpath d='M2 16 L3.2 11.8 L6.2 14.8 Z' fill='%23C7331D'/%3E%3C/svg%3E") 1 16, crosshair`;

export default function LedgerMark({
  size = 40,
  className,
  interactive = false,
}: {
  size?: number;
  className?: string;
  interactive?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const activeId = useRef<number | null>(null);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const toPoint = (e: React.PointerEvent): string => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  };

  const startStroke = (e: React.PointerEvent) => {
    if (!interactive) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const id = nextId.current++;
    activeId.current = id;
    setStrokes((s) => [...s, { id, d: `M ${toPoint(e)}`, fading: false }]);
    // The writing disappears 5s after it was written (last 500ms fade).
    timers.current.push(
      setTimeout(() => {
        setStrokes((s) => s.map((k) => (k.id === id ? { ...k, fading: true } : k)));
      }, 4500),
      setTimeout(() => {
        setStrokes((s) => s.filter((k) => k.id !== id));
      }, 5000),
    );
  };

  const extendStroke = (e: React.PointerEvent) => {
    if (activeId.current === null) return;
    const id = activeId.current;
    setStrokes((s) =>
      s.map((k) => (k.id === id ? { ...k, d: `${k.d} L ${toPoint(e)}` } : k)),
    );
  };

  const endStroke = () => {
    activeId.current = null;
  };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden
      shapeRendering="crispEdges"
      style={interactive ? { cursor: PENCIL_CURSOR, touchAction: "none" } : undefined}
      onPointerDown={startStroke}
      onPointerMove={extendStroke}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
    >
      {/* red plate, misregistered */}
      <rect x="12" y="12" width="82" height="82" fill="#C7331D" />
      {/* ink plate */}
      <rect x="0" y="0" width="82" height="82" fill="#141210" />
      {/* knocked-out ledger lines */}
      <rect x="14" y="24" width="54" height="7" fill="#F7F4EE" />
      <rect x="14" y="39" width="40" height="7" fill="#F7F4EE" />
      <rect x="14" y="54" width="47" height="7" fill="#F7F4EE" />
      {/* your handwriting, in red pencil */}
      {strokes.map((s) => (
        <path
          key={s.id}
          d={s.d}
          fill="none"
          stroke="#C7331D"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          shapeRendering="auto"
          style={{ opacity: s.fading ? 0 : 1, transition: "opacity 500ms ease" }}
        />
      ))}
    </svg>
  );
}
