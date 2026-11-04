'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { organizationsApi } from '@/lib/api';
import { Icon } from '@/components/dashboard';

type Org = {
  id: string;
  name: string;
  slug: string;
  created_at?: string;
};

export default function OrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Org | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrganizations = async () => {
    try {
      const res = await organizationsApi.list();
      setOrganizations((res.data || []) as Org[]);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    } finally {
      setLoading(false);
    }
  };

  const suggestedSlug = (name: string) =>
    name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    if (!newOrgName.trim()) {
      setError('Give your team a name.');
      setCreating(false);
      return;
    }

    try {
      const res = await organizationsApi.create({
        name: newOrgName.trim(),
        slug: suggestedSlug(newOrgSlug || newOrgName),
      });
      setOrganizations((prev) => [...prev, res.data as Org]);
      setShowCreateModal(false);
      setNewOrgName('');
      setNewOrgSlug('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not create the team. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await organizationsApi.delete(confirmDelete.id);
      setOrganizations((prev) => prev.filter((o) => o.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not delete the team.');
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center py-24">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Manage / Team members</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Your teams</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Organizations group the people you meet with. You belong to {organizations.length}.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <Icon.Plus className="h-4 w-4" /> Create team
          </button>
        </div>

        {organizations.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
              <Icon.Users className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No teams yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Create a team to keep your shared meetings and notes organized.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Icon.Plus className="h-4 w-4" /> Create your first team
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-500/40"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                    {(org.name || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    /{org.slug}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{org.name}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {org.created_at ? `Created ${new Date(org.created_at).toLocaleDateString()}` : 'Team'}
                </p>
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    onClick={() => setConfirmDelete(org)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-slate-400">
          Member invitations and shared folders are on our roadmap and aren’t available yet, so we don’t show
          counts we can’t back with real data.
        </p>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create a team</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label htmlFor="orgName" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Team name
                </label>
                <input
                  id="orgName"
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="e.g. Design team"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="orgSlug" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Short name <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  id="orgSlug"
                  type="text"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder={newOrgName ? suggestedSlug(newOrgName) : 'design-team'}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {creating ? 'Creating…' : 'Create team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Delete “{confirmDelete.name}”?</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This removes the team. Meetings you recorded stay in your library. This can’t be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
