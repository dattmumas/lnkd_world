"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
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
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block bg-[var(--color-border)]/50 rounded p-4 text-sm overflow-x-auto mb-4 font-mono">
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
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
