/**
 * A receipt tear-off edge: a sawtooth vector rule. Replaces a plain divider
 * where a section "tears" away from the masthead.
 */
export default function Tear({ className }: { className?: string }) {
  const teeth = 64;
  const w = 8;
  const points = [`0,10`];
  for (let i = 0; i < teeth; i++) {
    points.push(`${i * w + w / 2},2`);
    points.push(`${(i + 1) * w},10`);
  }
  return (
    <svg
      viewBox={`0 0 ${teeth * w} 12`}
      className={className}
      height={12}
      width="100%"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#141210"
        strokeWidth="2"
      />
    </svg>
  );
}
