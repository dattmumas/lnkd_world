"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Section from "@/components/section";
import Link from "next/link";

export default function WritingSection() {
  const posts = useQuery(api.posts.list);

  if (posts === undefined) {
    return (
      <Section title="Writing" viewAllHref="/writing">
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

  if (posts.length === 0) return null;

  const latest = posts.slice(0, 3);

  return (
    <Section title="Writing" viewAllHref="/writing">
      <ul className="space-y-5">
        {latest.map((post) => (
          <li key={post._id}>
            <Link href={`/writing/${post.slug}`} className="group block">
              <span className="text-[var(--color-accent)] group-hover:underline underline-offset-4 decoration-1 font-medium">
                {post.title}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)] ml-2">
                &mdash; {post.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
