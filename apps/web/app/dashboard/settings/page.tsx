'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, oauthApi, type Profile } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
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
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setGoogleStatus(data);
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
    setMessage('');

    try {
      // Convert camelCase to snake_case for API
      const apiData: any = {};
      if (formData.fullName) apiData.full_name = formData.fullName;
      if (formData.country) apiData.country = formData.country;
      if (formData.timezone) apiData.timezone = formData.timezone;
      if (formData.preferredLanguage) apiData.preferred_language = formData.preferredLanguage;
      if (formData.outputLanguage) apiData.output_language = formData.outputLanguage;
      if (formData.dateFormat) apiData.date_format = formData.dateFormat;
      if (formData.timeFormat) apiData.time_format = formData.timeFormat;

      await authApi.updateProfile(apiData);
      setMessage('Profile updated successfully');
      await loadProfile();
    } catch (error) {
      setMessage('Failed to update profile');
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
        status === 401
          ? 'Incorrect password. Please try again.'
          : 'Could not delete your account. Please try again.'
      );
      console.error('Account deletion failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/dashboard" className="text-xl font-bold text-gray-900 tracking-tight">
              Meeti
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
                Home
              </Link>
              <Link href="/dashboard/meetings" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
                Meetings
              </Link>
              <Link href="/dashboard/tasks" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
                Tasks
              </Link>
              <Link href="/dashboard/search" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
                Search
              </Link>
              <Link href="/dashboard/settings" className="text-sm font-semibold text-blue-600 transition">
                Settings
              </Link>
              <button
                onClick={() => {
                  localStorage.removeItem('auth_token');
                  router.push('/login');
                }}
                className="text-sm font-medium text-gray-500 hover:text-red-600 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-gray-600">Manage your account preferences</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded ${
            message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
              Country
            </label>
            <input
              id="country"
              type="text"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Uganda"
            />
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <input
              id="timezone"
              type="text"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Africa/Kampala"
            />
          </div>

          <div>
            <label htmlFor="preferredLanguage" className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Language
            </label>
            <select
              id="preferredLanguage"
              value={formData.preferredLanguage}
              onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="sw">Swahili</option>
              <option value="lg">Luganda</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </div>

          <div>
            <label htmlFor="outputLanguage" className="block text-sm font-medium text-gray-700 mb-2">
              Notes Language
            </label>
            <select
              id="outputLanguage"
              value={formData.outputLanguage}
              onChange={(e) => setFormData({ ...formData, outputLanguage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="sw">Swahili</option>
              <option value="lg">Luganda</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </div>

          <div>
            <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-700 mb-2">
              Date Format
            </label>
            <select
              id="dateFormat"
              value={formData.dateFormat}
              onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </div>

          <div>
            <label htmlFor="timeFormat" className="block text-sm font-medium text-gray-700 mb-2">
              Time Format
            </label>
            <select
              id="timeFormat"
              value={formData.timeFormat}
              onChange={(e) => setFormData({ ...formData, timeFormat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="24h">24-hour (14:30)</option>
              <option value="12h">12-hour (2:30 PM)</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Google Integrations Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Google Integrations</h2>
          <p className="text-gray-600 mb-6">Connect your Google account to enable Drive, Gmail, and Calendar features</p>

          {loadingGoogle ? (
            <div className="bg-white border rounded-lg p-6 text-center text-gray-600">
              Loading integration status...
            </div>
          ) : googleStatus?.connected ? (
            <div className="bg-white border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Google Account Connected</h3>
                  <p className="text-sm text-gray-600">Connected with access to: {googleStatus.scopes?.length || 0} services</p>
                </div>
                <button
                  onClick={handleDisconnectGoogle}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 text-sm"
                >
                  Disconnect
                </button>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${googleStatus.canUseDrive ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-sm">Google Drive - Save meeting notes</span>
                  </div>
                  {!googleStatus.canUseDrive && (
                    <button
                      onClick={() => handleConnectGoogle('full')}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Enable
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${googleStatus.canUseGmail ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-sm">Gmail - Send meeting notes via email</span>
                  </div>
                  {!googleStatus.canUseGmail && (
                    <button
                      onClick={() => handleConnectGoogle('full')}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Enable
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${googleStatus.canUseCalendar ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-sm">Google Calendar - Create events & attach notes</span>
                  </div>
                  {!googleStatus.canUseCalendar && (
                    <button
                      onClick={() => handleConnectGoogle('full')}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Connect Google Account</h3>
                  <p className="text-sm text-gray-600">Enable Drive, Gmail, and Calendar integrations</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleConnectGoogle('basic')}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
                >
                  Basic (Profile only)
                </button>
                <button
                  onClick={() => handleConnectGoogle('full')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Full Access (Drive, Gmail, Calendar)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-2 text-red-600">Danger Zone</h2>
          <p className="text-gray-600 mb-4">
            Permanently delete your account and all associated data (meetings, recordings,
            transcripts and notes). This cannot be undone.
          </p>
          <form onSubmit={handleDeleteAccount} className="bg-white border border-red-200 rounded-lg p-6 space-y-4">
            {deleteError && (
              <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{deleteError}</div>
            )}
            <div>
              <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm your password
              </label>
              <input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Your current password"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={deleting || deletePassword.length === 0}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete my account'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}