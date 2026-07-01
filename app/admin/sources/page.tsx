"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Nav from "@/components/nav";

const field =
  "w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

function Row({
  title,
  subtitle,
  inactive,
  badge,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  inactive: boolean;
  badge?: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-between items-start">
      <div className="min-w-0">
        <p className="font-medium">
          {title}
          {inactive && (
            <span className="ml-2 text-xs text-[var(--color-text-secondary)]">(inactive)</span>
          )}
        </p>
        {subtitle && (
          <p className="text-sm text-[var(--color-text-secondary)] truncate">{subtitle}</p>
        )}
        {badge && <div className="mt-1">{badge}</div>}
      </div>
      <div className="flex gap-2 shrink-0 ml-4">
        <button onClick={onEdit} className="text-sm text-[var(--color-accent)] hover:underline">
          Edit
        </button>
        <button onClick={onDelete} className="text-sm text-red-600 hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}

interface Health {
  checkedAt: string;
  sources: Record<string, { name: string; ok: boolean; items: number; error?: string }>;
  accounts: Record<string, number>;
}

function SrcBadge({ st }: { st?: Health["sources"][string] }) {
  if (!st) return <span className="text-xs text-[var(--color-text-secondary)]">not checked yet</span>;
  if (!st.ok)
    return (
      <span className="text-xs text-red-600" title={st.error}>
        ✗ failed{st.error ? ` · ${st.error.slice(0, 44)}` : ""}
      </span>
    );
  if (st.items === 0)
    return <span className="text-xs text-amber-600">✓ fetched · no recent items</span>;
  return (
    <span className="text-xs text-green-600">
      ✓ {st.items} item{st.items === 1 ? "" : "s"}
    </span>
  );
}

function AccBadge({ n }: { n?: number }) {
  return (
    <span className={`text-xs ${n ? "text-green-600" : "text-[var(--color-text-secondary)]"}`}>
      {n ?? 0} recent post{n === 1 ? "" : "s"}
    </span>
  );
}

function SourceForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; url: string; active: boolean };
  onSubmit: (data: { name: string; url: string; active: boolean }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  return (
    <form
      className="space-y-3 border border-[var(--color-border)] rounded p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, url, active });
        if (!initial) {
          setName("");
          setUrl("");
          setActive(true);
        }
      }}
    >
      <input placeholder="Source name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
      <input placeholder="RSS feed URL" value={url} onChange={(e) => setUrl(e.target.value)} required className={field} />
      {initial && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" className="bg-[var(--color-accent)] text-white rounded px-4 py-2 text-sm hover:bg-[var(--color-accent-hover)]">
          {initial ? "Save" : "Add"}
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

function HandleForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: { handle: string; note: string; active: boolean };
  onSubmit: (data: { handle: string; note: string; active: boolean }) => void;
  onCancel?: () => void;
}) {
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  return (
    <form
      className="space-y-3 border border-[var(--color-border)] rounded p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ handle, note, active });
        if (!initial) {
          setHandle("");
          setNote("");
          setActive(true);
        }
      }}
    >
      <input placeholder="X handle (e.g. CNBC)" value={handle} onChange={(e) => setHandle(e.target.value)} required className={field} />
      <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className={field} />
      {initial && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" className="bg-[var(--color-accent)] text-white rounded px-4 py-2 text-sm hover:bg-[var(--color-accent-hover)]">
          {initial ? "Save" : "Add"}
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

export default function ManageSources() {
  // Science RSS sources
  const sci = useQuery(api.newsSources.listAll);
  const sciCreate = useMutation(api.newsSources.create);
  const sciUpdate = useMutation(api.newsSources.update);
  const sciRemove = useMutation(api.newsSources.remove);
  const sciSeed = useMutation(api.newsSources.seedDefaults);
  // Business RSS sources
  const biz = useQuery(api.bizSources.listAll);
  const bizCreate = useMutation(api.bizSources.create);
  const bizUpdate = useMutation(api.bizSources.update);
  const bizRemove = useMutation(api.bizSources.remove);
  const bizSeed = useMutation(api.bizSources.seedDefaults);
  // Business X accounts
  const acc = useQuery(api.bizAccounts.listAll);
  const accCreate = useMutation(api.bizAccounts.create);
  const accUpdate = useMutation(api.bizAccounts.update);
  const accRemove = useMutation(api.bizAccounts.remove);
  const accSeed = useMutation(api.bizAccounts.seedDefaults);

  const refresh = useAction(api.scienceFeed.refresh);
  const healthJson = useQuery(api.scienceFeed.getHealth);
  const health = useMemo<Health | null>(() => {
    try {
      return healthJson ? (JSON.parse(healthJson) as Health) : null;
    } catch {
      return null;
    }
  }, [healthJson]);
  const [editing, setEditing] = useState<string | null>(null);
  const [state, setState] = useState("");

  const onRefresh = async () => {
    setState("Refreshing…");
    try {
      const r = await refresh();
      setState(`Done — ${r.count} item${r.count === 1 ? "" : "s"}.`);
    } catch {
      setState("Refresh failed — check logs.");
    }
  };

  const seedRow = (onSeed: () => void, label: string) => (
    <button onClick={onSeed} className="text-sm text-[var(--color-accent)] hover:underline">
      {label}
    </button>
  );

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <div className="flex items-center justify-between mb-2 mt-8">
        <h1 className="text-3xl font-semibold">News Sources</h1>
        <div className="flex items-center gap-3">
          {state && <span className="text-sm text-[var(--color-text-secondary)]">{state}</span>}
          <button
            onClick={() => void onRefresh()}
            className="text-sm border border-[var(--color-border)] rounded px-3 py-1.5 hover:bg-[var(--color-border)]/30"
          >
            Refresh feed now
          </button>
        </div>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-2">
        Feeds the two columns of the{" "}
        <Link href="/feed/science" className="text-[var(--color-accent)] hover:underline">Science &amp; Business</Link>{" "}
        page. Opus picks what&apos;s worth sharing from each. Each source shows how it
        did on the last refresh — prune or swap the ones that fail.
      </p>
      <p className="text-xs text-[var(--color-text-secondary)] mb-10">
        {health
          ? `Sources last checked ${new Date(health.checkedAt).toLocaleString()}.`
          : "No refresh recorded yet — hit “Refresh feed now.”"}
      </p>

      {/* Science sources */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-1">Science sources</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">RSS feeds for the Science column.</p>
        <div className="mb-4">
          <SourceForm onSubmit={(d) => void sciCreate({ name: d.name, url: d.url })} />
        </div>
        {sci === undefined ? (
          <p className="text-[var(--color-text-secondary)]">Loading…</p>
        ) : sci.length === 0 ? (
          seedRow(() => void sciSeed(), "Load default science sources")
        ) : (
          <ul className="space-y-3">
            {sci.map((s) => (
              <li key={s._id} className="border border-[var(--color-border)] rounded p-4">
                {editing === s._id ? (
                  <SourceForm
                    initial={{ name: s.name, url: s.url, active: s.active !== false }}
                    onSubmit={(d) => {
                      void sciUpdate({ id: s._id, name: d.name, url: d.url, active: d.active });
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <Row title={s.name} subtitle={s.url} inactive={s.active === false} badge={<SrcBadge st={health?.sources?.[s.url]} />} onEdit={() => setEditing(s._id)} onDelete={() => void sciRemove({ id: s._id })} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Business sources */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-1">Business sources</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">RSS feeds for the Business column.</p>
        <div className="mb-4">
          <SourceForm onSubmit={(d) => void bizCreate({ name: d.name, url: d.url })} />
        </div>
        {biz === undefined ? (
          <p className="text-[var(--color-text-secondary)]">Loading…</p>
        ) : biz.length === 0 ? (
          seedRow(() => void bizSeed(), "Load default business sources (BBC, Fortune, WSJ, …)")
        ) : (
          <ul className="space-y-3">
            {biz.map((s) => (
              <li key={s._id} className="border border-[var(--color-border)] rounded p-4">
                {editing === s._id ? (
                  <SourceForm
                    initial={{ name: s.name, url: s.url, active: s.active !== false }}
                    onSubmit={(d) => {
                      void bizUpdate({ id: s._id, name: d.name, url: d.url, active: d.active });
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <Row title={s.name} subtitle={s.url} inactive={s.active === false} badge={<SrcBadge st={health?.sources?.[s.url]} />} onEdit={() => setEditing(s._id)} onDelete={() => void bizRemove({ id: s._id })} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Business X accounts */}
      <section>
        <h2 className="text-xl font-semibold mb-1">Business X accounts</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">Posts from these accounts also feed the Business column.</p>
        <div className="mb-4">
          <HandleForm onSubmit={(d) => void accCreate({ handle: d.handle, note: d.note || undefined })} />
        </div>
        {acc === undefined ? (
          <p className="text-[var(--color-text-secondary)]">Loading…</p>
        ) : acc.length === 0 ? (
          seedRow(() => void accSeed(), "Load default business accounts (Bloomberg, WSJ, CNBC, …)")
        ) : (
          <ul className="space-y-3">
            {acc.map((a) => (
              <li key={a._id} className="border border-[var(--color-border)] rounded p-4">
                {editing === a._id ? (
                  <HandleForm
                    initial={{ handle: a.handle, note: a.note ?? "", active: a.active !== false }}
                    onSubmit={(d) => {
                      void accUpdate({ id: a._id, handle: d.handle, note: d.note || undefined, active: d.active });
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <Row title={`@${a.handle}`} subtitle={a.note ?? ""} inactive={a.active === false} badge={<AccBadge n={health?.accounts?.[a.handle]} />} onEdit={() => setEditing(a._id)} onDelete={() => void accRemove({ id: a._id })} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
