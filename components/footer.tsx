import Barcode from "@/components/ledger/barcode";

const INKS = [
  { c: "#141210", label: "K" },
  { c: "#55503F", label: "K70" },
  { c: "#857C6D", label: "S70" },
  { c: "#B3AA99", label: "S" },
  { c: "#C7331D", label: "R" },
  { c: "#E8E3D7", label: "T" },
];

/**
 * The colophon: a stone slab with the wordmark carved into it — the site's
 * one engraved surface — then an ink-black strip with the ink check and the
 * barcode. Both bands bleed to the viewport edges past the page padding.
 */
export default function Footer() {
  return (
    <footer className="mt-auto">
      {/* The carved slab. The full wordmark is engraved, seated on the slab's
          bottom edge; the crop box trims only the line-box whitespace above
          the caps and below the baseline. */}
      <div className="ol-stone-field -mx-6 lg:-mx-12 px-6 lg:px-12 pt-10 md:pt-16 border-t-2 border-[var(--color-border)] overflow-hidden">
        <div
          aria-hidden
          className="select-none text-[clamp(6rem,22vw,20rem)]"
          style={{ fontFamily: "var(--font-display), Helvetica, sans-serif" }}
        >
          <div className="h-[0.72em] overflow-hidden">
            <span className="ol-carved block font-bold leading-none tracking-tight -translate-y-[0.1em]">
              LNKD
            </span>
          </div>
        </div>
      </div>

      {/* Ink-black strip: the proof sheet's color check and the barcode. */}
      <div className="bg-[var(--color-border)] text-[var(--color-bg)] -mx-6 lg:-mx-12 px-6 lg:px-12 py-6">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex" aria-hidden>
              {INKS.map((ink) => (
                <span
                  key={ink.label}
                  className="block w-7 h-7 border border-[rgba(243,240,233,0.3)] -ml-px first:ml-0"
                  style={{ backgroundColor: ink.c }}
                  title={ink.label}
                />
              ))}
            </div>
            <p className="ol-mono text-[10px] text-[rgba(243,240,233,0.55)] mt-1.5 tracking-widest uppercase">
              Ink check · K·S·R·T calibrated
            </p>
          </div>

          {/* A real Code 39 barcode — scan it */}
          <div className="text-right">
            <Barcode value="LNKD 2026" height={34} className="text-[var(--color-bg)] w-56" />
            <p className="ol-mono text-[10px] text-[rgba(243,240,233,0.55)] mt-1.5 tracking-widest uppercase">
              *LNKD 2026* · Seattle WA · © Matthew Dumas
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
