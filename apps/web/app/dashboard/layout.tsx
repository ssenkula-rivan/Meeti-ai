'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, type UserProfileResponse } from '@/lib/api';
import { Sidebar, TopBar, Icon, ProfileProvider } from '@/components/dashboard';

/* Shared shell for every dashboard page: persistent left sidebar plus top bar,
   matching the iMeet design. Handles the auth redirect once so individual pages
   do not need their own navbar. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    authApi
      .getProfile()
      .then((res) => setProfile(res.data))
      .catch((error: any) => {
        if (error?.response?.status === 401) {
          localStorage.removeItem('auth_token');
          router.push('/login');
        }
      })
      .finally(() => setReady(true));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push('/dashboard/search?q=' + encodeURIComponent(searchQuery.trim()));
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-sm font-medium text-slate-400">Loading...</div>
      </div>
    );
  }

  const userName = profile?.profile?.full_name || 'there';
  const searchSlot = (
    <form onSubmit={handleSearch} className="relative w-64 lg:w-80">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon.Search className="h-4 w-4" />
      </span>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search meetings, notes, or actions..."
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-violet-500/20"
      />
    </form>
  );

  return (
    <ProfileProvider value={profile}>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
        <Sidebar userName={userName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar userName={userName} search={searchSlot} />
          {children}
        </div>
      </div>
    </ProfileProvider>
  );
}
