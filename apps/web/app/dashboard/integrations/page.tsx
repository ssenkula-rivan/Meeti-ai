'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  integrationsApi,
  oauthApi,
  slackApi,
  zoomApi,
} from '@/lib/api';

export default function IntegrationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [googleStatus, setGoogleStatus] = useState<any>(null);
  const [slackStatus, setSlackStatus] = useState<any>(null);
  const [zoomStatus, setZoomStatus] = useState<any>(null);
  const [slackChannels, setSlackChannels] = useState<any[]>([]);
  const [zoomRecordings, setZoomRecordings] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [notifyOnActionItems, setNotifyOnActionItems] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testingSlack, setTestingSlack] = useState(false);
  const [importingZoomId, setImportingZoomId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadAllIntegrations();
  }, []);

  const loadAllIntegrations = async () => {
    setLoading(true);
    try {
      const [gRes, sRes, zRes] = await Promise.all([
        integrationsApi.getGoogleStatus().catch(() => ({ data: { connected: false } })),
        slackApi.getStatus().catch(() => ({ data: { connected: false } })),
        zoomApi.getStatus().catch(() => ({ data: { connected: false } })),
      ]);

      setGoogleStatus(gRes.data);
      setSlackStatus(sRes.data);
      setZoomStatus(zRes.data);

      const sData: any = sRes.data;
      if (sData?.connected) {
        setSelectedChannel(sData.defaultChannelId || '');
        setNotifyOnComplete(sData.notifyOnComplete ?? true);
        setNotifyOnActionItems(sData.notifyOnActionItems ?? true);
        try {
          const channelsRes = await slackApi.listChannels();
          setSlackChannels(channelsRes.data || []);
        } catch (e) {
          console.warn('Failed to load Slack channels:', e);
        }
      }

      if (zRes.data?.connected) {
        try {
          const recRes = await zoomApi.listRecordings();
          setZoomRecordings(recRes.data || []);
        } catch (e) {
          console.warn('Failed to load Zoom recordings:', e);
        }
      }
    } catch (err: any) {
      console.error('Failed to load integration states:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async (scopes: 'basic' | 'full') => {
    try {
      const res = await oauthApi.getGoogleUrl(scopes);
      if (res.data.authUrl) {
        window.location.href = res.data.authUrl;
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: 'Failed to initiate Google authentication' });
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await oauthApi.disconnectGoogle();
      setActionMessage({ type: 'success', text: 'Google disconnected' });
      loadAllIntegrations();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: 'Failed to disconnect Google' });
    }
  };

  const handleConnectSlack = () => {
    const slackClientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
    if (!slackClientId) {
      setActionMessage({ type: 'error', text: 'Slack is not configured on this server yet, so it cannot be connected.' });
      return;
    }
    const redirectUri = `${window.location.origin}/dashboard/integrations`;
    const scopes = 'channels:read,chat:write,incoming-webhook';
    window.location.href = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}`;
  };

  const handleDisconnectSlack = async () => {
    try {
      await slackApi.disconnect();
      setActionMessage({ type: 'success', text: 'Slack disconnected' });
      loadAllIntegrations();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: 'Failed to disconnect Slack' });
    }
  };

  const handleSaveSlackSettings = async () => {
    try {
      await slackApi.updateSettings({
        defaultChannelId: selectedChannel,
        notifyOnComplete,
        notifyOnActionItems,
      });
      setActionMessage({ type: 'success', text: 'Slack notification settings saved' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: 'Failed to update Slack settings' });
    }
  };

  const handleTestSlack = async () => {
    setTestingSlack(true);
    setActionMessage(null);
    try {
      await slackApi.sendReminders(selectedChannel || undefined);
      setActionMessage({ type: 'success', text: 'Test reminder notification sent to Slack successfully!' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to send test notification' });
    } finally {
      setTestingSlack(false);
    }
  };

  const handleConnectZoom = async () => {
    try {
      const res = await zoomApi.getAuthUrl(window.location.href);
      if (!res.data?.url) {
        setActionMessage({ type: 'error', text: 'Zoom is not configured on this server yet, so it cannot be connected.' });
        return;
      }
      window.location.href = res.data.url;
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.error || 'Failed to start the Zoom connection.' });
    }
  };

  const handleDisconnectZoom = async () => {
    try {
      await zoomApi.disconnect();
      setActionMessage({ type: 'success', text: 'Zoom disconnected' });
      loadAllIntegrations();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: 'Failed to disconnect Zoom' });
    }
  };

  const handleImportZoomMeeting = async (recording: any) => {
    setImportingZoomId(recording.id);
    try {
      const res = await zoomApi.importRecording({
        recordingId: recording.id,
        topic: recording.topic,
        duration: recording.duration,
        downloadUrl: recording.download_url,
      });
      setActionMessage({
        type: 'success',
        text: `Imported "${recording.topic}"! Meeting queued for transcription and AI notes.`,
      });
      setTimeout(() => {
        router.push(`/dashboard/meetings/${res.data.meetingId}`);
      }, 1500);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to import Zoom recording' });
    } finally {
      setImportingZoomId(null);
    }
  };

  return (
    <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-blue-600 font-semibold tracking-wide uppercase">
            <span>Ecosystem & Sync</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Integrations Hub</h1>
          <p className="text-slate-600 mt-1 max-w-2xl">
            Seamlessly connect your communication tools, calendars, cloud storage, and video conferencing to automate notes and action item delivery.
          </p>
        </div>

        {actionMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between transition-all ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{actionMessage.type === 'success' ? '✓' : '⚠️'}</span>
              <p className="text-sm font-medium">{actionMessage.text}</p>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-sm opacity-60 hover:opacity-100">
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3" />
            <p className="font-medium">Loading connected services...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Google Integration Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
                    G
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      googleStatus?.connected
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {googleStatus?.connected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900">Google Workspace</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Sync meeting notes directly into Google Drive (DOCX/PDF), send meeting recaps through Gmail, and attach notes to Calendar events.
                </p>

                <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-600 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${googleStatus?.canUseDrive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      Google Drive sync
                    </span>
                    <span className={googleStatus?.canUseDrive ? 'text-emerald-700' : 'text-slate-400'}>
                      {googleStatus?.canUseDrive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-600 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${googleStatus?.canUseGmail ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      Gmail follow-ups
                    </span>
                    <span className={googleStatus?.canUseGmail ? 'text-emerald-700' : 'text-slate-400'}>
                      {googleStatus?.canUseGmail ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-600 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${googleStatus?.canUseCalendar ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      Google Calendar attach
                    </span>
                    <span className={googleStatus?.canUseCalendar ? 'text-emerald-700' : 'text-slate-400'}>
                      {googleStatus?.canUseCalendar ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50/60 border-t border-slate-100">
                {googleStatus?.connected ? (
                  <button
                    onClick={handleDisconnectGoogle}
                    className="w-full py-2.5 px-4 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold transition"
                  >
                    Disconnect Google
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnectGoogle('full')}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition"
                  >
                    Connect Google Account
                  </button>
                )}
              </div>
            </div>

            {/* Slack Integration Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-2xl font-bold text-purple-600">
                    #
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      slackStatus?.connected
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {slackStatus?.connected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900">Slack Workspace</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Send AI executive summaries and action items into dedicated Slack channels when meetings finish.
                </p>

                {slackStatus?.connected && (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    <div className="text-xs text-slate-600">
                      Connected workspace: <strong className="text-slate-900">{slackStatus.teamName || 'Your Workspace'}</strong>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Default Notification Channel
                      </label>
                      <select
                        value={selectedChannel}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a channel...</option>
                        {slackChannels.map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.name} {c.isPrivate ? '(Private)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifyOnComplete}
                          onChange={(e) => setNotifyOnComplete(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        Post summary automatically when meeting ends
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifyOnActionItems}
                          onChange={(e) => setNotifyOnActionItems(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        Post action item reminders to channel
                      </label>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSaveSlackSettings}
                        className="flex-1 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
                      >
                        Save Settings
                      </button>
                      <button
                        onClick={handleTestSlack}
                        disabled={testingSlack}
                        className="py-1.5 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition"
                      >
                        {testingSlack ? 'Sending...' : 'Test Send'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50/60 border-t border-slate-100">
                {slackStatus?.connected ? (
                  <button
                    onClick={handleDisconnectSlack}
                    className="w-full py-2.5 px-4 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold transition"
                  >
                    Disconnect Slack
                  </button>
                ) : (
                  <button
                    onClick={handleConnectSlack}
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-xs transition"
                  >
                    Connect Slack Workspace
                  </button>
                )}
              </div>
            </div>

            {/* Zoom Integration Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-2xl font-bold text-sky-600">
                    Z
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      zoomStatus?.connected
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {zoomStatus?.connected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900">Zoom Cloud Recordings</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Import Zoom cloud recordings automatically, transcribe multi-speaker audio, and extract decisions.
                </p>

                {zoomStatus?.connected && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs font-medium text-slate-700 mb-2">Available Cloud Recordings ({zoomRecordings.length})</p>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {zoomRecordings.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No cloud recordings found.</p>
                      ) : (
                        zoomRecordings.map((rec) => (
                          <div key={rec.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-semibold text-slate-900 truncate max-w-[160px]">{rec.topic}</p>
                              <p className="text-slate-500 text-[11px]">{rec.duration} mins</p>
                            </div>
                            <button
                              onClick={() => handleImportZoomMeeting(rec)}
                              disabled={importingZoomId === rec.id}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-[11px] font-semibold transition"
                            >
                              {importingZoomId === rec.id ? 'Importing...' : 'Import'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50/60 border-t border-slate-100">
                {zoomStatus?.connected ? (
                  <button
                    onClick={handleDisconnectZoom}
                    className="w-full py-2.5 px-4 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold transition"
                  >
                    Disconnect Zoom
                  </button>
                ) : (
                  <button
                    onClick={handleConnectZoom}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold shadow-xs transition"
                  >
                    Connect Zoom Account
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
