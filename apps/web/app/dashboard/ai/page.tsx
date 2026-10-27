'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  meetingsApi,
  actionItemsApi,
  type Meeting,
  type ActionItem,
  type MeetingSummary,
  type MeetingDecision,
} from '@/lib/api';
import { Icon } from '@/components/dashboard';

/* AI assistant screen from the iMeet design. It surfaces real insight cards
   derived from completed meetings: recent summaries, extracted decisions, and
   open action items. The ask box filters existing meetings on the client rather
   than pretending to run a model that is not wired up yet. */
export default function AIAssistantPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [insights, setInsights] = useState<{ meeting: Meeting; summary?: MeetingSummary; decisions: MeetingDecision[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [mRes, aRes] = await Promise.all([
          meetingsApi.list(),
          actionItemsApi.getUserItems('pending').catch(() => ({ data: [] as ActionItem[] })),
        ]);
        const list = mRes.data || [];
        setMeetings(list);
        setActionItems(aRes.data || []);

        const completed = list.filter((m) => m.status === 'completed').slice(0, 4);
        const loaded = await Promise.all(
          completed.map(async (meeting) => {
            const [sum, dec] = await Promise.all([
              meetingsApi.getSummary(meeting.id).catch(() => null),
              meetingsApi.getDecisions(meeting.id).catch(() => ({ data: [] as MeetingDecision[] })),
            ]);
            return { meeting, summary: sum?.data, decisions: dec?.data || [] };
          })
        );
        setInsights(loaded);
      } catch (error) {
        console.error('Failed to load AI insights:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meetings.slice(0, 5);
    return meetings.filter((m) => m.title.toLowerCase().includes(q)).slice(0, 8);
  }, [meetings, query]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="text-sm font-medium text-slate-400">Preparing your insights...</div>
      </div>
    );
  }

  return (
    <main className="flex-1 px-6 py-8">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-violet-950 p-6 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <Icon.Sparkles className="h-6 w-6 text-violet-300" />
          <h1 className="text-xl font-bold tracking-tight">Your AI assistant</h1>
        </div>
        <p className="mt-1 text-sm text-slate-300">Summaries, decisions, and follow-ups pulled from your meetings.</p>
        <form onSubmit={(e) => e.preventDefault()} className="mt-4 flex max-w-xl items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon.Search className="h-4 w-4" /></span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your meetings..."
              className="w-full rounded-xl border border-white/10 bg-white/10 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none"
            />
          </div>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Meetings summarized</p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{meetings.filter((m) => m.status === 'completed').length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Open action items</p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{actionItems.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Decisions captured</p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{insights.reduce((a, i) => a + i.decisions.length, 0)}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent insights</h2>
          <div className="mt-4 space-y-4">
            {insights.length === 0 ? (
              <p className="text-sm text-slate-400">No completed meetings yet. AI summaries appear once a meeting finishes processing.</p>
            ) : (
              insights.map(({ meeting, summary }) => (
                <Link key={meeting.id} href={`/dashboard/meetings/${meeting.id}`} className="block rounded-xl border border-slate-200 p-4 transition hover:border-violet-300 dark:border-white/10">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                    <Icon.Sparkles className="h-4 w-4" /> {meeting.title}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                    {summary?.executive_summary || summary?.summary || 'Summary is being generated.'}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Needs your attention</h2>
          <div className="mt-4 space-y-3">
            {actionItems.length === 0 ? (
              <p className="text-sm text-slate-400">You are all caught up on action items.</p>
            ) : (
              actionItems.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                  <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"><Icon.Check className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.task}</p>
                    <p className="text-xs text-slate-400">{item.assignee ? `Assigned to ${item.assignee}` : 'Unassigned'}{item.due_date ? ` · due ${new Date(item.due_date).toLocaleDateString()}` : ''}</p>
                  </div>
                </div>
              ))
            )}
            <Link href="/dashboard/tasks" className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300">
              View all action items <Icon.Arrow className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>

      {query && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Matching meetings</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400">No meetings match “{query}”.</p>
            ) : (
              filtered.map((m) => (
                <Link key={m.id} href={`/dashboard/meetings/${m.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-violet-300 dark:border-white/10">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><Icon.Video className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{m.title}</span>
                    <span className="block text-xs text-slate-400">{m.status}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}
