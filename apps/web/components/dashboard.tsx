'use client';

import Link from 'next/link';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { actionItemsApi, type UserProfileResponse } from '@/lib/api';

/* Presentational building blocks for the redesigned iMeet dashboard.
   These follow the Figma layout: a persistent left sidebar, a top bar,
   stat tiles with sparklines, and a combined bar/line activity chart.
   Icons are inline SVG so no icon dependency is added to the project. */

/* The dashboard layout loads the profile once and shares it through this
   context so individual pages can greet the user without refetching. */
const ProfileContext = createContext<UserProfileResponse | null>(null);
export const ProfileProvider = ProfileContext.Provider;
export function useDashboardProfile() {
  return useContext(ProfileContext);
}

type IconProps = { className?: string };

const base = 'h-5 w-5';
export const Icon = {
  Grid: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
  ),
  Video: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m16 10 6-3v10l-6-3z" /></svg>
  ),
  Play: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4z" /></svg>
  ),
  Check: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
  ),
  Calendar: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
  ),
  Sparkles: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>
  ),
  Users: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  Plug: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v5" /></svg>
  ),
  Upload: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5M12 3v12" /></svg>
  ),
  Link: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
  ),
  Clock: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  Search: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  Bell: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
  ),
  Plus: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
  Arrow: ({ className = 'h-4 w-4' }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  Settings: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></svg>
  ),
  Help: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" /><path d="M12 17h.01" /></svg>
  ),
};

const WORKSPACE_NAV = [
  { href: '/dashboard', label: 'Dashboard', exact: true, icon: Icon.Grid },
  { href: '/dashboard/meetings', label: 'My meetings', icon: Icon.Video },
  { href: '/dashboard/notes', label: 'Recordings', icon: Icon.Play },
  { href: '/dashboard/tasks', label: 'Action items', icon: Icon.Check, badge: true },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Icon.Calendar },
  { href: '/dashboard/ai', label: 'AI assistant', icon: Icon.Sparkles },
];

const MANAGE_NAV = [
  { href: '/dashboard/organizations', label: 'Team members', icon: Icon.Users },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Icon.Plug },
];

function NavItem({
  href,
  label,
  icon: IconCmp,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: (p: IconProps) => JSX.Element;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active
          ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
      }`}
    >
      <IconCmp className={`h-5 w-5 ${active ? 'text-violet-600 dark:text-violet-300' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-violet-100 px-1.5 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ userName }: { userName?: string }) {
  const pathname = usePathname();
  const profile = useDashboardProfile();
  const [pendingItems, setPendingItems] = useState<number | undefined>(undefined);

  useEffect(() => {
    actionItemsApi
      .getUserItems('pending')
      .then((res) => setPendingItems(res.data.length))
      .catch(() => {});
  }, []);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const workspaceName = profile?.profile?.full_name
    ? `${profile.profile.full_name.split(' ')[0]}\u2019s workspace`
    : 'Personal workspace';

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center gap-2 px-2">
        <img src="/apple-touch-icon.png" alt="Meeti" className="h-8 w-8 rounded-lg object-cover" />
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Meeti</span>
      </div>

      <button className="mt-6 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-violet-300 dark:border-white/10 dark:bg-white/5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">{(userName || 'U').trim().charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{workspaceName}</span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{userName || 'Personal account'}</span>
        </span>
        <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 9 4-4 4 4M8 15l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      <div className="mt-6 flex-1 space-y-6 overflow-y-auto">
        <nav className="space-y-1">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Workspace</p>
          {WORKSPACE_NAV.map((item) => (
            <NavItem key={item.href} {...item} badge={item.badge ? pendingItems : undefined} active={isActive(item.href, item.exact)} />
          ))}
        </nav>
        <nav className="space-y-1">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Manage</p>
          {MANAGE_NAV.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href, item.exact)} />
          ))}
        </nav>
      </div>

      <div className="mt-4 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-4 dark:from-violet-500/10 dark:to-indigo-500/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white">
          <Icon.Sparkles className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Less notes. More focus.</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Let Meeti capture the details while you stay in the conversation.</p>
        <Link href="/dashboard/ai" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700">
          Meet your AI assistant <Icon.Arrow className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 dark:border-white/10">
        <NavItem href="/dashboard/settings" label="Settings" icon={Icon.Settings} active={isActive('/dashboard/settings')} />
        <NavItem href="/dashboard/settings" label="Help and support" icon={Icon.Help} active={false} />
      </div>
    </aside>
  );
}

