/**
 * A real Code 39 barcode, rendered as SVG rects — scannable, not decorative
 * glyph soup. Each character is 9 elements (5 bars, 4 spaces), 3 of them wide
 * (3:1 ratio), 1-unit gap between characters, * as start/stop.
 */
const CODE39: Record<string, string> = {
  "0": "000110100", "1": "100100001", "2": "001100001", "3": "101100000",
  "4": "000110001", "5": "100110000", "6": "001110000", "7": "000100101",
  "8": "100100100", "9": "001100100",
  A: "100001001", B: "001001001", C: "101001000", D: "000011001",
  E: "100011000", F: "001011000", G: "000001101", H: "100001100",
  I: "001001100", J: "000011100", K: "100000011", L: "001000011",
  M: "101000010", N: "000010011", O: "100010010", P: "001010010",
  Q: "000000111", R: "100000110", S: "001000110", T: "000010110",
  U: "110000001", V: "011000001", W: "111000000", X: "010010001",
  Y: "110010000", Z: "011010000",
  "-": "010000101", ".": "110000100", " ": "011000100", "*": "010010100",
};

const NARROW = 1;
const WIDE = 3;

export default function Barcode({
  value,
  height = 34,
  className,
}: {
  value: string; // A-Z 0-9 - . and space only
  height?: number;
  className?: string;
}) {
  const chars = `*${value.toUpperCase()}*`.split("");
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const c of chars) {
    const pattern = CODE39[c] ?? CODE39[" "];
    for (let i = 0; i < 9; i++) {
      const w = pattern[i] === "1" ? WIDE : NARROW;
      if (i % 2 === 0) bars.push({ x, w }); // even indices are bars
      x += w;
    }
    x += NARROW; // inter-character gap
  }
  const total = x - NARROW;

  return (
    <svg
      viewBox={`0 0 ${total} ${height}`}
      height={height}
      className={className}
      role="img"
      aria-label={`Barcode: ${value}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />
      ))}
    </svg>
  );
}
