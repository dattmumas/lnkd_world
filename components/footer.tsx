import Link from "next/link";
import Barcode from "@/components/ledger/barcode";

const INKS = [
  { c: "#141210", label: "K" },
  { c: "#55503F", label: "K70" },
  { c: "#857C6D", label: "S70" },
  { c: "#B3AA99", label: "S" },
  { c: "#C7331D", label: "R" },
  { c: "#E8E3D7", label: "T" },
];

// The paper's own section map: A = the Lead, B = the Second Section,
// C = Markets. Page numbers navigate the same broadsheet the landing lays out.
const INDEX = [
  { label: "On Label", page: "A1", href: "/onlabel" },
  { label: "Notes", page: "B1", href: "/notes" },
  { label: "Reading", page: "B2", href: "/reading" },
  { label: "Bookmarks", page: "B3", href: "/bookmarks" },
  { label: "Bonds", page: "C1", href: "/bonds" },
  { label: "Deals", page: "C2", href: "/deals" },
];

/**
 * The colophon. The account is ruled off (a ledger closes with a thin-over-
 * thick double rule), three columns file the paper's own record — how it's
 * set, its index, where it's filed from — and the sheet ends on the press
 * plate: the wordmark reversed out of an ink field, sliding off the bottom
 * edge. The masthead printed the impression; this is the plate that made it.
 */
export default function Footer() {
  return (
    <footer className="mt-auto">
      {/* Ruled off — the closing double rule of a balanced account. */}
      <div aria-hidden>
        <div className="border-t border-[var(--color-border)]" />
        <div className="border-t-[3px] border-[var(--color-border)] mt-[3px]" />
      </div>

      {/* The colophon record. */}
      <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] py-8 md:py-10">
        <div>
          <p className="ol-mono text-[10px] font-bold tracking-widest uppercase mb-2.5">
            Colophon
          </p>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] max-w-xs">
            Set in Space Grotesk, Space Mono &amp; Georgia. Authored in
            Obsidian, filed through Convex, pressed on Cloudflare. Ledger
            balanced daily.
          </p>
        </div>

        <nav aria-label="Site index">
          <p className="ol-mono text-[10px] font-bold tracking-widest uppercase mb-2.5">
            Index
          </p>
          <ul className="max-w-60 space-y-1.5">
            {INDEX.map((entry) => (
              <li key={entry.href}>
                <Link href={entry.href} className="group block">
                  <span className="ol-leader-row">
                    <span className="ol-mono text-xs font-bold uppercase group-hover:text-[var(--color-accent)]">
                      {entry.label}
                    </span>
                    <span className="ol-leader" />
                    <span className="ol-mono text-xs text-[var(--color-text-secondary)] shrink-0">
                      {entry.page}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="ol-mono text-[10px] font-bold tracking-widest uppercase mb-2.5">
            Filed from
          </p>
          <p className="ol-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)] uppercase">
            Seattle, Washington
            <br />
            47.60°N · 122.33°W
            <br />
            © 2026 Matthew Dumas
          </p>
        </div>
      </div>

      {/* The plate: ink field, proof furniture, and the reversed wordmark
          sliding off the bottom of the sheet. */}
      <div className="bg-[var(--color-border)] -mx-6 lg:-mx-12 px-6 lg:px-12 pt-6 overflow-hidden">
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
              *LNKD 2026* · End of press run
            </p>
          </div>
        </div>

        <div
          aria-hidden
          className="select-none text-[clamp(4.5rem,15vw,13rem)] mt-5 md:mt-6"
          style={{ fontFamily: "var(--font-display), Helvetica, sans-serif" }}
        >
          <div className="h-[0.5em] overflow-hidden">
            <span className="block font-bold leading-none tracking-tight text-[var(--color-bg)] -translate-y-[0.07em]">
              LNKD
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
