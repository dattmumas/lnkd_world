"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Section from "@/components/section";

export default function LinkList() {
  const links = useQuery(api.links.list);

  if (links === undefined) {
    return (
      <Section title="Links">
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

  if (links.length === 0) return null;

  return (
    <Section title="Links">
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link._id}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block py-1"
            >
              <span className="text-[var(--color-accent)] group-hover:underline underline-offset-4 decoration-1 font-medium">
                {link.title}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)] ml-2">
                &mdash; {link.description}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