export function TopBar({
  userName,
  search,
}: {
  userName?: string;
  search?: React.ReactNode;
}) {
  const initials = (userName || 'User')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-6 backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
      <nav className="hidden items-center gap-2 text-sm text-slate-500 dark:text-slate-400 sm:flex">
        <span>Workspace</span>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-900 dark:text-white">Dashboard</span>
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden md:block">{search}</div>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:text-white">
          <Icon.Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-500" />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 dark:border-white/10">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-bold text-white">{initials}</span>
          <span className="hidden text-sm font-medium text-slate-900 dark:text-white sm:block">{userName || 'Account'}</span>
        </div>
      </div>
    </header>
  );
}

export function Sparkline({ points, className = '' }: { points: number[]; className?: string }) {
  if (points.length < 2) return null;
  const w = 96;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - ((p - min) / span) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg className={className} width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" preserveAspectRatio="none">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  unit,
  delta,
  tone,
  icon,
  spark,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  tone: 'violet' | 'green' | 'fuchsia' | 'blue';
  icon: React.ReactNode;
  spark: number[];
}) {
  const tones: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    fuchsia: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
    blue: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  };
  const sparkTone: Record<string, string> = {
    violet: 'text-violet-500',
    green: 'text-emerald-500',
    fuchsia: 'text-fuchsia-500',
    blue: 'text-sky-500',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</span>
            {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
          </div>
          {delta && (
            <div className="mt-1 flex items-center gap-1 text-xs">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{delta}</span>
              <span className="text-slate-400">vs last month</span>
            </div>
          )}
        </div>
        <Sparkline points={spark} className={sparkTone[tone]} />
      </div>
    </div>
  );
}

export function ActivityChart({
  days,
  meetings,
  minutes,
}: {
  days: string[];
  meetings: number[];
  minutes: number[];
}) {
  const w = 720;
  const h = 220;
  const pad = 28;
  const maxM = Math.max(...meetings, 1);
  const maxMin = Math.max(...minutes, 1);
  const slot = (w - pad * 2) / meetings.length;
  const barW = Math.min(34, slot * 0.5);
  const linePts = minutes
    .map((m, i) => {
      const x = pad + slot * i + slot / 2;
      const y = h - pad - (m / maxMin) * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full" fill="none" preserveAspectRatio="none">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={pad} x2={w - pad} y1={pad + t * (h - pad * 2)} y2={pad + t * (h - pad * 2)} stroke="currentColor" className="text-slate-100 dark:text-white/5" strokeWidth="1" />
      ))}
      {meetings.map((m, i) => {
        const bh = (m / maxM) * (h - pad * 2);
        const x = pad + slot * i + (slot - barW) / 2;
        const y = h - pad - bh;
        return <rect key={i} x={x} y={y} width={barW} height={Math.max(bh, 2)} rx="6" className={i === meetings.indexOf(Math.max(...meetings)) ? 'fill-violet-500' : 'fill-violet-300 dark:fill-violet-400/40'} />;
      })}
      <path d={linePts} stroke="currentColor" className="text-fuchsia-500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {days.map((d, i) => (
        <text key={i} x={pad + slot * i + slot / 2} y={h - 6} textAnchor="middle" className="fill-slate-400 text-[10px]">{d}</text>
      ))}
    </svg>
  );
}

export function AvatarStack({ initials, extra }: { initials: string[]; extra?: number }) {
  const tones = ['bg-violet-100 text-violet-700', 'bg-sky-100 text-sky-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700'];
  return (
    <div className="flex items-center -space-x-2">
      {initials.map((n, i) => (
        <span key={i} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold dark:border-slate-900 ${tones[i % tones.length]}`}>
          {n}
        </span>
      ))}
      {extra ? <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-500 dark:border-slate-900 dark:bg-white/10">+{extra}</span> : null}
    </div>
  );
}
