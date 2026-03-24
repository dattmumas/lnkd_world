"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Nav from "@/components/nav";

function ProjectForm({
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
          {initial ? "Save" : "Add Project"}
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

export default function ManageProjects() {
  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);
  const [editingId, setEditingId] = useState<Id<"projects"> | null>(null);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <h1 className="text-3xl font-semibold mb-8 mt-8">Manage Projects</h1>

      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">Add New Project</h2>
        <ProjectForm
          onSubmit={(data) => {
            void createProject(data);
          }}
        />
      </div>

      <h2 className="text-lg font-medium mb-3">Current Projects</h2>
      {projects === undefined ? (
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      ) : projects.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No projects yet. Add one above.</p>
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => (
            <li key={project._id} className="border border-[var(--color-border)] rounded p-4">
              {editingId === project._id ? (
                <ProjectForm
                  initial={{
                    title: project.title,
                    description: project.description,
                    href: project.href,
                    order: project.order,
                  }}
                  onSubmit={(data) => {
                    void updateProject({ id: project._id, ...data });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{project.title}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {project.description}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {project.href} &middot; order: {project.order}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => setEditingId(project._id)}
                      className="text-sm text-[var(--color-accent)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void removeProject({ id: project._id })}
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
