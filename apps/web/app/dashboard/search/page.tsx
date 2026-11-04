'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { meetingsApi, notesApi, type Meeting, type ManualNote } from '@/lib/api';
import { Icon } from '@/components/dashboard';

/* Search screen — shared dashboard shell (the layout already renders the sidebar
   and top bar, so this page only owns the <main> content). The top bar's global
   search links here with ?q=, which we read and run automatically. Everything
   shown comes from the live API: meetings via the search endpoint, manual notes
   filtered client-side. No fabricated results. */

function statusPill(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'processing':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    case 'recording':
      return 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300';
    case 'failed':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';
  }
}

function formatDate(dateString?: string) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDuration(seconds?: number) {
  if (!seconds) return '0 min';
  return `${Math.round(seconds / 60)} min`;
}

function highlight(text: string, q: string) {
  const query = q.trim();
  if (!query) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safe})`, 'ig'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-violet-100 px-0.5 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notes, setNotes] = useState<ManualNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const runSearch = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const [meetingsRes, notesRes] = await Promise.all([
        meetingsApi.search(term).catch(() => ({ data: [] as Meeting[] })),
        notesApi.list().catch(() => ({ data: [] as ManualNote[] })),
      ]);
      setMeetings(meetingsRes.data || []);
      setNotes(notesRes.data || []);
      setSearched(true);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run whenever the committed query changes (including the ?q= deep link).
  useEffect(() => {
    runSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Keep the input in sync when the top bar navigates here with a new ?q=.
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setInput(q);
    setQuery(q);
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = input.trim();
    setQuery(next);
    // Reflect the query in the URL so the top-bar search and back/forward stay honest.
    router.replace(next ? `/dashboard/search?q=${encodeURIComponent(next)}` : '/dashboard/search', { scroll: false });
  };

  const handleClear = () => {
    setInput('');
    setTypeFilter('all');
    setStatusFilter('all');
    setQuery('');
    router.replace('/dashboard/search', { scroll: false });
  };

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (typeFilter !== 'all' && m.meeting_type !== typeFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      return true;
    });
  }, [meetings, typeFilter, statusFilter]);

  const matchedNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes.slice(0, 6);
    return notes.filter((n) => {
      const haystack = [n.title, n.content, n.agenda, n.objectives, n.meeting_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [notes, query]);

  const totalResults = filteredMeetings.length + matchedNotes.length;

  return (
    <main className="flex-1 px-6 py-8">
      <div>
        <div className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
          Find anything
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Search</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Search across your meeting summaries and your manual notes. Results come straight from your workspace.
        </p>
      </div>

      {/* Search input */}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon.Search className="h-5 w-5" />
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search meetings, transcripts, notes..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-16 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:focus:ring-violet-500/20"
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
        {(input || query) && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
          >
            Reset
          </button>
        )}
      </form>

      {/* Meeting filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="all">All types</option>
            <option value="business">Business</option>
            <option value="team">Team</option>
            <option value="client">Client</option>
            <option value="interview">Interview</option>
            <option value="class">Class</option>
            <option value="personal">Personal</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="recording">Recording</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        {searched && !loading && (
          <span className="ml-auto text-xs text-slate-400">
            {totalResults} {totalResults === 1 ? 'result' : 'results'}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-slate-900">
          <div className="mx-auto mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Searching your workspace…</p>
        </div>
      ) : totalResults === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-slate-900">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {query ? `No matches for “${query}”` : 'Nothing here yet'}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            {query
              ? 'Try different keywords, or loosen the type and status filters.'
              : 'Record a meeting or write a note and it will show up here.'}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/dashboard/meetings/new"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              <Icon.Plus className="h-4 w-4" /> New meeting
            </Link>
            <Link
              href="/dashboard/notes"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
            >
              New note
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Meetings */}
          {filteredMeetings.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Meetings <span className="tabular-nums opacity-70">· {filteredMeetings.length}</span>
              </h2>
              {filteredMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 dark:border-white/10 dark:bg-slate-900 dark:hover:border-violet-500/40"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/meetings/${meeting.id}`}
                          className="font-semibold text-slate-900 transition hover:text-violet-600 dark:text-white dark:hover:text-violet-300"
                        >
                          {highlight(meeting.title, query)}
                        </Link>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${statusPill(
                            meeting.status,
                          )}`}
                        >
                          {meeting.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Icon.Calendar className="h-3.5 w-3.5" /> {formatDate(meeting.created_at)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Icon.Clock className="h-3.5 w-3.5" /> {formatDuration(meeting.duration_seconds)}
                        </span>
                        {meeting.meeting_type && <span className="capitalize">{meeting.meeting_type.replace('_', ' ')}</span>}
                        {meeting.output_language && <span className="uppercase">{meeting.output_language}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                      <Link
                        href={`/dashboard/meetings/${meeting.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                      >
                        Open
                      </Link>
                      {meeting.status === 'processing' && (
                        <Link
                          href={`/dashboard/meetings/${meeting.id}/processing`}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600"
                        >
                          Processing
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Manual notes */}
          {matchedNotes.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Notes <span className="tabular-nums opacity-70">· {matchedNotes.length}</span>
              </h2>
              {matchedNotes.map((note) => (
                <Link key={note.id} href={`/dashboard/notes/${note.id}`} className="block">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 dark:border-white/10 dark:bg-slate-900 dark:hover:border-violet-500/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900 dark:text-white">
                          {highlight(note.title, query)}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                          {note.content?.slice(0, 140) || note.agenda || 'Empty note'}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                          <span>{formatDate(note.updated_at || note.created_at)}</span>
                          <span className="capitalize">{note.meeting_type || 'note'}</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        Manual note
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 px-6 py-8">
          <div className="text-sm font-medium text-slate-400">Loading search…</div>
        </main>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
