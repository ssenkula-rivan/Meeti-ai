'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { meetingsApi, type Meeting } from '@/lib/api';
import { Icon } from '@/components/dashboard';

/* Calendar screen from the iMeet design. Rendered as a month grid plus a day
   agenda, driven entirely by real meetings (their start or creation date). No
   fake data: days with no meetings are simply empty. */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function meetingDate(m: Meeting) {
  return new Date(m.started_at || m.created_at);
}

export default function CalendarPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => ymd(new Date()));

  useEffect(() => {
    meetingsApi
      .list()
      .then((res) => setMeetings(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const byDay = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    for (const m of meetings) {
      const key = ymd(meetingDate(m));
      (map[key] ||= []).push(m);
    }
    return map;
  }, [meetings]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayKey = ymd(new Date());
  const dayMeetings = byDay[selected] || [];
  const upcoming = useMemo(
    () =>
      [...meetings]
        .filter((m) => meetingDate(m).getTime() >= Date.now() - 1000 * 60 * 60 * 24)
        .sort((a, b) => meetingDate(a).getTime() - meetingDate(b).getTime())
        .slice(0, 6),
    [meetings]
  );

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
    setSelected(ymd(next));
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="text-sm font-medium text-slate-400">Loading calendar...</div>
      </div>
    );
  }

  return (
    <main className="flex-1 px-6 py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your meetings, laid out across the month.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900">
            <button onClick={() => shiftMonth(-1)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white" aria-label="Previous month">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <span className="min-w-[9rem] text-center text-sm font-semibold text-slate-900 dark:text-white">{monthLabel}</span>
            <button onClick={() => shiftMonth(1)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white" aria-label="Next month">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
          <Link href="/dashboard/meetings/new" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700">
            <Icon.Plus className="h-4 w-4" /> New meeting
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2 dark:border-white/10 dark:bg-slate-900">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((date, i) => {
              if (!date) return <div key={i} className="min-h-[5.5rem] rounded-lg" />;
              const key = ymd(date);
              const items = byDay[key] || [];
              const isSelected = key === selected;
              const isToday = key === todayKey;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(key)}
                  className={`min-h-[5.5rem] rounded-lg border p-1.5 text-left transition ${
                    isSelected
                      ? 'border-violet-300 bg-violet-50/60 dark:border-violet-500/40 dark:bg-violet-500/10'
                      : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/10 dark:hover:bg-white/5'
                  }`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-violet-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    {date.getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {items.slice(0, 2).map((m) => (
                      <div key={m.id} className="truncate rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                        {m.title}
                      </div>
                    ))}
                    {items.length > 2 && <div className="px-1.5 text-[10px] text-slate-400">+{items.length - 2} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {new Date(selected + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </h2>
            <div className="mt-4 space-y-3">
              {dayMeetings.length === 0 ? (
                <p className="text-sm text-slate-400">No meetings on this day.</p>
              ) : (
                dayMeetings.map((m) => (
                  <Link key={m.id} href={`/dashboard/meetings/${m.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-violet-300 dark:border-white/10">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><Icon.Video className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{m.title}</span>
                      <span className="block text-xs text-slate-400">{meetingDate(m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {m.status}</span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Upcoming</h2>
            <div className="mt-4 space-y-3">
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing scheduled ahead.</p>
              ) : (
                upcoming.map((m) => (
                  <div key={m.id} className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 text-slate-700 dark:bg-white/5 dark:text-slate-200">
                      <span className="text-[10px] font-semibold uppercase">{meetingDate(m).toLocaleDateString(undefined, { month: 'short' })}</span>
                      <span className="text-sm font-bold leading-none">{meetingDate(m).getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/meetings/${m.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-violet-700 dark:text-white">{m.title}</Link>
                      <p className="text-xs text-slate-400">{meetingDate(m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
