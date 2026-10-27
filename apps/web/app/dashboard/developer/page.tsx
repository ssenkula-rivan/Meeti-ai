'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  apiKeysApi,
  webhooksApi,
  type ApiKeyItem,
  type WebhookItem,
  type WebhookDelivery,
} from '@/lib/api';

export default function DeveloperPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'docs'>('keys');
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New API Key Modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<string[]>(['read', 'write']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // New Webhook Modal
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDescription, setWebhookDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['meeting.completed']);
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  // Webhook Deliveries Modal
  const [showDeliveriesModal, setShowDeliveriesModal] = useState(false);
  const [activeWebhook, setActiveWebhook] = useState<WebhookItem | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [keysRes, webhooksRes] = await Promise.all([
        apiKeysApi.list().catch(() => ({ data: [] })),
        webhooksApi.list().catch(() => ({ data: [] })),
      ]);
      setApiKeys(keysRes.data || []);
      setWebhooks(webhooksRes.data || []);
    } catch (err: any) {
      console.error('Failed to load developer data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await apiKeysApi.create(keyName.trim(), keyScopes);
      setCreatedKey(res.data.apiKey);
      await loadData();
      setMessage({ type: 'success', text: 'API Key generated successfully! Store it securely.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to create API key' });
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Applications using it will lose access immediately.')) {
      return;
    }
    try {
      await apiKeysApi.revoke(id);
      setMessage({ type: 'success', text: 'API Key revoked' });
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to revoke API key' });
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    setCreatingWebhook(true);
    try {
      await webhooksApi.create(webhookUrl.trim(), selectedEvents, webhookDescription.trim() || undefined);
      setShowWebhookModal(false);
      setWebhookUrl('');
      setWebhookDescription('');
      setMessage({ type: 'success', text: 'Webhook registered successfully!' });
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to create webhook' });
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await webhooksApi.delete(id);
      setMessage({ type: 'success', text: 'Webhook deleted' });
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to delete webhook' });
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      const res = await webhooksApi.test(id);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Test ping sent! Receiver returned status ${res.data.status || 200}` });
      } else {
        setMessage({ type: 'error', text: `Test ping failed: ${res.data.error || 'Server error'}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to test webhook' });
    }
  };

  const handleViewDeliveries = async (webhook: WebhookItem) => {
    setActiveWebhook(webhook);
    setShowDeliveriesModal(true);
    setLoadingDeliveries(true);
    try {
      const res = await webhooksApi.getDeliveries(webhook.id);
      setDeliveries(res.data || []);
    } catch (err: any) {
      console.warn('Failed to load webhook deliveries:', err);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-blue-600 font-semibold tracking-wide uppercase">
              <span>Developer Platform</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">API & Webhooks</h1>
            <p className="text-slate-600 mt-1 max-w-2xl">
              Integrate Meeti into internal dashboards, trigger automated pipelines upon meeting completion, and access public endpoints.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'keys' && (
              <button
                onClick={() => {
                  setCreatedKey(null);
                  setKeyName('');
                  setShowKeyModal(true);
                }}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-xs transition flex items-center gap-2"
              >
                <span>+</span> Generate API Key
              </button>
            )}
            {activeTab === 'webhooks' && (
              <button
                onClick={() => setShowWebhookModal(true)}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-xs transition flex items-center gap-2"
              >
                <span>+</span> Add Webhook Endpoint
              </button>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between transition-all ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{message.type === 'success' ? '✓' : '⚠️'}</span>
              <p className="text-sm font-medium">{message.text}</p>
            </div>
            <button onClick={() => setMessage(null)} className="text-sm opacity-60 hover:opacity-100">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 mb-8 gap-8">
          <button
            onClick={() => setActiveTab('keys')}
            className={`pb-4 text-sm font-semibold transition ${
              activeTab === 'keys'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            API Keys ({apiKeys.length})
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`pb-4 text-sm font-semibold transition ${
              activeTab === 'webhooks'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Webhooks ({webhooks.length})
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`pb-4 text-sm font-semibold transition ${
              activeTab === 'docs'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Public API Quickstart & Docs
          </button>
        </div>

        {/* Tab: API Keys */}
        {activeTab === 'keys' && (
          <div>
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                Loading API keys...
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center mx-auto mb-3 text-xl">
                  🔑
                </div>
                <h3 className="text-base font-bold text-slate-900">No API Keys Generated</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                  Create an API key to access our REST endpoints from your scripts, backend services, or CI/CD pipelines.
                </p>
                <button
                  onClick={() => setShowKeyModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Generate Key
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-6">Name</th>
                      <th className="py-3.5 px-6">Key Prefix</th>
                      <th className="py-3.5 px-6">Scopes</th>
                      <th className="py-3.5 px-6">Created</th>
                      <th className="py-3.5 px-6">Last Used</th>
                      <th className="py-3.5 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {apiKeys.map((key) => (
                      <tr key={key.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-4 px-6 font-semibold text-slate-900">{key.name}</td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-600">
                          {key.key_prefix}...••••••••
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex gap-1.5 flex-wrap">
                            {key.scopes?.map((s) => (
                              <span key={s} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs">
                          {new Date(key.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs">
                          {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Webhooks */}
        {activeTab === 'webhooks' && (
          <div>
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                Loading webhooks...
              </div>
            ) : webhooks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center mx-auto mb-3 text-xl">
                  ⚡
                </div>
                <h3 className="text-base font-bold text-slate-900">No Webhook Endpoints Configured</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                  Subscribe your HTTP endpoints to receive real-time JSON payloads when meetings finish processing.
                </p>
                <button
                  onClick={() => setShowWebhookModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Add Webhook Endpoint
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {webhooks.map((wh) => (
                  <div key={wh.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-slate-900">{wh.url}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${wh.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                          {wh.active ? 'Active' : 'Inactive'}
                        </span>
                        {wh.failure_count > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                            {wh.failure_count} failures
                          </span>
                        )}
                      </div>
                      {wh.description && (
                        <p className="text-xs text-slate-500 mt-1">{wh.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-slate-400 font-medium">Events:</span>
                        {wh.events?.map((ev) => (
                          <span key={ev} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleViewDeliveries(wh)}
                        className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
                      >
                        Logs & History
                      </button>
                      <button
                        onClick={() => handleTestWebhook(wh.id)}
                        className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-blue-600 rounded-lg text-xs font-semibold transition"
                      >
                        Send Test Ping
                      </button>
                      <button
                        onClick={() => handleDeleteWebhook(wh.id)}
                        className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: API Docs */}
        {activeTab === 'docs' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs space-y-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Public API Quickstart (v1)</h2>
              <p className="text-sm text-slate-600 mt-1">
                Authenticate by passing your key in the <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">Authorization: Bearer &lt;YOUR_API_KEY&gt;</code> header.
              </p>
            </div>

            {/* List Meetings */}
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded text-xs font-bold font-mono">GET</span>
                <span className="font-mono text-sm font-semibold text-slate-800">/v1/meetings</span>
              </div>
              <p className="text-xs text-slate-600 mb-3">Retrieve list of meetings with summaries, status, and duration.</p>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto font-mono">
{`curl -X GET "http://localhost:3000/v1/meetings" \\
  -H "Authorization: Bearer mai_live_abc123..."`}
              </pre>
            </div>

            {/* Get Meeting Notes */}
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded text-xs font-bold font-mono">GET</span>
                <span className="font-mono text-sm font-semibold text-slate-800">/v1/meetings/:id/notes</span>
              </div>
              <p className="text-xs text-slate-600 mb-3">Get executive summary, key points, decisions, and action items in structured JSON.</p>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto font-mono">
{`curl -X GET "http://localhost:3000/v1/meetings/<MEETING_ID>/notes" \\
  -H "Authorization: Bearer mai_live_abc123..."`}
              </pre>
            </div>

            {/* Create Meeting */}
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded text-xs font-bold font-mono">POST</span>
                <span className="font-mono text-sm font-semibold text-slate-800">/v1/meetings</span>
              </div>
              <p className="text-xs text-slate-600 mb-3">Create and start or queue a new meeting recording programmatically.</p>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto font-mono">
{`curl -X POST "http://localhost:3000/v1/meetings" \\
  -H "Authorization: Bearer mai_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Quarterly Strategy Review",
    "meetingType": "business",
    "notesLanguage": "en"
  }'`}
              </pre>
            </div>
          </div>
        )}

        {/* Modal: Generate API Key */}
        {showKeyModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
              {!createdKey ? (
                <form onSubmit={handleCreateKey}>
                  <h3 className="text-lg font-bold text-slate-900">Generate New API Key</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Provide a descriptive label for your key and select permissions.
                  </p>

                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Key Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Zapier Integration, Production Worker"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Scopes</label>
                    <div className="space-y-2 text-xs text-slate-700">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={keyScopes.includes('read')}
                          onChange={(e) => {
                            if (e.target.checked) setKeyScopes([...keyScopes, 'read']);
                            else setKeyScopes(keyScopes.filter((s) => s !== 'read'));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span><strong>read</strong>: List & view meetings, summaries, action items</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={keyScopes.includes('write')}
                          onChange={(e) => {
                            if (e.target.checked) setKeyScopes([...keyScopes, 'write']);
                            else setKeyScopes(keyScopes.filter((s) => s !== 'write'));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span><strong>write</strong>: Create meetings, upload audio, update tasks</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowKeyModal(false)}
                      className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingKey}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                    >
                      {creatingKey ? 'Generating...' : 'Create Key'}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold mb-3">
                    ✓
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Your API Key is Ready</h3>
                  <p className="text-xs text-rose-600 font-medium mt-1 mb-3">
                    Copy this key now. For security purposes, you will not be able to view it again!
                  </p>

                  <div className="p-3 bg-slate-900 rounded-xl font-mono text-xs text-emerald-400 break-all select-all flex items-center justify-between gap-2 mb-4">
                    <span>{createdKey}</span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="flex-1 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
                    >
                      {copiedKey ? 'Copied to Clipboard!' : 'Copy Key'}
                    </button>
                    <button
                      onClick={() => {
                        setShowKeyModal(false);
                        setCreatedKey(null);
                      }}
                      className="py-2 px-4 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Add Webhook */}
        {showWebhookModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
              <form onSubmit={handleCreateWebhook}>
                <h3 className="text-lg font-bold text-slate-900">Add Webhook Endpoint</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  We will send a POST request with an HMAC signature header whenever selected events trigger.
                </p>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payload URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://api.yourdomain.com/webhooks/meeti"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Slack bot sync"
                    value={webhookDescription}
                    onChange={(e) => setWebhookDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-700 mb-2">Events to send</label>
                  <div className="space-y-2 text-xs text-slate-700">
                    {['meeting.completed', 'transcript.ready', 'action_item.created'].map((ev) => (
                      <label key={ev} className="flex items-center gap-2 cursor-pointer font-mono">
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(ev)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedEvents([...selectedEvents, ev]);
                            else setSelectedEvents(selectedEvents.filter((item) => item !== ev));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowWebhookModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingWebhook}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                  >
                    {creatingWebhook ? 'Registering...' : 'Register Endpoint'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Webhook Deliveries Log */}
        {showDeliveriesModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Webhook Delivery History</h3>
                  <p className="text-xs font-mono text-slate-500 truncate max-w-md">{activeWebhook?.url}</p>
                </div>
                <button
                  onClick={() => setShowDeliveriesModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingDeliveries ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Loading delivery logs...</p>
                ) : deliveries.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center italic">No deliveries recorded yet. Trigger a test ping!</p>
                ) : (
                  <div className="space-y-3">
                    {deliveries.map((d) => (
                      <div key={d.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                d.response_status && d.response_status < 400
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {d.response_status || 'ERR'}
                            </span>
                            <span className="font-mono font-semibold text-slate-800">{d.event_type}</span>
                          </div>
                          <span className="text-slate-400 text-[11px]">
                            {new Date(d.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        {d.response_body && (
                          <div className="mt-2 p-2 bg-slate-900 text-slate-200 rounded font-mono text-[11px] overflow-x-auto max-h-24">
                            {d.response_body}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
