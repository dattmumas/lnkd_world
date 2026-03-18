import Section from "@/components/section";

const posts = [
  {
    title: "Welcome to LNKD",
    description: "What this site is about and what's coming next.",
    href: "https://blog.lnkd.world",
  },
];

export default function WritingSection() {
  if (posts.length === 0) return null;

  return (
    <Section title="Writing" viewAllHref="https://blog.lnkd.world">
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.href}>
            <a
              href={post.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <span className="font-medium group-hover:text-[var(--color-accent)]">
                {post.title}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)] ml-2">
                &mdash; {post.description}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
