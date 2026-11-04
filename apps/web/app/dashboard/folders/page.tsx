'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  foldersApi,
  meetingsApi,
  type FolderItem,
  type FolderMeeting,
  type Meeting,
} from '@/lib/api';
import { Icon } from '@/components/dashboard';

/* Folders — rendered inside the shared dashboard shell (the layout already
   provides the sidebar and top bar). Every control here is wired to the live
   /folders API: list (with real meeting counts), create — including sub-folders
   through parentId —, rename, delete, and add/remove meetings inside a folder.
   We deliberately leave out anything the backend can't back (folder sharing,
   per-folder permissions, participant lists, drag-to-move between folders)
   rather than show controls that would silently do nothing. */

const COLORS = ['#7c3aed', '#2563eb', '#0d9488', '#db2777', '#d97706', '#64748b'];

function colorOf(c?: string) {
  return c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : '#7c3aed';
}

function formatDuration(seconds?: number) {
  if (!seconds) return '—';
  return `${Math.round(seconds / 60)} min`;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusPill(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'processing':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    case 'failed':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';
  }
}

export default function FoldersPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [folderMeetings, setFolderMeetings] = useState<FolderMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createColor, setCreateColor] = useState(COLORS[0]);
  const [createParent, setCreateParent] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [pickMeeting, setPickMeeting] = useState('');

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
      const [fRes, mRes] = await Promise.all([
        foldersApi.list(),
        meetingsApi.list().catch(() => ({ data: [] as Meeting[] })),
      ]);
      const fs = fRes.data || [];
      setFolders(fs);
      setAllMeetings(mRes.data || []);
      setSelectedId((prev) => prev ?? fs[0]?.id ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load your folders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedId) {
      setFolderMeetings([]);
      return;
    }
    let active = true;
    setLoadingMeetings(true);
    foldersApi
      .listMeetings(selectedId)
      .then((res) => active && setFolderMeetings(res.data || []))
      .catch(() => active && setFolderMeetings([]))
      .finally(() => active && setLoadingMeetings(false));
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = folders.find((f) => f.id === selectedId) || null;
  const childrenOf = (id: string | null) => folders.filter((f) => (f.parent_id ?? null) === id);

  const availableMeetings = useMemo(() => {
    const inFolder = new Set(folderMeetings.map((m) => m.id));
    return allMeetings.filter((m) => !inFolder.has(m.id));
  }, [allMeetings, folderMeetings]);

  const openCreate = (parentId: string | null) => {
    setCreateParent(parentId);
    setCreateName('');
    setCreateColor(COLORS[0]);
    setError('');
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      setError('Give the folder a name.');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const res = await foldersApi.create(createName.trim(), createColor, createParent);
      setFolders((prev) => [...prev, res.data]);
      setSelectedId(res.data.id);
      setShowCreate(false);
      setCreateName('');
      setCreateParent(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create the folder.');
    } finally {
      setCreating(false);
    }
  };

  const startRename = (f: FolderItem) => {
    setRenameValue(f.name);
    setRenaming(true);
  };

  const commitRename = async () => {
    if (!selected) return;
    const name = renameValue.trim();
    setRenaming(false);
    if (!name || name === selected.name) return;
    try {
      const res = await foldersApi.update(selected.id, { name });
      setFolders((prev) => prev.map((f) => (f.id === selected.id ? { ...f, ...res.data } : f)));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not rename the folder.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this folder and any sub-folders? The meetings inside are not deleted — only the grouping.')) return;
    try {
      await foldersApi.delete(id);
      // The database cascades to sub-folders and their meeting links, so resync
      // the whole list instead of dropping only the clicked row.
      const res = await foldersApi.list();
      setFolders(res.data || []);
      if (selectedId === id) setSelectedId(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not delete the folder.');
    }
  };

  const refreshCounts = async () => {
    try {
      const res = await foldersApi.list();
      setFolders(res.data || []);
    } catch {
      /* counts are non-critical; leave optimistic state */
    }
  };

  const handleAddMeeting = async () => {
    if (!selectedId || !pickMeeting) return;
    try {
      await foldersApi.addMeeting(selectedId, pickMeeting);
      setShowAdd(false);
      setPickMeeting('');
      const res = await foldersApi.listMeetings(selectedId);
      setFolderMeetings(res.data || []);
      await refreshCounts();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not add the meeting.');
    }
  };

  const handleRemoveMeeting = async (meetingId: string) => {
    if (!selectedId) return;
    try {
      await foldersApi.removeMeeting(selectedId, meetingId);
      setFolderMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      await refreshCounts();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not remove the meeting.');
    }
  };

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center py-24">
        <div className="text-sm font-medium text-slate-400">Loading folders…</div>
      </main>
    );
  }

  // Render the folder tree to any depth: childrenOf() reads parent_id, so
  // nested folders appear indented under their parent, and so on.
  const renderTree = (parentId: string | null, depth: number) =>
    childrenOf(parentId).map((f) => {
      const active = selectedId === f.id;
      return (
        <div key={f.id}>
          <button
            onClick={() => setSelectedId(f.id)}
            className={`flex w-full items-center gap-2 rounded-xl py-2 pr-3 text-sm transition ${
              active
                ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
            }`}
            style={{ paddingLeft: 12 + depth * 16 }}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorOf(f.color) }}
            />
            <span className="min-w-0 flex-1 truncate text-left font-medium">{f.name}</span>
            {typeof f.meeting_count === 'number' && (
              <span className="shrink-0 text-xs tabular-nums text-slate-400">{f.meeting_count}</span>
            )}
          </button>
          {renderTree(f.id, depth + 1)}
        </div>
      );
    });

  const count = selected?.meeting_count ?? folderMeetings.length;

  return (
    <main className="flex-1 px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
            Organization
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Folders</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            A little structure for every conversation.
          </p>
        </div>
        <button
          onClick={() => openCreate(null)}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
        >
          <Icon.Folder className="h-4 w-4" /> Create folder
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

      {folders.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-white/10 dark:bg-slate-900">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
            <Icon.Folder className="h-6 w-6" />
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No folders yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Folders group your meetings so related conversations sit together. Creating a folder doesn’t
            change who can see a meeting.
          </p>
          <button
            onClick={() => openCreate(null)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            <Icon.Plus className="h-4 w-4" /> Create your first folder
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Folder tree */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <p className="px-2 py-2 text-sm font-bold text-slate-900 dark:text-white">All folders</p>
              <div>{renderTree(null, 0)}</div>
              <button
                onClick={() => openCreate(null)}
                className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:text-slate-300 dark:hover:text-violet-300"
              >
                <Icon.Plus className="h-4 w-4" /> New folder
              </button>
            </div>
          </div>

          {/* Selected folder detail */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
                Select a folder to see the meetings inside it.
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${colorOf(selected.color)}1a`, color: colorOf(selected.color) }}
                    >
                      <Icon.Folder className="h-5 w-5" />
                    </span>
                    {renaming ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setRenaming(false);
                          }}
                          className="rounded-lg border border-violet-300 bg-white px-2 py-1 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:bg-slate-800 dark:text-white"
                        />
                        <button
                          onClick={commitRename}
                          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setRenaming(false)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selected.name}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {count} meeting{count === 1 ? '' : 's'}
                        </p>
                      </div>
                    )}
                  </div>
                  {!renaming && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startRename(selected)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => openCreate(selected.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                      >
                        New subfolder
                      </button>
                      <button
                        onClick={() => handleDelete(selected.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between px-5 pt-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Meetings in this folder</h3>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                  >
                    <Icon.Plus className="h-4 w-4" /> Add meeting
                  </button>
                </div>

                <div className="p-5">
                  {loadingMeetings ? (
                    <div className="py-10 text-center text-sm text-slate-400">Loading meetings…</div>
                  ) : folderMeetings.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                      No meetings here yet. Use “Add meeting” to group an existing one.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-white/5">
                      {folderMeetings.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/meetings/${m.id}`}
                              className="block truncate font-medium text-slate-900 hover:text-violet-600 dark:text-white dark:hover:text-violet-300"
                            >
                              {m.title}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${statusPill(m.status)}`}>
                                {m.status}
                              </span>
                              <span>{formatDate(m.created_at)}</span>
                              <span>{formatDuration(m.duration_seconds)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveMeeting(m.id)}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/10"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {createParent ? 'New subfolder' : 'Create folder'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {createParent
                ? `Inside “${folders.find((f) => f.id === createParent)?.name}”.`
                : 'Folders organize your meetings. Nothing about a meeting’s access changes.'}
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Name</label>
                <input
                  autoFocus
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Client projects"
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
                      onClick={() => setCreateColor(c)}
                      className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition ${
                        createColor === c ? 'ring-slate-400 dark:ring-offset-slate-900' : 'ring-transparent'
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
                  {creating ? 'Creating…' : 'Create folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add meeting modal */}
      {showAdd && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add a meeting to “{selected.name}”</h2>
            {availableMeetings.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Every one of your meetings is already in this folder.
              </p>
            ) : (
              <div className="mt-4">
                <select
                  value={pickMeeting}
                  onChange={(e) => setPickMeeting(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <option value="">Choose a meeting…</option>
                  {availableMeetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMeeting}
                disabled={!pickMeeting}
                className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                Add meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
