"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import Markdown from "@/components/markdown";
import { Tags } from "@/components/tag-list";
import Link from "next/link";

export default function PostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const post = useQuery(api.posts.getBySlug, { slug });

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-12 md:py-16">
        {post === undefined ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[var(--color-border)] rounded w-64" />
            <div className="h-4 bg-[var(--color-border)] rounded w-32" />
            <div className="h-4 bg-[var(--color-border)] rounded w-full" />
            <div className="h-4 bg-[var(--color-border)] rounded w-full" />
          </div>
        ) : post === null ? (
          <div>
            <h1 className="text-2xl font-semibold mb-4">Post not found</h1>
            <Link
              href="/writing"
              className="text-[var(--color-accent)] hover:underline underline-offset-4"
            >
              Back to writing
            </Link>
          </div>
        ) : (
          <article>
            <Link
              href="/writing"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] mb-6 inline-block"
            >
              &larr; Back to writing
            </Link>

            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
              {post.title}
            </h1>

            <div className="flex items-center gap-4 mb-2">
              {post.publishedAt && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
              {post.gated && (
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Subscribers only
                </span>
              )}
            </div>

            {post.tags.length > 0 && (
              <div className="mb-8">
                <Tags tags={post.tags} />
              </div>
            )}

            {post.gated && !post.content ? (
              <Unauthenticated>
                <div className="border border-[var(--color-border)] rounded p-6 text-center">
                  <p className="text-[var(--color-text-secondary)] mb-3">
                    This post is for subscribers only.
                  </p>
                  <Link
                    href="/subscribe"
                    className="text-[var(--color-accent)] hover:underline underline-offset-4 font-medium"
                  >
                    Subscribe to read
                  </Link>
                </div>
              </Unauthenticated>
            ) : (
              <div className="border-t border-[var(--color-border)] pt-8">
                <Markdown content={post.content} />
              </div>
            )}
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}
