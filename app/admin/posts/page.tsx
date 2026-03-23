"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Nav from "@/components/nav";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function PostForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: {
    title: string;
    slug: string;
    description: string;
    content: string;
    tags: string[];
    published: boolean;
    gated?: boolean;
    publishedAt?: string;
  };
  onSubmit: (data: {
    title: string;
    slug: string;
    description: string;
    content: string;
    tags: string[];
    published: boolean;
    gated?: boolean;
    publishedAt?: string;
  }) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tagsStr, setTagsStr] = useState(initial?.tags.join(", ") ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [gated, setGated] = useState(initial?.gated ?? false);
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ?? "");
  const [autoSlug, setAutoSlug] = useState(!initial);

  return (
    <form
      className="space-y-3 border border-[var(--color-border)] rounded p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const tags = tagsStr
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        onSubmit({
          title,
          slug,
          description,
          content,
          tags,
          published,
          gated: gated || undefined,
          publishedAt: publishedAt || undefined,
        });
        if (!initial) {
          setTitle("");
          setSlug("");
          setDescription("");
          setContent("");
          setTagsStr("");
          setPublished(false);
          setGated(false);
          setPublishedAt("");
          setAutoSlug(true);
        }
      }}
    >
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (autoSlug) setSlug(slugify(e.target.value));
        }}
        required
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <input
        placeholder="Slug"
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          setAutoSlug(false);
        }}
        required
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <input
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <textarea
        placeholder="Content (Markdown)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        rows={10}
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] font-mono"
      />
      <input
        placeholder="Tags (comma-separated)"
        value={tagsStr}
        onChange={(e) => setTagsStr(e.target.value)}
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <input
        placeholder="Published date (YYYY-MM-DD)"
        type="date"
        value={publishedAt}
        onChange={(e) => setPublishedAt(e.target.value)}
        className="w-48 border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Published
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={gated}
            onChange={(e) => setGated(e.target.checked)}
          />
          Subscribers only
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-[var(--color-accent)] text-white rounded px-4 py-2 text-sm hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          {initial ? "Save" : "Add Post"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function ManagePosts() {
  const posts = useQuery(api.posts.listAll);
  const createPost = useMutation(api.posts.create);
  const updatePost = useMutation(api.posts.update);
  const removePost = useMutation(api.posts.remove);
  const [editingId, setEditingId] = useState<Id<"posts"> | null>(null);

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <h1 className="text-3xl font-semibold mb-8 mt-8">Manage Posts</h1>

      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">Add New Post</h2>
        <PostForm onSubmit={(data) => void createPost(data)} />
      </div>

      <h2 className="text-lg font-medium mb-3">All Posts</h2>
      {posts === undefined ? (
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No posts yet.</p>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post._id} className="border border-[var(--color-border)] rounded p-4">
              {editingId === post._id ? (
                <PostForm
                  initial={{
                    title: post.title,
                    slug: post.slug,
                    description: post.description,
                    content: post.content,
                    tags: post.tags,
                    published: post.published,
                    gated: post.gated,
                    publishedAt: post.publishedAt,
                  }}
                  onSubmit={(data) => {
                    void updatePost({ id: post._id, ...data });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {post.title}
                      {!post.published && (
                        <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                          (draft)
                        </span>
                      )}
                      {post.gated && (
                        <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                          (gated)
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      /{post.slug} &middot; {post.tags.join(", ")}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {post.publishedAt ?? "No date"}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => setEditingId(post._id)}
                      className="text-sm text-[var(--color-accent)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void removePost({ id: post._id })}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
