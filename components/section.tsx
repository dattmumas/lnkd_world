import { ReactNode } from "react";

export default function Section({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex justify-between items-baseline mb-3 border-b border-[var(--color-border)] pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          {title}
        </h2>
        {viewAllHref && (
          <a
            href={viewAllHref}
            className="text-xs text-[var(--color-accent)] hover:underline underline-offset-4"
          >
            View all
          </a>
        )}
      </div>
      {children}
    </section>
  );
}
