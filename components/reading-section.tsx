"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Section from "@/components/section";
import Link from "next/link";

export default function ReadingSection() {
  const readings = useQuery(api.readings.list);

  if (readings === undefined) {
    return (
      <Section title="Reading" viewAllHref="/reading">
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-[var(--color-border)] rounded w-48" />
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (readings.length === 0) return null;

  const latest = readings.slice(0, 3);

  return (
    <Section title="Reading" viewAllHref="/reading">
      <ul className="space-y-3">
        {latest.map((reading) => (
          <li key={reading._id}>
            <Link href="/reading" className="group block py-1">
              <span className="text-[var(--color-accent)] group-hover:underline underline-offset-4 decoration-1 font-medium">
                {reading.title}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)] ml-2">
                &mdash; {reading.author}
              </span>
              {reading.rating && (
                <span className="text-sm text-[var(--color-text-secondary)] ml-1">
                  {"★".repeat(reading.rating)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
