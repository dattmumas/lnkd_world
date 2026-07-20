"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { utcDayStartMs } from "@/lib/format";

/**
 * THE LEDGER wire — a one-line press ticker under the masthead: treasury
 * tenors from the latest bonds snapshot, this week's deal count, the latest
 * reading log entry. Reads the small purpose-built queries (bonds.tenors,
 * deals.landingSummary, readings.latest), never full tables.
 *
 * Marquee mechanics: the track renders two copies and slides -50%, so one
 * copy must be at least as wide as the strip or a blank gap sweeps through
 * every loop. The sequence repeat count is therefore MEASURED against the
 * strip (item count says nothing about pixels), and the duration scales
 * with the copy width to hold a constant speed. Under reduced motion the
 * sequence renders exactly once: repeat stays 1 and CSS drops the duplicate
 * copy (.ol-ticker-copy) — no doubled data in the static strip.
 */
export default function Ticker() {
  const bonds = useQuery(api.bonds.tenors);
  const summary = useQuery(api.deals.landingSummary, {
    todayStartMs: utcDayStartMs(),
  });
  const readings = useQuery(api.readings.latest, { n: 1 });

  const items = useMemo(() => {
    const out: string[] = [];
    const tenors = bonds?.tenors ?? {};
    for (const tenor of ["2Y", "10Y", "30Y"]) {
      const v = tenors[tenor];
      if (typeof v === "number") out.push(`${tenor} ${v.toFixed(2)}%`);
    }
    if (summary) out.push(`Deal flow · ${summary.weekCount} raised this week`);
    const latestReading = readings?.[0];
    if (latestReading) out.push(`Reading · ${latestReading.title}`);
    out.push("Filed from Seattle WA");
    return out;
  }, [bonds, summary, readings]);

  const loading =
    bonds === undefined || summary === undefined || readings === undefined;

  const stripRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef<HTMLDivElement | null>(null);
  const [marquee, setMarquee] = useState({ repeat: 1, durationS: 38 });

  useEffect(() => {
    const strip = stripRef.current;
    const seq = seqRef.current;
    if (!strip || !seq) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const measure = () => {
      if (mql.matches) {
        setMarquee({ repeat: 1, durationS: 38 });
        return;
      }
      const seqW = seq.scrollWidth;
      const stripW = strip.clientWidth;
      if (!seqW || !stripW) return;
      const repeat = Math.max(1, Math.ceil(stripW / seqW));
      // ~30px/s regardless of how wide the wire happens to be
      setMarquee({
        repeat,
        durationS: Math.max(24, Math.round((seqW * repeat) / 30)),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(strip);
    mql.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      mql.removeEventListener("change", measure);
    };
  }, [items, loading]);

  return (
    <section
      aria-label="The ledger"
      className="ol-ticker border-b-2 border-[var(--color-border)]"
    >
      <div className="flex items-stretch">
        <span className="ol-mono text-[10px] font-bold uppercase tracking-widest bg-[var(--color-accent)] text-[var(--color-bg)] px-3 py-1.5 shrink-0 flex items-center select-none">
          The Ledger
        </span>
        <div
          ref={stripRef}
          className="overflow-hidden motion-reduce:overflow-x-auto flex-1 min-w-0"
        >
          {loading ? (
            <p className="ol-mono text-[11px] uppercase tracking-widest text-[var(--color-text-secondary)] px-4 py-1.5">
              Receiving wire…
            </p>
          ) : (
            <div
              className="ol-ticker-track py-1.5"
              style={{ animationDuration: `${marquee.durationS}s` }}
            >
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  className={`flex items-center shrink-0 ${copy === 1 ? "ol-ticker-copy" : ""}`}
                  aria-hidden={copy === 1}
                >
                  {Array.from({ length: marquee.repeat }, (_, rep) => (
                    <div
                      key={rep}
                      ref={copy === 0 && rep === 0 ? seqRef : undefined}
                      className="flex items-center shrink-0"
                    >
                      {items.map((item, i) => (
                        <span
                          key={i}
                          className="ol-mono text-[11px] font-bold uppercase tracking-widest whitespace-nowrap flex items-center"
                        >
                          {item}
                          <span
                            className="text-[var(--color-accent)] px-4 select-none"
                            aria-hidden
                          >
                            {"//"}
                          </span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
