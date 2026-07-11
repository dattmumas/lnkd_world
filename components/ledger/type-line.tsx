"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A mono line that prints itself character by character, like the receipt
 * printer finishing the header — block cursor while printing, gone when done.
 * Reduced motion (or any re-render after the first print) renders instantly.
 * Layout is reserved up front: the full text sits invisible underneath while
 * the printed copy overlays it, so nothing reflows mid-print.
 */
export default function TypeLine({
  text,
  className,
  charMs = 18,
  startDelayMs = 350,
}: {
  text: string;
  className?: string;
  charMs?: number;
  startDelayMs?: number;
}) {
  const [count, setCount] = useState(0);
  const [printing, setPrinting] = useState(false);
  const done = count >= text.length;
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      setCount(text.length);
      return;
    }
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setPrinting(true);
      interval = setInterval(() => {
        i++;
        setCount(i);
        if (i >= text.length) {
          clearInterval(interval);
          setPrinting(false);
        }
      }, charMs);
    }, startDelayMs);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, charMs, startDelayMs]);

  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      {/* Invisible full text reserves the final layout */}
      <span aria-hidden className="invisible">
        {text}
      </span>
      <span className="absolute inset-0" aria-label={text}>
        <span aria-hidden>{text.slice(0, count)}</span>
        {printing && !done && (
          <span
            aria-hidden
            className="inline-block w-[0.55em] h-[1em] bg-[var(--color-accent)] align-text-bottom"
          />
        )}
      </span>
    </span>
  );
}
