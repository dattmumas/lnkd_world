import Barcode from "@/components/ledger/barcode";

const INKS = [
  { c: "#141210", label: "K" },
  { c: "#55503F", label: "K70" },
  { c: "#9A937F", label: "K40" },
  { c: "#C7331D", label: "R" },
  { c: "#EDE7DA", label: "T" },
];

export default function Footer() {
  return (
    <footer className="border-t-2 border-[var(--color-border)] py-8 mt-auto">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        {/* Ink calibration strip — the proof sheet's color check */}
        <div>
          <div className="flex" aria-hidden>
            {INKS.map((ink) => (
              <span
                key={ink.label}
                className="block w-7 h-7 border border-[var(--color-border)] -ml-px first:ml-0"
                style={{ backgroundColor: ink.c }}
                title={ink.label}
              />
            ))}
          </div>
          <p className="ol-mono text-[10px] text-[var(--color-text-secondary)] mt-1.5 tracking-widest uppercase">
            Ink check · K·R·T calibrated
          </p>
        </div>

        {/* A real Code 39 barcode — scan it */}
        <div className="text-right">
          <Barcode value="LNKD 2026" height={34} className="text-[var(--color-text)] w-56" />
          <p className="ol-mono text-[10px] text-[var(--color-text-secondary)] mt-1.5 tracking-widest uppercase">
            *LNKD 2026* · Seattle WA · © Matthew Dumas
          </p>
        </div>
      </div>
    </footer>
  );
}
