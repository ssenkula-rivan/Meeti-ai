'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  meetingsApi,
  actionItemsApi,
  type Meeting,
  type ActionItem,
} from '@/lib/api';
import {
  StatTile,
  ActivityChart,
  AvatarStack,
  Icon,
  useDashboardProfile,
} from '@/components/dashboard';

function sameDay(a: string | Date, b: Date) {
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
}

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function summaryTone(status: Meeting['status']) {
  if (status === 'completed') return { label: 'Ready', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' };
  if (status === 'processing') return { label: 'Processing', cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' };
  if (status === 'recording') return { label: 'Recording', cls: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300' };
  return { label: status || 'Draft', cls: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300' };
}

export default function DashboardPage() {
  const router = useRouter();
  const profile = useDashboardProfile();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [meetingsRes, actionsRes] = await Promise.all([
        meetingsApi.list(),
        actionItemsApi.getUserItems('pending').catch(() => ({ data: [] })),
      ]);
      setMeetings(meetingsRes.data);
      setActionItems(actionsRes.data || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      if (error?.response?.status === 401) {
        localStorage.removeItem('auth_token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const totalMinutes = Math.round(meetings.reduce((a, m) => a + (m.duration_seconds || 0), 0) / 60);
    const completed = meetings.filter((m) => m.status === 'completed').length;
    const timeSaved = Math.round((totalMinutes * 0.6) / 6) / 10;

    const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const thisMonth = meetings.filter((m) => { const t = new Date(m.created_at); return t >= startThis && t < startNext; }).length;
    const prevMonth = meetings.filter((m) => { const t = new Date(m.created_at); return t >= startPrev && t < startThis; }).length;
    const delta = prevMonth > 0 ? `+${(((thisMonth - prevMonth) / prevMonth) * 100).toFixed(1)}%` : undefined;

    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); days.push(d); }
    const labels = days.map((d) => `${d.toLocaleDateString(undefined, { weekday: 'short' })}, ${d.getDate()}`);
    const meetingsByDay = days.map((d) => meetings.filter((m) => sameDay(m.created_at, d)).length);
    const minutesByDay = days.map((d) => Math.round(meetings.filter((m) => sameDay(m.created_at, d)).reduce((a, m) => a + (m.duration_seconds || 0), 0) / 60));

    const monthLabel = `${now.toLocaleDateString(undefined, { month: 'short' })} 1 – ${now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).split(' ').pop()}`;

    return { totalMinutes, completed, timeSaved, delta, labels, meetingsByDay, minutesByDay, monthLabel };
  }, [meetings]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="text-sm font-medium text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (profile?.profile?.full_name || '').split(' ')[0];
  const recent = meetings.slice(0, 5);

  return (
    <main className="flex-1 px-6 py-8">
          {/* Greeting row */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A little less busywork. A lot more meaningful conversations.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 sm:flex">
                <Icon.Calendar className="h-4 w-4 text-slate-400" /> {stats.monthLabel}
              </span>
              <Link href="/dashboard/meetings/new" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700">
                <Icon.Plus className="h-4 w-4" /> New meeting
              </Link>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Total meetings" value={meetings.length} delta={stats.delta} tone="violet" icon={<Icon.Video className="h-5 w-5" />} spark={stats.meetingsByDay} />
            <StatTile label="Transcription minutes" value={stats.totalMinutes.toLocaleString()} delta={stats.delta} tone="green" icon={<Icon.Check className="h-5 w-5" />} spark={stats.minutesByDay} />
            <StatTile label="AI summaries" value={stats.completed} delta={stats.delta} tone="fuchsia" icon={<Icon.Sparkles className="h-5 w-5" />} spark={stats.meetingsByDay} />
            <StatTile label="Time saved" value={stats.timeSaved} unit="hrs" delta={stats.delta} tone="blue" icon={<Icon.Clock className="h-5 w-5" />} spark={stats.minutesByDay} />
          </div>

          {/* Main + right rail */}
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              {/* Activity chart */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Meeting activity</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Your conversations, at a glance.</p>
                  </div>
                  <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium dark:border-white/10">
                    <button className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-900 dark:bg-white/10 dark:text-white">7 days</button>
                    <button className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:text-slate-400">30 days</button>
                    <button className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:text-slate-400">6 months</button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Meetings</span>
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-fuchsia-500" /> Minutes transcribed</span>
                  <span className="ml-auto">{meetings.length} meetings · {stats.totalMinutes.toLocaleString()} minutes this week</span>
                </div>
                <div className="mt-2">
                  <ActivityChart days={stats.labels} meetings={stats.meetingsByDay} minutes={stats.minutesByDay} />
                </div>
              </section>

              {/* Recent meetings table */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent meetings</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Every conversation. Everything you need.</p>
                  </div>
                  <Link href="/dashboard/meetings" className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300">
                    View all meetings <Icon.Arrow className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-white/10">
                        <th className="pb-3 font-medium">Meeting name</th>
                        <th className="pb-3 font-medium">Date and time</th>
                        <th className="pb-3 font-medium">Duration</th>
                        <th className="pb-3 font-medium">Participants</th>
                        <th className="pb-3 font-medium">AI summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {recent.length === 0 ? (
                        <tr><td colSpan={5} className="py-10 text-center text-slate-400">No meetings yet. Start a new meeting to generate notes.</td></tr>
                      ) : (
                        recent.map((m) => {
                          const tone = summaryTone(m.status);
                          const mins = Math.round((m.duration_seconds || 0) / 60);
                          return (
                            <tr key={m.id} className="group">
                              <td className="py-3">
                                <Link href={`/dashboard/meetings/${m.id}`} className="flex items-center gap-3">
                                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><Icon.Video className="h-5 w-5" /></span>
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium text-slate-900 group-hover:text-violet-700 dark:text-white">{m.title}</span>
                                    <span className="block truncate text-xs text-slate-400">{m.meeting_type || 'General'}</span>
                                  </span>
                                </Link>
                              </td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{mins ? `${mins} min` : '--'}</td>
                              <td className="py-3"><AvatarStack initials={initialsOf(m.title).split('')} /></td>
                              <td className="py-3">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone.cls}`}>{tone.label}</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-slate-400">Private and securely stored</p>
              </section>
            </div>

            {/* Right rail */}
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Quick actions</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { href: '/dashboard/meetings/new', label: 'Start meeting', icon: <Icon.Video className="h-5 w-5" /> },
                    { href: '/dashboard/meetings/new', label: 'Schedule', icon: <Icon.Calendar className="h-5 w-5" /> },
                    { href: '/dashboard/meetings/new', label: 'Upload recording', icon: <Icon.Upload className="h-5 w-5" /> },
                    { href: '/dashboard/meetings', label: 'Join with link', icon: <Icon.Link className="h-5 w-5" /> },
                  ].map((a) => (
                    <Link key={a.label} href={a.href} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:bg-violet-50/50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-violet-500/10">
                      <span className="text-violet-600 dark:text-violet-300">{a.icon}</span>
                      {a.label}
                    </Link>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Up next</h2>
                  <span className="text-xs font-medium text-violet-600 dark:text-violet-300">Today</span>
                </div>
                {recent[0] ? (
                  <div className="mt-4 flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                      <span className="text-[10px] font-semibold uppercase">{new Date(recent[0].created_at).toLocaleDateString(undefined, { month: 'short' })}</span>
                      <span className="text-base font-bold leading-none">{new Date(recent[0].created_at).getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900 dark:text-white">{recent[0].title}</p>
                      <p className="text-xs text-slate-400">{new Date(recent[0].created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">No upcoming meetings scheduled.</p>
                )}
                <Link href="/dashboard/meetings/new" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700">
                  <Icon.Video className="h-4 w-4" /> Join meeting
                </Link>
              </section>

              <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-violet-950 p-6 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <Icon.Sparkles className="h-5 w-5 text-violet-300" />
                  <h2 className="text-base font-semibold">Your AI, one step ahead</h2>
                </div>
                <p className="mt-1 text-xs text-slate-300">The important things, without the replay.</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><Icon.Check className="h-4 w-4 text-violet-300" /></span>
                    <div>
                      <p className="text-sm font-semibold">{actionItems.length} action items need a follow-up</p>
                      <p className="text-xs text-slate-400">Keep things moving.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><Icon.Clock className="h-4 w-4 text-violet-300" /></span>
                    <div>
                      <p className="text-sm font-semibold">More focus. Shorter meetings.</p>
                      <p className="text-xs text-slate-400">Track how your meeting time changes over weeks.</p>
                    </div>
                  </div>
                </div>
                <Link href="/dashboard/ai" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20">
                  Explore all insights <Icon.Arrow className="h-4 w-4" />
                </Link>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Your workspace usage</h2>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">Pro</span>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400"><span>Transcription minutes</span><span className="font-medium text-slate-900 dark:text-white">{stats.totalMinutes.toLocaleString()} / 2,000</span></div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, (stats.totalMinutes / 2000) * 100)}%` }} />
                    </div>
                  </div>
                </div>
                <Link href="/dashboard/billing" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300">
                  Manage plan <Icon.Arrow className="h-4 w-4" />
                </Link>
              </section>
            </div>
          </div>
    </main>
  );
}
