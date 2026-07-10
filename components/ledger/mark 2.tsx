/**
 * The LNKD mark: the black square printed slightly off-register — the red
 * plate lands 12% offset behind the ink, the way a rushed press run looks.
 * A white ledger notch is knocked out of the ink layer.
 */
export default function LedgerMark({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden
      shapeRendering="crispEdges"
    >
      {/* red plate, misregistered */}
      <rect x="12" y="12" width="82" height="82" fill="#C7331D" />
      {/* ink plate */}
      <rect x="0" y="0" width="82" height="82" fill="#141210" />
      {/* knocked-out ledger lines */}
      <rect x="14" y="24" width="54" height="7" fill="#F7F4EE" />
      <rect x="14" y="39" width="40" height="7" fill="#F7F4EE" />
      <rect x="14" y="54" width="47" height="7" fill="#F7F4EE" />
    </svg>
  );
}
