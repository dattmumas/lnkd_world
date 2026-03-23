"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Section from "@/components/section";

export default function ProjectList() {
  const projects = useQuery(api.projects.list);

  if (projects === undefined) {
    return (
      <Section title="Projects">
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

  if (projects.length === 0) return null;

  return (
    <Section title="Projects">
      <ul className="space-y-3">
        {projects.map((project) => (
          <li key={project._id}>
            <a
              href={project.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block py-1"
            >
              <span className="text-[var(--color-accent)] group-hover:underline underline-offset-4 decoration-1 font-medium">
                {project.title}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)] ml-2">
                &mdash; {project.description}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
