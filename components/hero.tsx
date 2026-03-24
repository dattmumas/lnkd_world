"use client";

import dynamic from "next/dynamic";

const HeroGraph = dynamic(() => import("@/components/hero-graph"), {
  ssr: false,
});

export default function Hero() {
  return (
    <section className="mb-16">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
        Matthew Dumas
      </h1>
      <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-lg mb-5">
        Writing about philosophy, politics, and the ideas that shape how we live.
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm mb-8">
        <a
          href="mailto:mattdumas3@gmail.com"
          className="text-[var(--color-accent)] hover:underline underline-offset-4"
        >
          Email
        </a>
        <a
          href="https://github.com/matthewdumas"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:underline underline-offset-4"
        >
          GitHub
        </a>
        <a
          href="https://x.com/matthewdumas"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:underline underline-offset-4"
        >
          X
        </a>
        <a
          href="https://linkedin.com/in/matthewdumas"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:underline underline-offset-4"
        >
          LinkedIn
        </a>
      </div>

      {/* Knowledge Graph */}
      <HeroGraph />
    </section>
  );
}
