'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { meetingsApi, type Meeting } from '@/lib/api';
import { Icon } from '@/components/dashboard';

/* My meetings — matches the Meeti design: a full-width, violet, table-style
   list wired to real data. The design mockup shows an "Up next" hero, a
   Participants column and time-based "Upcoming" tabs; those need scheduled
   meetings and participant data the API does not expose, so we render the
   real signal only (status, date, duration, AI summary) instead of faking it. */

type StatusTab = 'all' | 'completed' | 'processing' | 'draft';

function statusTone(status: Meeting['status']) {
  if (status === 'completed') return { label: 'Ready', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' };
  if (status === 'processing') return { label: 'Processing', cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' };
  if (status === 'recording') return { label: 'Recording', cls: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300' };
  if (status === 'failed') return { label: 'Failed', cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300' };
  if (status === 'archived') return { label: 'Archived', cls: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300' };
  return { label: 'Draft', cls: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300' };
}

function dayLabel(date: Date) {
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return null;
}

function formatDuration(seconds?: number) {
  if (!seconds) return '--';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const res = await meetingsApi.list();
      setMeetings(res.data || []);
    } catch (err: any) {
      console.error('Failed to load meetings:', err);
      if (err?.response?.status === 401) {
        localStorage.removeItem('auth_token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      const res = await meetingsApi.list();
      setMeetings(res.data || []);
      return;
    }
    try {
      setIsSearching(true);
      const res = await meetingsApi.search(searchQuery.trim());
      setMeetings(res.data || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = async () => {
    setSearchQuery('');
    const res = await meetingsApi.list();
    setMeetings(res.data || []);
  };

  const counts = useMemo(
    () => ({
      all: meetings.length,
      completed: meetings.filter((m) => m.status === 'completed').length,
      processing: meetings.filter((m) => m.status === 'processing').length,
      draft: meetings.filter((m) => m.status === 'draft').length,
    }),
    [meetings]
  );

  const visible = statusFilter === 'all' ? meetings : meetings.filter((m) => m.status === statusFilter);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="text-sm font-medium text-slate-400">Loading meetings...</div>
      </div>
    );
  }

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'completed', label: 'Completed' },
    { key: 'processing', label: 'Processing' },
    { key: 'draft', label: 'Draft' },
  ];

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">My meetings</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every conversation. Everything you need, in one place.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/meetings/new"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <Icon.Link className="h-4 w-4 text-slate-400" /> Join with link
            </Link>
            <Link
              href="/dashboard/meetings/new"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Icon.Plus className="h-4 w-4" /> New meeting
            </Link>
          </div>
        </div>

        {/* List card */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          {/* Segmented tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setStatusFilter(t.key)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                    statusFilter === t.key
                      ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 text-xs font-medium opacity-60">{counts[t.key]}</span>
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {visible.length} {visible.length === 1 ? 'meeting' : 'meetings'}
            </span>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon.Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search meetings by title, notes, transcript, or action items..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-16 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-white/10">
                  <th className="pb-3 font-medium">Meeting name</th>
                  <th className="pb-3 font-medium">Date &amp; time</th>
                  <th className="pb-3 font-medium">Duration</th>
                  <th className="pb-3 font-medium">AI summary</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {searchQuery
                          ? `No meetings found matching “${searchQuery}”.`
                          : statusFilter === 'all'
                          ? 'No meetings recorded yet.'
                          : `No ${statusFilter} meetings yet.`}
                      </p>
                      {searchQuery ? (
                        <button onClick={handleClearSearch} className="mt-3 text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300">
                          Reset search
                        </button>
                      ) : (
                        <Link
                          href="/dashboard/meetings/new"
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                        >
                          <Icon.Plus className="h-4 w-4" /> Start your first meeting
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  visible.map((m) => {
                    const tone = statusTone(m.status);
                    const date = new Date(m.started_at || m.created_at);
                    const dl = dayLabel(date);
                    return (
                      <tr key={m.id} className="group">
                        <td className="py-3">
                          <Link href={`/dashboard/meetings/${m.id}`} className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                              <Icon.Video className="h-5 w-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-slate-900 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-300">{m.title}</span>
                              <span className="block truncate text-xs text-slate-400">{m.meeting_type || 'General'}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="py-3 text-slate-500 dark:text-slate-400">
                          <span className="block">
                            {dl ? `${dl} · ` : ''}
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className="block text-xs text-slate-400">{date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        </td>
                        <td className="py-3 text-slate-500 dark:text-slate-400">{formatDuration(m.duration_seconds)}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone.cls}`}>{tone.label}</span>
                        </td>
                        <td className="py-3 text-right">
                          <Link href={`/dashboard/meetings/${m.id}`} className="inline-flex items-center text-slate-300 transition group-hover:text-violet-600 dark:group-hover:text-violet-300">
                            <Icon.Arrow className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {visible.length > 0 && (
            <p className="mt-4 text-xs text-slate-400">Showing {visible.length} of {meetings.length} meetings</p>
          )}
        </section>

        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Icon.Check className="h-4 w-4" /> Meetings and notes are private to you. Workspace admins manage sharing permissions.
        </p>
      </div>
    </main>
  );
}
