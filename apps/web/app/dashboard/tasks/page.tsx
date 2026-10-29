'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { actionItemsApi, meetingsApi, type ActionItem, type Meeting } from '@/lib/api';
import { Icon, useDashboardProfile } from '@/components/dashboard';

/* Action items screen — layout mirrors the "Action items" frame in Figma
   (node 110:48765): page header + Export/Add, four metric tiles, an AI
   banner, a tabbed card with List/Board views, a filter row and a table.
   The dashboard shell already renders the sidebar + top bar, so this page
   only owns the <main> content. All data comes from the live API. */

const BASE_SVG = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/* Extra icons Figma uses that aren't in the shared set yet. */
const IconListChecks = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} {...BASE_SVG}><path d="m3 7 2 2 4-4" /><path d="m3 17 2 2 4-4" /><path d="M13 8h8M13 12h8M13 16h8" /></svg>
);
const IconLoader = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} {...BASE_SVG}><path d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9" /></svg>
);
const IconCircleCheck = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} {...BASE_SVG}><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></svg>
);
const IconDownload = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} {...BASE_SVG}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
);
const IconFlag = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} {...BASE_SVG}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" /></svg>
);
const IconMore = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} {...BASE_SVG}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
);

type TabKey = 'open' | 'mine' | 'completed';
type ViewKey = 'list' | 'board';

