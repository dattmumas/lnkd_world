"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * On Label email capture — posts straight to the Beehiiv API through
 * beehiiv.subscribe (double-opt-in/welcome handled by Beehiiv). The `company`
 * field is a honeypot: visually hidden, so any value means a bot.
 */
export default function SubscribeForm() {
  const subscribe = useAction(api.beehiiv.subscribe);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    subscribe({ email, company: company || undefined })
      .then((r) => {
        if (r.ok) {
          setState("done");
        } else {
          setState("error");
          setError(r.error ?? "Something jammed — try again.");
        }
      })
      .catch(() => {
        setState("error");
        setError("Something jammed — try again.");
      });
  };

  if (state === "done") {
    return (
      <p className="ol-mono text-sm font-bold text-[var(--color-accent)]">
        RECEIPT PRINTING — CHECK YOUR INBOX ▸
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@operator.com"
        className="ol-mono text-sm flex-1 border-2 border-[var(--color-border)] bg-white px-3 py-2.5 placeholder-[var(--color-leader)] focus:outline-none focus:border-[var(--color-accent)]"
      />
      {/* Honeypot — humans never see it */}
      <input
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        name="company"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="ol-mono text-sm font-bold bg-[var(--color-border)] text-[var(--color-bg)] px-5 py-2.5 ol-btn-press disabled:opacity-60"
      >
        {state === "sending" ? "PRINTING…" : "SUBSCRIBE →"}
      </button>
      {error && (
        <p className="ol-mono text-xs text-[var(--color-accent)] sm:self-center">{error}</p>
      )}
    </form>
  );
}
