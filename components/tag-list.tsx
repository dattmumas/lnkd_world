"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function TagList({
  tags,
  basePath,
}: {
  tags: string[];
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");

  return (
    <div className="flex flex-wrap gap-2">
      {activeTag && (
        <button
          onClick={() => router.push(basePath)}
          className="text-xs px-2.5 py-1 rounded-full border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
        >
          Clear filter
        </button>
      )}
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => router.push(`${basePath}?tag=${encodeURIComponent(tag)}`)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            activeTag === tag
              ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
              : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

export function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="text-xs px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
