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
    <section className="mb-16">
      <div className="flex justify-between items-baseline mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {title}
        </h2>
        {viewAllHref && (
          <a
            href={viewAllHref}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
          >
            View all
          </a>
        )}
      </div>
      {children}
    </section>
  );
}
