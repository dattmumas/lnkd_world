"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Nav from "@/components/nav";

function LinkForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: { title: string; description: string; href: string; order: number };
  onSubmit: (data: { title: string; description: string; href: string; order: number }) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [href, setHref] = useState(initial?.href ?? "");
  const [order, setOrder] = useState(initial?.order ?? 0);

  return (
    <form
      className="space-y-3 border border-[var(--color-border)] rounded p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, description, href, order });
        if (!initial) {
          setTitle("");
          setDescription("");
          setHref("");
          setOrder(0);
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
      <input
        placeholder="URL"
        type="url"
        value={href}
        onChange={(e) => setHref(e.target.value)}
        required
        className="w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <input
        placeholder="Order"
        type="number"
        value={order}
        onChange={(e) => setOrder(Number(e.target.value))}
        className="w-24 border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-[var(--color-accent)] text-white rounded px-4 py-2 text-sm hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          {initial ? "Save" : "Add Link"}
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

export default function ManageLinks() {
  const links = useQuery(api.links.list);
  const createLink = useMutation(api.links.create);
  const updateLink = useMutation(api.links.update);
  const removeLink = useMutation(api.links.remove);
  const [editingId, setEditingId] = useState<Id<"links"> | null>(null);

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <h1 className="text-3xl font-semibold mb-8 mt-8">Manage Links</h1>

      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">Add New Link</h2>
        <LinkForm
          onSubmit={(data) => {
            void createLink(data);
          }}
        />
      </div>

      <h2 className="text-lg font-medium mb-3">Current Links</h2>
      {links === undefined ? (
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      ) : links.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No links yet. Add one above.</p>
      ) : (
        <ul className="space-y-4">
          {links.map((link) => (
            <li key={link._id} className="border border-[var(--color-border)] rounded p-4">
              {editingId === link._id ? (
                <LinkForm
                  initial={{
                    title: link.title,
                    description: link.description,
                    href: link.href,
                    order: link.order,
                  }}
                  onSubmit={(data) => {
                    void updateLink({ id: link._id, ...data });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{link.title}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {link.description}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {link.href} &middot; order: {link.order}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => setEditingId(link._id)}
                      className="text-sm text-[var(--color-accent)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void removeLink({ id: link._id })}
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