const OPEN_STATUSES: ActionItem['status'][] = ['pending', 'in_progress', 'overdue'];
const isOpen = (s: ActionItem['status']) => OPEN_STATUSES.includes(s);

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function statusBadge(s: ActionItem['status']) {
  switch (s) {
    case 'in_progress': return { label: 'In progress', cls: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300' };
    case 'completed': return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' };
    case 'cancelled': return { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400' };
    case 'overdue': return { label: 'Overdue', cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300' };
    default: return { label: 'To do', cls: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' };
  }
}
function priorityBadge(p?: string) {
  const v = (p || '').toLowerCase();
  if (v === 'high') return { label: 'High', cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300' };
  if (v === 'medium') return { label: 'Medium', cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' };
  if (v === 'low') return { label: 'Low', cls: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400' };
  return { label: p || '—', cls: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400' };
}

function MetricCard({
  icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  caption: string;
  tone: 'violet' | 'amber' | 'fuchsia' | 'green';
}) {
  const tones: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    fuchsia: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{caption}</div>
    </div>
  );
}

export default function TasksPage() {
  const profile = useDashboardProfile();
  const meName = (profile?.profile?.full_name || '').trim();

  const [items, setItems] = useState<ActionItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>('open');
  const [view, setView] = useState<ViewKey>('list');
  const [q, setQ] = useState('');
  const [fAssignee, setFAssignee] = useState('all');
  const [fPriority, setFPriority] = useState('all');
  const [fDue, setFDue] = useState('all');

  const [menuId, setMenuId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({ meetingId: '', task: '', assignee: '', dueDate: '', priority: 'medium' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsRes, meetingsRes] = await Promise.all([
        actionItemsApi.getUserItems(),
        meetingsApi.list().catch(() => ({ data: [] as Meeting[] })),
      ]);
      setItems(itemsRes.data || []);
      setMeetings(meetingsRes.data || []);
      if (meetingsRes.data.length > 0) setNewTask((p) => ({ ...p, meetingId: meetingsRes.data[0].id }));
    } catch (err) {
      console.error('Failed to load action items:', err);
    } finally {
      setLoading(false);
    }
  };

  const reload = async () => {
    try {
      const res = await actionItemsApi.getUserItems();
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to reload action items:', err);
    }
  };

  const isMine = (item: ActionItem) => {
    if (!meName || !item.assignee) return false;
    const a = item.assignee.toLowerCase();
    const me = meName.toLowerCase();
    return a === me || a.includes(me) || me.includes(a);
  };

  const now = new Date();
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const weekEnd = new Date(); weekEnd.setDate(now.getDate() + 7); weekEnd.setHours(23, 59, 59, 999);

  const openItems = items.filter((i) => isOpen(i.status));
  const completedItems = items.filter((i) => i.status === 'completed');
  const mineItems = openItems.filter(isMine);

  const distinctMeetings = new Set(openItems.map((i) => i.meeting_id)).size;
  const dueToday = openItems.filter((i) => i.due_date && sameDay(new Date(i.due_date), now)).length;
  const inProgress = items.filter((i) => i.status === 'in_progress').length;
  const completedThisMonth = completedItems.filter((i) => {
    if (!i.created_at) return false;
    const d = new Date(i.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const assigneeOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.assignee).filter((a): a is string => !!a))).sort(),
    [items],
  );

  const rows = useMemo(() => {
    let base =
      tab === 'open' ? openItems
        : tab === 'mine' ? mineItems
          : completedItems;
    const query = q.trim().toLowerCase();
    if (query) base = base.filter((i) => i.task.toLowerCase().includes(query) || (i.meeting_title || '').toLowerCase().includes(query));
    if (fAssignee !== 'all') base = base.filter((i) => (i.assignee || '') === fAssignee);
    if (fPriority !== 'all') base = base.filter((i) => (i.priority || '').toLowerCase() === fPriority);
    if (fDue === 'today') base = base.filter((i) => i.due_date && sameDay(new Date(i.due_date), now));
    else if (fDue === 'overdue') base = base.filter((i) => i.due_date && new Date(i.due_date) < today0 && i.status !== 'completed');
    else if (fDue === 'week') base = base.filter((i) => { if (!i.due_date) return false; const d = new Date(i.due_date); return d >= today0 && d <= weekEnd; });
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tab, q, fAssignee, fPriority, fDue]);

  const setStatus = async (id: string, status: string) => {
    setMenuId(null);
    try {
      await actionItemsApi.updateStatus(id, status);
      await reload();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const toggleDone = (item: ActionItem) => setStatus(item.id, item.status === 'completed' ? 'pending' : 'completed');

  const handleDelete = async (id: string) => {
    setMenuId(null);
    if (!confirm('Delete this action item?')) return;
    try {
      await actionItemsApi.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Failed to delete action item:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.task.trim() || !newTask.meetingId) return;
    setCreating(true);
    try {
      await actionItemsApi.create({
        meetingId: newTask.meetingId,
        task: newTask.task.trim(),
        assignee: newTask.assignee.trim() || undefined,
        dueDate: newTask.dueDate || undefined,
        priority: newTask.priority,
      });
      setNewTask({ meetingId: meetings[0]?.id || '', task: '', assignee: '', dueDate: '', priority: 'medium' });
      setShowAdd(false);
      await reload();
    } catch (err) {
      console.error('Failed to create action item:', err);
      alert('Failed to create action item');
    } finally {
      setCreating(false);
    }
  };

  const exportCsv = () => {
    const cell = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
    const header = ['Action item', 'Source meeting', 'Assignee', 'Due date', 'Priority', 'Status'];
    const lines = rows.map((r) => [r.task, r.meeting_title || '', r.assignee || '', r.due_date || '', r.priority || '', r.status].map(cell).join(','));
    const blob = new Blob([[header.map(cell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'action-items.csv'; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'open', label: 'All open', count: openItems.length },
    { key: 'mine', label: 'Assigned to me', count: mineItems.length },
    { key: 'completed', label: 'Completed', count: completedItems.length },
  ];

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center py-24">
        <div className="text-sm font-medium text-slate-400">Loading action items...</div>
      </main>
    );
  }

  const dueMeta = (item: ActionItem) => {
    if (!item.due_date) return null;
    const d = new Date(item.due_date);
    if (item.status === 'completed') return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), cls: 'text-slate-400' };
    if (sameDay(d, now)) return { text: 'Today', cls: 'text-amber-600 dark:text-amber-400 font-medium' };
    if (d < today0) return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), cls: 'text-red-600 dark:text-red-400 font-medium' };
    return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), cls: 'text-slate-500 dark:text-slate-400' };
  };

  const boardColumns: { key: string; label: string; match: (i: ActionItem) => boolean }[] = [
    { key: 'todo', label: 'To do', match: (i) => i.status === 'pending' || i.status === 'overdue' },
    { key: 'inprog', label: 'In progress', match: (i) => i.status === 'in_progress' },
    { key: 'done', label: 'Completed', match: (i) => i.status === 'completed' },
  ];

  const selectCls = 'rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-600 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300';

  return (
    <main className="flex-1 px-6 py-8">
      {/* Page introduction */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Action items</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">From conversation to progress. Keep the next steps moving.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
          >
            <IconDownload className="h-4 w-4" /> Export
          </button>
          {meetings.length > 0 && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Icon.Plus className="h-4 w-4" /> Add action item
            </button>
          )}
        </div>
      </div>

      {/* Task metrics */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<IconListChecks className="h-5 w-5" />} label="Open action items" value={openItems.length} caption={`Across ${distinctMeetings} meeting${distinctMeetings === 1 ? '' : 's'}`} tone="violet" />
        <MetricCard icon={<Icon.Calendar className="h-5 w-5" />} label="Due today" value={dueToday} caption={now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} tone="amber" />
        <MetricCard icon={<IconLoader className="h-5 w-5" />} label="In progress" value={inProgress} caption="Your team is making progress" tone="fuchsia" />
        <MetricCard icon={<IconCircleCheck className="h-5 w-5" />} label="Completed this month" value={completedThisMonth} caption="A little less on your plate" tone="green" />
      </div>

      {/* AI banner */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-violet-50 p-5 dark:bg-violet-500/10">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
          <Icon.Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-violet-700 dark:text-violet-200">Your AI spotted {openItems.length} next steps</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{dueToday} due today. Action items stay linked to the conversation so your team always has the context.</p>
        </div>
      </div>

      {/* Task views card */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <div className="flex self-start rounded-xl bg-slate-100 p-1 text-sm font-medium dark:bg-white/5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 transition ${tab === t.key ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
              >
                {t.label} <span className="tabular-nums opacity-70">· {t.count}</span>
              </button>
            ))}
          </div>
          <div className="flex self-start rounded-xl bg-slate-100 p-1 text-sm font-medium dark:bg-white/5">
            {(['list', 'board'] as ViewKey[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 capitalize transition ${view === v ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 dark:border-white/10">
          <div className="relative min-w-[180px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon.Search className="h-4 w-4" /></span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search action items"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <select value={fAssignee} onChange={(e) => setFAssignee(e.target.value)} className={selectCls}>
            <option value="all">All assignees</option>
            {assigneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={fPriority} onChange={(e) => setFPriority(e.target.value)} className={selectCls}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={fDue} onChange={(e) => setFDue(e.target.value)} className={selectCls}>
            <option value="all">Any due date</option>
            <option value="today">Due today</option>
            <option value="week">Due this week</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {tab === 'completed' ? 'No completed action items yet' : tab === 'mine' ? 'Nothing assigned to you right now' : 'No open action items'}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Action items are extracted automatically when meetings finish processing, or you can add one manually.
            </p>
            {meetings.length > 0 && (
              <button onClick={() => setShowAdd(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700">
                <Icon.Plus className="h-4 w-4" /> Add action item
              </button>
            )}
          </div>
        ) : view === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-white/10">
                  <th className="w-10 px-4 py-3" />
                  <th className="px-2 py-3 font-medium">Action item</th>
                  <th className="px-2 py-3 font-medium">Assignee</th>
                  <th className="px-2 py-3 font-medium">Due date</th>
                  <th className="px-2 py-3 font-medium">Priority</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {rows.map((item) => {
                  const done = item.status === 'completed';
                  const pr = priorityBadge(item.priority);
                  const st = statusBadge(item.status);
                  const due = dueMeta(item);
                  return (
                    <tr key={item.id} className="group">
                      <td className="px-4 py-3 align-top">
                        <input type="checkbox" checked={done} onChange={() => toggleDone(item)} className="mt-1 h-4 w-4 rounded border-slate-300 accent-violet-600" />
                      </td>
                      <td className="px-2 py-3">
                        <span className={`block font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>{item.task}</span>
                        {item.meeting_id && (
                          <Link href={`/dashboard/meetings/${item.meeting_id}`} className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-300">
                            <Icon.Video className="h-3.5 w-3.5" /> {item.meeting_title || 'Source meeting'}
                          </Link>
                        )}
                      </td>
                      <td className="px-2 py-3 align-middle">
                        {item.assignee ? (
                          <span className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">{initialsOf(item.assignee)}</span>
                            <span className="text-slate-600 dark:text-slate-300">{item.assignee}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-2 py-3 align-middle">
                        {due ? <span className={due.cls}>{due.text}</span> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-2 py-3 align-middle">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${pr.cls}`}><IconFlag className="h-3 w-3" />{pr.label}</span>
                      </td>
                      <td className="px-2 py-3 align-middle">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="relative px-2 py-3 align-middle">
                        <button onClick={() => setMenuId(menuId === item.id ? null : item.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200">
                          <IconMore className="h-5 w-5" />
                        </button>
                        {menuId === item.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                            <div className="absolute right-2 top-11 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-slate-800">
                              <button onClick={() => setStatus(item.id, 'pending')} className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5">Mark to do</button>
                              <button onClick={() => setStatus(item.id, 'in_progress')} className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5">Mark in progress</button>
                              <button onClick={() => setStatus(item.id, 'completed')} className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5">Mark completed</button>
                              <div className="my-1 h-px bg-slate-100 dark:bg-white/10" />
                              <button onClick={() => handleDelete(item.id)} className="block w-full rounded-lg px-3 py-1.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">Delete</button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
            {boardColumns.map((col) => {
              const list = rows.filter(col.match);
              return (
                <div key={col.key} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                  <div className="flex items-center justify-between px-1 pb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{col.label}</span>
                    <span className="text-xs font-medium text-slate-400">{list.length}</span>
                  </div>
                  <div className="space-y-3">
                    {list.length === 0 ? (
                      <p className="px-1 py-6 text-center text-xs text-slate-400">Nothing here</p>
                    ) : list.map((item) => {
                      const done = item.status === 'completed';
                      const pr = priorityBadge(item.priority);
                      const due = dueMeta(item);
                      return (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
                          <p className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>{item.task}</p>
                          {item.meeting_id && (
                            <Link href={`/dashboard/meetings/${item.meeting_id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-300">
                              <Icon.Video className="h-3.5 w-3.5" /> {item.meeting_title || 'Source meeting'}
                            </Link>
                          )}
                          <div className="mt-3 flex items-center justify-between">
                            {item.assignee ? (
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" title={item.assignee}>{initialsOf(item.assignee)}</span>
                            ) : <span className="text-xs text-slate-400">Unassigned</span>}
                            <div className="flex items-center gap-2">
                              {due && <span className={`text-xs ${due.cls}`}>{due.text}</span>}
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${pr.cls}`}>{pr.label}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {rows.length > 0 && (
          <div className="border-t border-slate-200 px-4 py-3 dark:border-white/10">
            <p className="text-xs text-slate-400">
              Showing {rows.length} {tab === 'completed' ? 'completed' : 'open'} action item{rows.length === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </section>

      {/* Add Action Item modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add action item</h2>
              <button onClick={() => setShowAdd(false)} className="text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Close</button>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Meeting</label>
                <select value={newTask.meetingId} onChange={(e) => setNewTask({ ...newTask, meetingId: e.target.value })} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white">
                  {meetings.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Task</label>
                <input type="text" required placeholder="e.g. Send the updated roadmap to the client" value={newTask.task} onChange={(e) => setNewTask({ ...newTask, task: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assignee (optional)</label>
                  <input type="text" placeholder="e.g. Sarah Reed" value={newTask.assignee} onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Priority</label>
                  <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Due date (optional)</label>
                <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={creating} className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50">{creating ? 'Saving...' : 'Create action item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
