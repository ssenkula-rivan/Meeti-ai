'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, oauthApi, type Profile } from '@/lib/api';
import { Icon, useDashboardProfile } from '@/components/dashboard';

/* Account settings — shared dashboard shell (the layout renders the sidebar and
   top bar, so this page only owns the <main> content). Every control here maps
   to a real endpoint: profile fields to authApi.updateProfile, the Google card
   to oauthApi, and account deletion to authApi.deleteAccount. We deliberately
   leave out things the backend can't back yet (photo upload, phone, MFA,
   sessions, retention), so nothing here is a dead button. */

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'sw', label: 'Swahili' },
  { value: 'lg', label: 'Luganda' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
];

const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'];

export default function SettingsPage() {
  const router = useRouter();
  const account = useDashboardProfile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [googleStatus, setGoogleStatus] = useState<any>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    country: '',
    timezone: '',
    preferredLanguage: 'en',
    outputLanguage: 'en',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
  });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadProfile();
    loadGoogleStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async () => {
    try {
      const response = await authApi.getProfile();
      const profileData = response.data.profile;
      setProfile(profileData);
      setFormData({
        fullName: profileData.full_name || '',
        country: profileData.country || '',
        timezone: profileData.timezone || '',
        preferredLanguage: profileData.preferred_language || 'en',
        outputLanguage: profileData.output_language || 'en',
        dateFormat: profileData.date_format || 'YYYY-MM-DD',
        timeFormat: profileData.time_format || '24h',
      });
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      if (error?.response?.status === 401) {
        localStorage.removeItem('auth_token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleStatus = async () => {
    try {
      setLoadingGoogle(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/integrations/google/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      if (response.ok) {
        setGoogleStatus(await response.json());
      }
    } catch (error) {
      console.error('Failed to load Google status:', error);
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleConnectGoogle = async (scopes: 'basic' | 'full') => {
    try {
      const response = await oauthApi.getGoogleUrl(scopes);
      if (response.data.authUrl) {
        window.location.href = response.data.authUrl;
      }
    } catch (error) {
      console.error('Failed to get Google OAuth URL:', error);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await oauthApi.disconnectGoogle();
      setGoogleStatus(null);
      loadGoogleStatus();
    } catch (error) {
      console.error('Failed to disconnect Google:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const apiData: any = {};
      if (formData.fullName) apiData.full_name = formData.fullName;
      if (formData.country) apiData.country = formData.country;
      if (formData.timezone) apiData.timezone = formData.timezone;
      if (formData.preferredLanguage) apiData.preferred_language = formData.preferredLanguage;
      if (formData.outputLanguage) apiData.output_language = formData.outputLanguage;
      if (formData.dateFormat) apiData.date_format = formData.dateFormat;
      if (formData.timeFormat) apiData.time_format = formData.timeFormat;

      await authApi.updateProfile(apiData);
      setMessage({ tone: 'info', text: 'Your profile has been saved.' });
      await loadProfile();
    } catch (error) {
      setMessage({ tone: 'error', text: 'We couldn’t save your profile. Please try again.' });
      console.error('Profile update error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('This permanently deletes your account, all meetings, recordings and notes. This cannot be undone. Continue?')) {
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await authApi.deleteAccount(deletePassword);
      localStorage.removeItem('auth_token');
      router.replace('/');
    } catch (error: any) {
      const status = error?.response?.status;
      setDeleteError(
        status === 401 ? 'Incorrect password. Please try again.' : 'Could not delete your account. Please try again.',
      );
      console.error('Account deletion failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-900 dark:text-white';
  const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200';
  const hintCls = 'mt-1 text-xs text-slate-400';

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center py-24">
        <div className="text-sm font-medium text-slate-400">Loading your settings…</div>
      </main>
    );
  }

  const email = account?.user?.email || '';

  return (
    <main className="flex-1 px-6 py-8">
      <div>
        <div className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
          Account &amp; preferences
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Your profile, your preferences
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your personal details and the way Meeti feels for you. These settings apply only to your account.
        </p>
      </div>

      {message && (
        <div
          className={`mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            message.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
          }`}
        >
          <Icon.Check className="h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Personal details</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your name and email appear on the notes you share.</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="fullName" className={labelCls}>Full name</label>
                <input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="email" className={labelCls}>Email</label>
                <input id="email" type="email" value={email} readOnly disabled className={`${inputCls} cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-slate-400`} />
                <p className={hintCls}>Your sign-in email can’t be changed here.</p>
              </div>
              <div>
                <label htmlFor="country" className={labelCls}>Country or region</label>
                <input
                  id="country"
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="e.g. Uganda"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="timezone" className={labelCls}>Timezone</label>
                <input
                  id="timezone"
                  type="text"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  placeholder="e.g. Africa/Kampala"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6 dark:border-white/10">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Language &amp; regional preferences</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The notes language is the default for newly generated notes.</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="preferredLanguage" className={labelCls}>Interface language</label>
                  <select
                    id="preferredLanguage"
                    value={formData.preferredLanguage}
                    onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
                    className={inputCls}
                  >
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="outputLanguage" className={labelCls}>Preferred notes language</label>
                  <select
                    id="outputLanguage"
                    value={formData.outputLanguage}
                    onChange={(e) => setFormData({ ...formData, outputLanguage: e.target.value })}
                    className={inputCls}
                  >
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="dateFormat" className={labelCls}>Date format</label>
                  <select
                    id="dateFormat"
                    value={formData.dateFormat}
                    onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value })}
                    className={inputCls}
                  >
                    {DATE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="timeFormat" className={labelCls}>Time format</label>
                  <select
                    id="timeFormat"
                    value={formData.timeFormat}
                    onChange={(e) => setFormData({ ...formData, timeFormat: e.target.value })}
                    className={inputCls}
                  >
                    <option value="24h">24-hour (14:30)</option>
                    <option value="12h">12-hour (2:30 PM)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-6 dark:border-white/10">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>

          {/* Connected accounts */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Connected accounts</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Connect Google so Meeti can save notes to Drive, send recaps through Gmail, and add events to Calendar.
            </p>

            <div className="mt-4">
              {loadingGoogle ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">Checking Google connection…</span>
                </div>
              ) : googleStatus?.connected ? (
                <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-lg font-bold text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">G</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Google account connected</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Access to {googleStatus.scopes?.length || 0} services</p>
                      </div>
                    </div>
                    <button onClick={handleDisconnectGoogle} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/20 dark:hover:bg-rose-500/10">
                      Disconnect
                    </button>
                  </div>
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-white/10">
                    {[
                      { ok: googleStatus.canUseDrive, label: 'Google Drive — save meeting notes' },
                      { ok: googleStatus.canUseGmail, label: 'Gmail — send notes via email' },
                      { ok: googleStatus.canUseCalendar, label: 'Google Calendar — create events & attach notes' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <span className={`h-2 w-2 rounded-full ${row.ok ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20'}`} />
                          {row.label}
                        </span>
                        {!row.ok && (
                          <button onClick={() => handleConnectGoogle('full')} className="text-xs font-semibold text-violet-600 hover:underline dark:text-violet-300">
                            Enable
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                  <p className="text-sm text-slate-600 dark:text-slate-300">Not connected yet.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleConnectGoogle('basic')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
                      Basic (profile only)
                    </button>
                    <button onClick={() => handleConnectGoogle('full')} className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-700">
                      Connect Google
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Danger zone */}
          <section className="rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-500/20 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-rose-600 dark:text-rose-400">Delete account</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Permanently deletes your account and all associated data — meetings, recordings, transcripts and notes. This cannot be undone.
            </p>
            <form onSubmit={handleDeleteAccount} className="mt-4 space-y-4">
              {deleteError && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{deleteError}</div>}
              <div className="max-w-sm">
                <label htmlFor="deletePassword" className={labelCls}>Confirm your password</label>
                <input
                  id="deletePassword"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Your current password"
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={deleting || deletePassword.length === 0}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete my account'}
              </button>
            </form>
          </section>
        </div>

        {/* Right rail */}
        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Your account</h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-base font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                {(formData.fullName || email || 'M').trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{formData.fullName || '—'}</p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{email}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Manage</h2>
            <div className="mt-3 space-y-3">
              <RailLink href="/dashboard/billing" title="Billing & plan" desc="View usage and manage your subscription." />
              <RailLink href="/security" title="Security" desc="How Meeti protects your data." />
              <RailLink href="/privacy" title="Privacy" desc="How your recordings and notes are handled." />
            </div>
          </div>

          <p className="px-1 text-xs text-slate-400">
            Photo, phone number, and multi-factor sign-in aren’t available yet, so they’re intentionally left off this page rather than shown as disabled.
          </p>
        </aside>
      </div>
    </main>
  );
}

function RailLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="group flex items-start justify-between gap-2">
      <span>
        <span className="block text-sm font-semibold text-slate-900 group-hover:text-violet-600 dark:text-white dark:group-hover:text-violet-300">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{desc}</span>
      </span>
      <Icon.Arrow className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-300" />
    </Link>
  );
}
