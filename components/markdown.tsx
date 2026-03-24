"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";

/**
 * Preprocess Obsidian-specific syntax into standard markdown/HTML
 * before passing to react-markdown.
 */
function preprocessObsidian(md: string): string {
  let result = md;

  // ==highlights== → <mark>highlights</mark>
  result = result.replace(/==(.*?)==/g, "<mark>$1</mark>");

  // [[wikilinks]] → **wikilinks** (no routing target, just bold)
  // [[wikilinks|display text]] → **display text**
  result = result.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
    (_, target, display) => `**${display ?? target}**`
  );

  // Obsidian callouts: > [!type] Title → styled blockquote
  // Converts to HTML so rehype-raw can render it
  result = result.replace(
    /^(>)\s*\[!(\w+)\]\s*(.*?)$\n?((?:^>.*$\n?)*)/gm,
    (_, _gt, type, title, body) => {
      const cleanBody = body
        .replace(/^>\s?/gm, "")
        .trim();
      const icon = calloutIcon(type.toLowerCase());
      return `<div class="callout callout-${type.toLowerCase()}">\n<p class="callout-title">${icon} ${title || type}</p>\n\n${cleanBody}\n</div>\n`;
    }
  );

  return result;
}

function calloutIcon(type: string): string {
  const icons: Record<string, string> = {
    note: "📝",
    tip: "💡",
    important: "❗",
    warning: "⚠️",
    caution: "🔥",
    info: "ℹ️",
    example: "📋",
    quote: "💬",
    question: "❓",
    success: "✅",
    failure: "❌",
    bug: "🐛",
    abstract: "📄",
  };
  return icons[type] ?? "📌";
}

export default function Markdown({ content }: { content: string }) {
  const processed = preprocessObsidian(content);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-8 mb-3">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight mt-6 mb-2">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold mt-5 mb-2">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="leading-relaxed mb-4">{children}</p>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-[var(--color-accent)] hover:underline underline-offset-4"
            target={href?.startsWith("http") ? "_blank" : undefined}
            rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[var(--color-accent)] pl-4 my-4 italic text-[var(--color-text-secondary)]">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-") || className?.includes("hljs");
          if (isBlock) {
            return (
              <code className={`block bg-[var(--color-border)]/50 rounded p-4 text-sm overflow-x-auto mb-4 font-mono ${className ?? ""}`}>
                {children}
              </code>
            );
          }
          return (
            <code className="bg-[var(--color-border)]/50 rounded px-1.5 py-0.5 text-sm font-mono">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-4">{children}</pre>,
        hr: () => <hr className="border-[var(--color-border)] my-8" />,
        mark: ({ children }) => (
          <mark className="bg-yellow-200/60 px-0.5 rounded">{children}</mark>
        ),
        sup: ({ children }) => (
          <sup className="text-xs">{children}</sup>
        ),
        section: ({ children, className }) => {
          // Footnotes section from remark-gfm
          if (className === "footnotes") {
            return (
              <section className="mt-8 pt-4 border-t border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                {children}
              </section>
            );
          }
          return <section>{children}</section>;
        },
        table: ({ children }) => (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-[var(--color-border)] px-3 py-2 text-left font-semibold bg-[var(--color-border)]/30">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-[var(--color-border)] px-3 py-2">
            {children}
          </td>
        ),
        img: ({ src, alt }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? ""} className="rounded max-w-full my-4" />
        ),
        details: ({ children }) => (
          <details className="mb-4 border border-[var(--color-border)] rounded p-3">
            {children}
          </details>
        ),
        summary: ({ children }) => (
          <summary className="cursor-pointer font-semibold">{children}</summary>
        ),
        kbd: ({ children }) => (
          <kbd className="bg-[var(--color-border)]/50 border border-[var(--color-border)] rounded px-1.5 py-0.5 text-xs font-mono">
            {children}
          </kbd>
        ),
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}
