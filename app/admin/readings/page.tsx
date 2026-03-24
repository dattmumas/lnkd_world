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

function ReadingForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: {
    title: string;
    slug: string;
    author: string;
    type: string;
    rating?: number;
    content: string;
    tags: string[];
    published: boolean;
    gated?: boolean;
    publishedAt?: string;
    url?: string;
  };
  onSubmit: (data: {
    title: string;
    slug: string;
    author: string;
    type: string;
    rating?: number;
    content: string;
    tags: string[];
    published: boolean;
    gated?: boolean;
    publishedAt?: string;
    url?: string;
  }) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [type, setType] = useState(initial?.type ?? "book");
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [content, setContent] = useState(initial?.content ?? "");
  const [tagsStr, setTagsStr] = useState(initial?.tags.join(", ") ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [gated, setGated] = useState(initial?.gated ?? false);
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
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
          author,
          type,
          rating: rating || undefined,
          content,
          tags,
          published,
          gated: gated || undefined,
          publishedAt: publishedAt || undefined,
          url: url || undefined,
        });
        if (!initial) {
          setTitle("");
          setSlug("");
          setAuthor("");
          setType("book");
          setRating(0);
          setContent("");
          setTagsStr("");
          setPublished(false);
          setGated(false);
          setPublishedAt("");
          setUrl("");
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
        placeholder="Author"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        required
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <div className="flex gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        >
          <option value="book">Book</option>
          <option value="article">Article</option>
          <option value="paper">Paper</option>
        </select>
        <input
          placeholder="Rating (1-5)"
          type="number"
          min={0}
          max={5}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="w-28 border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
      </div>
      <input
        placeholder="Source URL (optional)"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <textarea
        placeholder="Notes (Markdown)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] font-mono"
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
          {initial ? "Save" : "Add Reading"}
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

export default function ManageReadings() {
  const readings = useQuery(api.readings.listAll);
  const createReading = useMutation(api.readings.create);
  const updateReading = useMutation(api.readings.update);
  const removeReading = useMutation(api.readings.remove);
  const [editingId, setEditingId] = useState<Id<"readings"> | null>(null);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <h1 className="text-3xl font-semibold mb-8 mt-8">Manage Readings</h1>

      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">Add New Reading</h2>
        <ReadingForm onSubmit={(data) => void createReading(data)} />
      </div>

      <h2 className="text-lg font-medium mb-3">All Readings</h2>
      {readings === undefined ? (
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      ) : readings.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No readings yet.</p>
      ) : (
        <ul className="space-y-4">
          {readings.map((reading) => (
            <li key={reading._id} className="border border-[var(--color-border)] rounded p-4">
              {editingId === reading._id ? (
                <ReadingForm
                  initial={{
                    title: reading.title,
                    slug: reading.slug,
                    author: reading.author,
                    type: reading.type,
                    rating: reading.rating,
                    content: reading.content,
                    tags: reading.tags,
                    published: reading.published,
                    gated: reading.gated,
                    publishedAt: reading.publishedAt,
                    url: reading.url,
                  }}
                  onSubmit={(data) => {
                    void updateReading({ id: reading._id, ...data });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {reading.title}
                      {!reading.published && <span className="text-xs text-[var(--color-text-secondary)] ml-2">(draft)</span>}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {reading.author} &middot; {reading.type}
                      {reading.rating ? ` &middot; ${"★".repeat(reading.rating)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button onClick={() => setEditingId(reading._id)} className="text-sm text-[var(--color-accent)] hover:underline">
                      Edit
                    </button>
                    <button onClick={() => void removeReading({ id: reading._id })} className="text-sm text-red-600 hover:underline">
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
