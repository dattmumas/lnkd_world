"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SubscribeForm from "@/components/onlabel/subscribe-form";
import LedgerMark from "@/components/ledger/mark";

const DISMISS_KEY = "ol-slip-dismissed-at";
const SUBSCRIBED_KEY = "ol-slip-subscribed";
const DISMISS_DAYS = 14;
const SHOW_DELAY_MS = 2500;

// No popup where a form already lives, or on private/terminal surfaces.
const SKIP_PREFIXES = ["/admin", "/bonds", "/onlabel", "/subscribe", "/forgot-password"];

/**
 * The subscription slip: a receipt ticket that skids in from the left,
 * wobbles as it settles, and drops off the bottom of the desk when closed.
 * Dismissal sticks for two weeks; a successful subscribe retires it for good.
 */
export default function SubscribePopup() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"hidden" | "in" | "leaving">("hidden");

  useEffect(() => {
    if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;
    try {
      if (localStorage.getItem(SUBSCRIBED_KEY)) return;
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return;
    } catch {
      // storage unavailable — show anyway
    }
    const t = setTimeout(() => setPhase("in"), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [pathname]);

  const dismiss = (subscribed: boolean) => {
    try {
      if (subscribed) localStorage.setItem(SUBSCRIBED_KEY, "1");
      else localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // fine — it just shows again next visit
    }
    setPhase("leaving");
  };

  if (phase === "hidden") return null;

  return (
    <div
      role="dialog"
      aria-label="Subscribe to On Label"
      className={`fixed bottom-6 left-6 z-50 w-[22rem] max-w-[calc(100vw-3rem)] ol-box-heavy bg-[var(--color-paper-raised)] px-5 py-4 ${
        phase === "leaving" ? "ol-slip-drop" : "ol-slip-skid"
      }`}
      onAnimationEnd={(e) => {
        // ol-fade-out is the reduced-motion twin of the drop.
        if (e.animationName === "ol-slip-drop" || e.animationName === "ol-fade-out") {
          setPhase("hidden");
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="ol-mono text-[10px] font-bold text-[var(--color-accent)] tracking-widest uppercase">
          Subscription slip · Nº 001
        </p>
        <button
          onClick={() => dismiss(false)}
          aria-label="Close"
          className="ol-mono text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <LedgerMark size={30} className="shrink-0" />
        <p
          className="text-lg font-bold leading-tight"
          style={{ fontFamily: "var(--font-display), Helvetica, sans-serif" }}
        >
          On Label, weekly.
        </p>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-2">
        Early-stage consumer health companies. Who raised, what they&apos;re
        actually selling, and whether the numbers work.
      </p>

      <div className="mt-3">
        <SubscribeForm onSuccess={() => setTimeout(() => dismiss(true), 2000)} />
      </div>
    </div>
  );
}
