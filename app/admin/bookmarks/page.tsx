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

function BookmarkForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: {
    title: string;
    slug: string;
    url: string;
    description: string;
    tags: string[];
    published: boolean;
    gated?: boolean;
    publishedAt?: string;
  };
  onSubmit: (data: {
    title: string;
    slug: string;
    url: string;
    description: string;
    tags: string[];
    published: boolean;
    gated?: boolean;
    publishedAt?: string;
  }) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
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
          url,
          description,
          tags,
          published,
          gated: gated || undefined,
          publishedAt: publishedAt || undefined,
        });
        if (!initial) {
          setTitle("");
          setSlug("");
          setUrl("");
          setDescription("");
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
        placeholder="URL"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        rows={3}
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <input
        placeholder="Tags (comma-separated)"
        value={tagsStr}
        onChange={(e) => setTagsStr(e.target.value)}
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <input
        type="date"
        value={publishedAt}
        onChange={(e) => setPublishedAt(e.target.value)}
        className="w-48 border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={gated} onChange={(e) => setGated(e.target.checked)} />
          Subscribers only
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-[var(--color-accent)] text-white rounded px-4 py-2 text-sm hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          {initial ? "Save" : "Add Bookmark"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function ManageBookmarks() {
  const bookmarks = useQuery(api.bookmarks.listAll);
  const createBookmark = useMutation(api.bookmarks.create);
  const updateBookmark = useMutation(api.bookmarks.update);
  const removeBookmark = useMutation(api.bookmarks.remove);
  const [editingId, setEditingId] = useState<Id<"bookmarks"> | null>(null);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <h1 className="text-3xl font-semibold mb-8 mt-8">Manage Bookmarks</h1>

      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">Add New Bookmark</h2>
        <BookmarkForm onSubmit={(data) => void createBookmark(data)} />
      </div>

      <h2 className="text-lg font-medium mb-3">All Bookmarks</h2>
      {bookmarks === undefined ? (
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      ) : bookmarks.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No bookmarks yet.</p>
      ) : (
        <ul className="space-y-4">
          {bookmarks.map((bookmark) => (
            <li key={bookmark._id} className="border border-[var(--color-border)] rounded p-4">
              {editingId === bookmark._id ? (
                <BookmarkForm
                  initial={{
                    title: bookmark.title,
                    slug: bookmark.slug,
                    url: bookmark.url,
                    description: bookmark.description,
                    tags: bookmark.tags,
                    published: bookmark.published,
                    gated: bookmark.gated,
                    publishedAt: bookmark.publishedAt,
                  }}
                  onSubmit={(data) => {
                    void updateBookmark({ id: bookmark._id, ...data });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {bookmark.title}
                      {!bookmark.published && <span className="text-xs text-[var(--color-text-secondary)] ml-2">(draft)</span>}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {bookmark.url}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {bookmark.tags.join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button onClick={() => setEditingId(bookmark._id)} className="text-sm text-[var(--color-accent)] hover:underline">
                      Edit
                    </button>
                    <button onClick={() => void removeBookmark({ id: bookmark._id })} className="text-sm text-red-600 hover:underline">
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
