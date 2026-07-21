import Link from "next/link";

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
 * thick double rule), then three columns file the paper's own record — how
 * it's set, its index, and where it's filed from.
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

    </footer>
  );
}
