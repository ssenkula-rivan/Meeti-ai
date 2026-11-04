'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tagsApi, type TagItem } from '@/lib/api';
import { Icon } from '@/components/dashboard';

/* Tags — rendered inside the shared dashboard shell. Wired to the live /tags
   API for exactly what the backend supports: list (with real per-tag meeting
   counts), create, and delete. The server exposes no tag rename and no way to
   list the meetings carrying a given tag, so we show the honest count and manage
   the catalog only — tag ↔ meeting assignment happens on a meeting itself. We do
   not fake a tag detail panel or an edit control that would do nothing. */

const COLORS = ['#7c3aed', '#2563eb', '#0d9488', '#db2777', '#d97706', '#64748b'];

function colorOf(c?: string) {
  return c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : '#7c3aed';
}

export default function TagsPage() {
  const router = useRouter();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      router.push('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await tagsApi.list();
      setTags(res.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load your tags.');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setName('');
    setColor(COLORS[0]);
    setError('');
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the tag a name.');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const res = await tagsApi.create(name.trim(), color);
      // The server upserts on (user, name), so replace an existing match or append.
      setTags((prev) => {
        const idx = prev.findIndex((t) => t.id === res.data.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = res.data;
          return copy;
        }
        return [...prev, res.data];
      });
      setShowCreate(false);
      setName('');
      setColor(COLORS[0]);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create the tag.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (t: TagItem) => {
    if (!confirm(`Delete “${t.name}”? Meetings using this tag will lose it.`)) return;
    try {
      await tagsApi.delete(t.id);
      setTags((prev) => prev.filter((x) => x.id !== t.id));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not delete the tag.');
    }
  };

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center py-24">
        <div className="text-sm font-medium text-slate-400">Loading tags…</div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
            Organization
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Tags</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cross-cutting labels you can attach to any meeting.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
        >
          <Icon.Tag className="h-4 w-4" /> Create tag
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs font-medium opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {tags.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-white/10 dark:bg-slate-900">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
            <Icon.Tag className="h-6 w-6" />
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No tags yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Tags label meetings across folders — think “client”, “decision”, or “follow-up”. Create one,
            then attach it to a meeting.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            <Icon.Plus className="h-4 w-4" /> Create your first tag
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((t) => {
            const count = t.meeting_count ?? 0;
            return (
              <div
                key={t.id}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-200 dark:border-white/10 dark:bg-slate-900 dark:hover:border-violet-500/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${colorOf(t.color)}1a`, color: colorOf(t.color) }}
                  >
                    <Icon.Tag className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">{t.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {count} meeting{count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(t)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-white/10"
                  aria-label={`Delete ${t.name}`}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 max-w-2xl text-xs text-slate-400 dark:text-slate-500">
        Tag counts reflect meetings you’ve tagged. To add or remove a tag on a specific meeting, open that
        meeting.
      </p>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create tag</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              A short label you can reuse across meetings.
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. follow-up"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Color</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition ${
                        color === c ? 'ring-slate-400 dark:ring-offset-slate-900' : 'ring-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
