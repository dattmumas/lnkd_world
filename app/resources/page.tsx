"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import AuthGuard from "@/components/auth-guard";

function ResourcesList() {
  const resources = useQuery(api.resources.list);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: Id<"resources">) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (resources === undefined) {
    return <p className="text-[var(--color-text-secondary)]">Loading...</p>;
  }

  if (resources.length === 0) {
    return (
      <p className="text-[var(--color-text-secondary)]">
        No resources available yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {resources.map((resource) => (
        <li key={resource._id} className="py-6 first:pt-0 last:pb-0">
          <button
            onClick={() => toggle(resource._id)}
            className="w-full text-left group"
          >
            <h2 className="text-xl font-semibold group-hover:text-[var(--color-accent)]">
              {resource.title}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {resource.description}
            </p>
          </button>
          {expanded.has(resource._id) && (
            <div className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">
              {resource.content}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Resources() {
  return (
    <AuthGuard role="subscriber">
      <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-6">
        <Nav />
        <main className="flex-1 py-16 md:py-24">
          <h1 className="text-3xl font-semibold mb-8">Resources</h1>
          <ResourcesList />
        </main>
        <Footer />
      </div>
    </AuthGuard>
  );
}
