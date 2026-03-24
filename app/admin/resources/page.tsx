"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Nav from "@/components/nav";

function ResourceForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: { title: string; description: string; content: string; published: boolean };
  onSubmit: (data: { title: string; description: string; content: string; published: boolean }) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);

  return (
    <form
      className="space-y-3 border border-[var(--color-border)] rounded p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, description, content, published });
        if (!initial) {
          setTitle("");
          setDescription("");
          setContent("");
          setPublished(false);
        }
      }}
    >
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
        placeholder="Content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        rows={6}
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-y"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="rounded"
        />
        Published
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-[var(--color-accent)] text-white rounded px-4 py-2 text-sm hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          {initial ? "Save" : "Add Resource"}
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

export default function ManageResources() {
  const resources = useQuery(api.resources.listAll);
  const createResource = useMutation(api.resources.create);
  const updateResource = useMutation(api.resources.update);
  const removeResource = useMutation(api.resources.remove);
  const [editingId, setEditingId] = useState<Id<"resources"> | null>(null);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <h1 className="text-3xl font-semibold mb-8 mt-8">Manage Resources</h1>

      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">Add New Resource</h2>
        <ResourceForm
          onSubmit={(data) => {
            void createResource(data);
          }}
        />
      </div>

      <h2 className="text-lg font-medium mb-3">Current Resources</h2>
      {resources === undefined ? (
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      ) : resources.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No resources yet. Add one above.</p>
      ) : (
        <ul className="space-y-4">
          {resources.map((resource) => (
            <li key={resource._id} className="border border-[var(--color-border)] rounded p-4">
              {editingId === resource._id ? (
                <ResourceForm
                  initial={{
                    title: resource.title,
                    description: resource.description,
                    content: resource.content,
                    published: resource.published,
                  }}
                  onSubmit={(data) => {
                    void updateResource({ id: resource._id, ...data });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {resource.title}
                      {!resource.published && (
                        <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                          (draft)
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {resource.description}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => setEditingId(resource._id)}
                      className="text-sm text-[var(--color-accent)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void removeResource({ id: resource._id })}
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
