import Section from "@/components/section";

export default function WritingSection() {
  return (
    <Section title="Writing">
      <a
        href="https://blog.lnkd.world"
        target="_blank"
        rel="noopener noreferrer"
        className="group block py-1"
      >
        <span className="text-[var(--color-accent)] group-hover:underline underline-offset-4 decoration-1 font-medium">
          Blog
        </span>
        <span className="text-sm text-[var(--color-text-secondary)] ml-2">
          &mdash; Writing on philosophy, politics, and ideas
        </span>
      </a>
    </Section>
  );
}
