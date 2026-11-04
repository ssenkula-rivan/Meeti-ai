'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  meetingsApi,
  actionItemsApi,
  transcriptsApi,
  integrationsApi,
  slackApi,
  exportsApi,
  type Meeting,
  type ActionItem,
  type MeetingSummary,
  type MeetingDecision,
  type TranscriptSegment,
} from '@/lib/api';
import { Icon } from '@/components/dashboard';

/* Meeting detail — matches the Meeti design. Rendered inside the shared
   dashboard shell (Sidebar + TopBar), so this page owns only the content:
   a header with Export/Share, a two-column body (tabs + right rail) and the
   working modals. Tabs are limited to what the API actually returns (summary,
   transcript, actions, decisions, risks, follow-ups) — the design's Questions /
   Files / Activity tabs have no backing endpoint, so we do not fake them. */

const TRANSLATION_LANGUAGES = [
  { code: 'sw', label: 'Swahili' },
  { code: 'lg', label: 'Luganda' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'ar', label: 'Arabic' },
];

type TabKey = 'notes' | 'actions' | 'decisions' | 'risks' | 'followups' | 'transcript';

export default function MeetingDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('notes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('business');
  const [copyNotification, setCopyNotification] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Translation state
  const [selectedLang, setSelectedLang] = useState('sw');
  const [translating, setTranslating] = useState(false);
  const [translatedData, setTranslatedData] = useState<any | null>(null);

  // Email share modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<any>(null);

  // Slack share modal state
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [slackStatus, setSlackStatus] = useState<any>(null);
  const [slackChannels, setSlackChannels] = useState<any[]>([]);
  const [selectedSlackChannel, setSelectedSlackChannel] = useState('');
  const [sendingSlack, setSendingSlack] = useState(false);
  const [slackSuccess, setSlackSuccess] = useState(false);
  const [slackError, setSlackError] = useState('');

  useEffect(() => {
    loadAllMeetingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const loadAllMeetingData = async () => {
    try {
      setLoading(true);
      const [
        meetingRes,
        summaryRes,
        decisionsRes,
        risksRes,
        followUpsRes,
        actionsRes,
        segmentsRes,
        googleStatusRes,
        slackStatusRes,
      ] = await Promise.all([
        meetingsApi.get(params.id),
        meetingsApi.getSummary(params.id).catch(() => ({ data: {} })),
        meetingsApi.getDecisions(params.id).catch(() => ({ data: [] })),
        meetingsApi.getRisks(params.id).catch(() => ({ data: [] })),
        meetingsApi.getFollowUps(params.id).catch(() => ({ data: [] })),
        actionItemsApi.getByMeeting(params.id).catch(() => ({ data: [] })),
        transcriptsApi.getSegments(params.id).catch(() => ({ data: [] })),
        integrationsApi.getGoogleStatus().catch(() => ({ data: { connected: false } })),
        slackApi.getStatus().catch(() => ({ data: { connected: false } })),
      ]);

      setMeeting(meetingRes.data);
      setEditTitle(meetingRes.data.title || '');
      setEditType(meetingRes.data.meeting_type || 'business');
      setSummary(summaryRes.data || null);
      setDecisions(decisionsRes.data || []);
      setRisks(risksRes.data || []);
      setFollowUps(followUpsRes.data || []);
      setActionItems(actionsRes.data || []);
      setSegments(segmentsRes.data || []);
      setGoogleStatus(googleStatusRes.data);
      const sData: any = slackStatusRes.data;
      setSlackStatus(sData);
      if (sData?.connected) {
        setSelectedSlackChannel(sData.defaultChannelId || '');
        slackApi.listChannels().then((res) => setSlackChannels(res.data || [])).catch(() => {});
      }
      setEmailSubject(`Meeting Notes: ${meetingRes.data.title}`);
    } catch (err: any) {
      setError('Failed to load meeting information');
      console.error('Error loading meeting data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    try {
      const res = await meetingsApi.update(params.id, { title: editTitle, meeting_type: editType });
      setMeeting(res.data);
      setIsEditing(false);
    } catch (err) {
      alert('Failed to update meeting details');
    }
  };

  const handleToggleActionStatus = async (item: ActionItem) => {
    const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
    try {
      await actionItemsApi.updateStatus(item.id, nextStatus);
      setActionItems((prev) => prev.map((a) => (a.id === item.id ? { ...a, status: nextStatus } : a)));
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const res = await meetingsApi.translate(params.id, selectedLang, {
        translateSegments: true,
        translateDecisions: true,
        translateActionItems: true,
      });
      setTranslatedData(res.data as any);
    } catch (err: any) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
      alert(serverMsg || 'Translation failed. The AI service is unavailable right now — it may be out of credit or misconfigured.');
    } finally {
      setTranslating(false);
    }
  };

  const handleSendEmailShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const emails = emailRecipients.split(/[\s,;]+/).map((x) => x.trim()).filter((x) => x.includes('@'));
    if (emails.length === 0) {
      alert('Please enter at least one valid recipient email address.');
      return;
    }
    setSendingEmail(true);
    try {
      await meetingsApi.shareEmail(params.id, { recipients: emails, subject: emailSubject });
      setEmailSuccess(true);
      setTimeout(() => { setShowEmailModal(false); setEmailSuccess(false); setEmailRecipients(''); }, 2000);
    } catch (err) {
      alert('Failed to send email notes.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSaveToDrive = async (format: 'doc' | 'pdf' = 'doc') => {
    setShowShareMenu(false);
    try {
      const response = await integrationsApi.saveToDrive(params.id, format);
      if (response.data.webViewLink) window.open(response.data.webViewLink, '_blank');
      alert('Meeting notes saved to Google Drive successfully!');
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Failed to save to Google Drive. Please ensure you have connected your Google account with Drive access.';
      alert(errorMsg);
    }
  };

  const handleSendViaGmail = async () => {
    if (!emailRecipients) {
      alert('Please enter recipient email addresses first.');
      return;
    }
    const emails = emailRecipients.split(/[\s,;]+/).map((x) => x.trim()).filter((x) => x.includes('@'));
    if (emails.length === 0) {
      alert('Please enter at least one valid recipient email address.');
      return;
    }
    setSendingEmail(true);
    try {
      await integrationsApi.sendGmail(params.id, emails, emailSubject);
      setEmailSuccess(true);
      setTimeout(() => { setShowEmailModal(false); setEmailSuccess(false); setEmailRecipients(''); }, 2000);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Failed to send via Gmail. Please ensure you have connected your Google account with Gmail access.';
      alert(errorMsg);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendToSlack = async () => {
    setSendingSlack(true);
    setSlackError('');
    try {
      await slackApi.sendMeetingNotes(params.id, selectedSlackChannel || undefined);
      setSlackSuccess(true);
      setTimeout(() => { setShowSlackModal(false); setSlackSuccess(false); }, 2000);
    } catch (err: any) {
      setSlackError(err?.response?.data?.message || 'Failed to send notes to Slack');
    } finally {
      setSendingSlack(false);
    }
  };

  const generateNotesContent = () => {
    if (!meeting) return '';
    let text = `# ${meeting.title}\n`;
    text += `Date: ${formatDate(meeting.created_at)}\n`;
    text += `Status: ${meeting.status}\n`;
    if (meeting.meeting_type) text += `Type: ${meeting.meeting_type.replace('_', ' ')}\n`;
    if (meeting.duration_seconds) text += `Duration: ${formatSeconds(meeting.duration_seconds)}\n`;
    text += `\n`;
    if (summary?.executive_summary) text += `## Executive Summary\n${summary.executive_summary}\n\n`;
    if (summary?.summary) text += `## Detailed Summary\n${summary.summary}\n\n`;
    if (decisions.length > 0) {
      text += `## Key Decisions\n`;
      decisions.forEach((d) => { text += `- ${d.decision}\n`; });
      text += `\n`;
    }
    if (actionItems.length > 0) {
      text += `## Action Items\n`;
      actionItems.forEach((a) => {
        const statusMark = a.status === 'completed' ? '[x]' : '[ ]';
        const assignee = a.assignee ? ` (${a.assignee})` : '';
        const due = a.due_date ? ` - Due: ${new Date(a.due_date).toLocaleDateString()}` : '';
        text += `${statusMark} ${a.task}${assignee}${due}\n`;
      });
      text += `\n`;
    }
    if (segments.length > 0) {
      text += `## Transcript\n`;
      segments.forEach((s) => {
        const time = formatSeconds(s.start_time);
        text += `[${time}] ${s.speaker_name || s.speaker_label || 'Speaker'}: ${s.text}\n`;
      });
    }
    return text;
  };

  const handleCopyNotes = () => {
    const text = generateNotesContent();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyNotification(true);
    setShowMoreMenu(false);
    setTimeout(() => setCopyNotification(false), 2500);
  };

  const handleDownloadFile = (extension: 'md' | 'txt') => {
    const text = generateNotesContent();
    if (!text || !meeting) return;
    const safeTitle = (meeting.title || 'meeting-notes').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const filename = `${safeTitle || 'meeting-notes'}.${extension}`;
    const mimeType = extension === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    setShowExportMenu(false);
    window.open(`/api/meetings/${params.id}/export/html`, '_blank');
  };

  const handleDelete = async () => {
    setShowMoreMenu(false);
    if (!confirm('Are you sure you want to permanently delete this meeting?')) return;
    try {
      await meetingsApi.delete(params.id);
      router.push('/dashboard/meetings');
    } catch (err) {
      setError('Failed to delete meeting');
    }
  };

  const handleReprocess = async () => {
    setShowMoreMenu(false);
    try {
      await meetingsApi.process(params.id);
      router.push(`/dashboard/meetings/${params.id}/processing`);
    } catch (err) {
      alert('Failed to start processing');
    }
  };

  const handleAudioUpload = async (file: File) => {
    const allowed = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'audio/m4a', 'video/webm'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const extAllowed = ['webm', 'mp4', 'mp3', 'ogg', 'wav', 'm4a'];
    if (!allowed.includes(file.type) && !extAllowed.includes(ext || '')) {
      setUploadError('Unsupported file type. Please upload .mp3, .wav, .m4a, .webm, or .ogg');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 200 MB.');
      return;
    }
    setUploading(true);
    setUploadError('');
    setUploadProgress(0);
    try {
      await meetingsApi.uploadAudio(params.id, file, (pct) => setUploadProgress(pct));
      await meetingsApi.stop(params.id);
      router.push(`/dashboard/meetings/${params.id}/processing`);
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleAudioUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAudioUpload(file);
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
      else { audioRef.current.play(); setIsPlaying(true); }
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (audioRef.current) audioRef.current.playbackRate = speed;
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const formatSeconds = (totalSeconds?: number) => {
    if (totalSeconds === undefined || totalSeconds === null) return '00:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="text-sm font-medium text-slate-400">Loading meeting notes...</div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
        <div className="text-sm font-medium text-red-600 dark:text-red-400">{error || 'Meeting not found'}</div>
        <Link href="/dashboard/meetings" className="text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300">
          Return to meetings
        </Link>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'notes', label: 'Summary' },
    { key: 'transcript', label: 'Transcript', count: segments.length },
    { key: 'actions', label: 'Actions', count: actionItems.length },
    { key: 'decisions', label: 'Decisions', count: decisions.length },
    { key: 'risks', label: 'Risks', count: risks.length },
    { key: 'followups', label: 'Follow-ups', count: followUps.length },
  ];

  const metaLine = [
    formatDate(meeting.created_at),
    new Date(meeting.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    meeting.duration_seconds ? `${Math.round(meeting.duration_seconds / 60)} min` : null,
    (meeting.meeting_type || 'General').replace('_', ' '),
  ].filter(Boolean).join(' · ');

  const pendingActions = actionItems.filter((a) => a.status !== 'completed');

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Eyebrow */}
        <div className="flex items-center justify-between text-xs font-medium text-slate-400">
          <span className="uppercase tracking-wide">Meeting detail</span>
          <span>Private by default</span>
        </div>

        {/* Header */}
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full max-w-xl rounded-lg border border-slate-300 px-3 py-1.5 text-xl font-bold text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:outline-none dark:border-white/15 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="business">Business Meeting</option>
                    <option value="interview">Interview</option>
                    <option value="standup">Standup</option>
                    <option value="lecture">Lecture / Class</option>
                    <option value="general">General</option>
                  </select>
                  <button onClick={handleSaveEdit} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">Save</button>
                  <button onClick={() => setIsEditing(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{meeting.title}</h1>
                <button
                  onClick={() => setIsEditing(true)}
                  className="shrink-0 rounded-md border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-400 transition hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:hover:text-violet-300"
                >
                  Edit
                </button>
              </div>
            )}
            <p className="mt-1 text-sm capitalize text-slate-500 dark:text-slate-400">{metaLine}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold ${
                meeting.status === 'completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                : meeting.status === 'processing' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
                : meeting.status === 'recording' ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300'
                : meeting.status === 'failed' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
              }`}>{meeting.status}</span>
              {meeting.detected_languages && meeting.detected_languages.length > 0 && (
                <span className="font-medium uppercase text-slate-500 dark:text-slate-400">{meeting.detected_languages.map((l) => l.toUpperCase()).join(', ')}</span>
              )}
              {meeting.output_language && meeting.output_language !== 'en' && (
                <span className="font-medium uppercase text-violet-600 dark:text-violet-300">Notes: {meeting.output_language}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                title="More actions"
                aria-label="More actions"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-slate-900">
                  <button onClick={handleCopyNotes} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">{copyNotification ? 'Copied' : 'Copy notes'}</button>
                  {meeting.status === 'completed' && (
                    <button onClick={() => { setShowMoreMenu(false); router.push(`/dashboard/meetings/${meeting.id}/record`); }} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Record again</button>
                  )}
                  {(meeting.status === 'draft' || meeting.status === 'failed') && (
                    <>
                      <button onClick={() => { setShowMoreMenu(false); router.push(`/dashboard/meetings/${meeting.id}/record`); }} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Start recording</button>
                      <button onClick={() => fileInputRef.current?.click()} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Upload audio</button>
                    </>
                  )}
                  {meeting.status === 'processing' && (
                    <button onClick={() => { setShowMoreMenu(false); router.push(`/dashboard/meetings/${meeting.id}/processing`); }} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">View processing</button>
                  )}
                  <button onClick={handleReprocess} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Reprocess</button>
                  <button onClick={handleDelete} className="block w-full px-4 py-2 text-left font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">Delete meeting</button>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
              >
                <Icon.Upload className="h-4 w-4 text-slate-400" /> Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-slate-900">
                  <button onClick={() => handleDownloadFile('md')} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Download Markdown (.md)</button>
                  <button onClick={() => handleDownloadFile('txt')} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Download Text (.txt)</button>
                  <button onClick={() => { setShowExportMenu(false); window.open(exportsApi.downloadPDF(params.id), '_blank'); }} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Download PDF</button>
                  <button onClick={() => { setShowExportMenu(false); window.open(exportsApi.downloadDOCX(params.id), '_blank'); }} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Download DOCX</button>
                  <button onClick={handlePrint} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Printable document (HTML)</button>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowShareMenu((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                <Icon.Link className="h-4 w-4" /> Share
              </button>
              {showShareMenu && (
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-slate-900">
                  <button onClick={() => { setShowShareMenu(false); setShowEmailModal(true); }} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Share by email</button>
                  <button
                    onClick={() => { setShowShareMenu(false); if (!slackStatus?.connected) router.push('/dashboard/integrations'); else setShowSlackModal(true); }}
                    className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    Share to Slack {!slackStatus?.connected && <span className="text-xs text-slate-400">(connect first)</span>}
                  </button>
                  {googleStatus?.canUseDrive ? (
                    <button onClick={() => handleSaveToDrive('doc')} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Save to Google Drive</button>
                  ) : (
                    <div className="px-4 py-2 text-xs text-slate-400">Google Drive not connected</div>
                  )}
                  {googleStatus?.canUseGmail ? (
                    <button onClick={() => { setShowShareMenu(false); setShowEmailModal(true); }} className="block w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">Send via Gmail</button>
                  ) : (
                    <div className="px-4 py-2 text-xs text-slate-400">Gmail not connected</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body: tabs + right rail */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {/* Audio player (real) */}
            {meeting.audio_url && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <audio
                  ref={audioRef}
                  src={meeting.audio_url}
                  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
                  onEnded={() => setIsPlaying(false)}
                />
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">Recording playback</span>
                  <span>{formatSeconds(currentTime)} / {formatSeconds(audioDuration || meeting.duration_seconds)}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <button onClick={togglePlayPause} className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-700">
                    {isPlaying ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                    ) : (
                      <Icon.Play className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={audioDuration || meeting.duration_seconds || 100}
                    value={currentTime}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-violet-600 dark:bg-white/10"
                  />
                  <div className="flex items-center gap-1">
                    {[1, 1.25, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`rounded px-1.5 py-0.5 font-mono text-xs ${playbackRate === speed ? 'bg-violet-100 font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Upload panel for draft / failed */}
            {(meeting.status === 'draft' || meeting.status === 'failed') && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Upload audio file</h2>
                <input ref={fileInputRef} type="file" accept="audio/*,.webm" style={{ display: 'none' }} onChange={handleFileInput} />
                {uploading ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>Uploading audio...</span><span>{uploadProgress}%</span></div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-2 rounded-full bg-violet-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                    <p className="text-xs text-slate-400">Do not close this page while uploading.</p>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`mt-4 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${dragOver ? 'border-violet-400 bg-violet-50/50 dark:bg-violet-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'}`}
                  >
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Drag and drop audio here</p>
                    <p className="mt-1 text-xs text-slate-400">or click to browse — MP3, WAV, M4A, WebM, OGG up to 200 MB</p>
                  </div>
                )}
                {uploadError && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{uploadError}</p>}
              </section>
            )}

            {/* Tabs */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-white/10">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                      activeTab === t.key ? 'border-violet-600 text-violet-700 dark:border-violet-400 dark:text-violet-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                    {t.count !== undefined && <span className="ml-1.5 text-xs font-medium opacity-60">{t.count}</span>}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                {activeTab === 'notes' && (
                  <div className="space-y-5">
                    {/* Translation bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="text-xs text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-900 dark:text-white">Translate notes</span> into another language.</div>
                      <div className="flex items-center gap-2">
                        <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none dark:border-white/15 dark:bg-slate-900 dark:text-slate-200">
                          {TRANSLATION_LANGUAGES.map((l) => (<option key={l.code} value={l.code}>{l.label}</option>))}
                        </select>
                        <button onClick={handleTranslate} disabled={translating} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{translating ? 'Translating...' : 'Translate'}</button>
                      </div>
                    </div>

                    {translatedData && (
                      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">Translated notes ({translatedData.targetLanguage?.toUpperCase()})</h4>
                          <button onClick={() => setTranslatedData(null)} className="text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300">Hide</button>
                        </div>
                        {translatedData.translatedExecutiveSummary && <p className="border-b border-amber-200 pb-2 text-sm font-medium italic text-amber-950 dark:border-amber-500/20 dark:text-amber-100">{translatedData.translatedExecutiveSummary}</p>}
                        <p className="whitespace-pre-line text-sm text-amber-950 dark:text-amber-100">{translatedData.translatedSummary}</p>
                      </div>
                    )}

                    {summary?.executive_summary && (
                      <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-500/20 dark:bg-violet-500/10">
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-900 dark:text-violet-200">Executive takeaway</h3>
                        <p className="text-sm font-medium leading-relaxed text-violet-950 dark:text-violet-100">{summary.executive_summary}</p>
                      </div>
                    )}

                    {(summary as any)?.sentiment && (
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overall sentiment:</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          (summary as any).sentiment === 'positive' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : (summary as any).sentiment === 'negative' ? 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                        }`}>{(summary as any).sentiment}</span>
                      </div>
                    )}

                    {(summary as any)?.key_points && (summary as any).key_points.length > 0 && (
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Key points</h4>
                        <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                          {(summary as any).key_points.map((point: string, idx: number) => (<li key={idx} className="leading-relaxed">{point}</li>))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">Comprehensive summary</h3>
                      {summary?.summary ? (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-200">{summary.summary}</p>
                      ) : (
                        <p className="py-4 text-sm text-slate-500 dark:text-slate-400">
                          {meeting.status === 'processing' ? 'Notes are being generated by the processing worker...' : 'No summary generated yet. Upload or record audio to analyze this meeting.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'transcript' && (
                  <div className="space-y-4">
                    {segments.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No transcript segments available.</p>
                    ) : (
                      segments.map((seg) => (
                        <div key={seg.id || seg.segment_index} onClick={() => handleSeek(seg.start_time)} className="cursor-pointer rounded-lg p-2 transition hover:bg-violet-50/50 dark:hover:bg-violet-500/10">
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-violet-700 dark:text-violet-300">{seg.speaker_name || seg.speaker_label || 'Speaker'}</span>
                            <span className="font-mono text-violet-600 dark:text-violet-300">{formatSeconds(seg.start_time)} – {formatSeconds(seg.end_time)}</span>
                          </div>
                          <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-100">{seg.text}</p>
                          {seg.translated_text && <p className="mt-2 text-sm italic leading-relaxed text-slate-600 dark:text-slate-300">{seg.translated_text}</p>}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'actions' && (
                  <div className="space-y-3">
                    {actionItems.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No action items detected for this meeting.</p>
                    ) : (
                      actionItems.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 dark:border-white/10">
                          <input type="checkbox" checked={item.status === 'completed'} onChange={() => handleToggleActionStatus(item)} className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${item.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>{item.task}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                              {item.assignee && <span>Assignee: <strong className="font-medium text-slate-700 dark:text-slate-200">{item.assignee}</strong></span>}
                              {item.due_date && <span>Due: <strong className="font-medium text-slate-700 dark:text-slate-200">{new Date(item.due_date).toLocaleDateString()}</strong></span>}
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                            item.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                            : item.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                          }`}>{item.priority}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'decisions' && (
                  <div className="space-y-3">
                    {decisions.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No decisions recorded for this meeting.</p>
                    ) : (
                      decisions.map((d) => (
                        <div key={d.id} className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{d.decision}</p>
                          {d.source_timestamp !== undefined && d.source_timestamp !== null && (
                            <button onClick={() => handleSeek(d.source_timestamp!)} className="font-mono text-xs text-violet-600 hover:underline dark:text-violet-300">Jump to {formatSeconds(d.source_timestamp)}</button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'risks' && (
                  <div className="space-y-3">
                    {risks.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No risks flagged for this meeting.</p>
                    ) : (
                      risks.map((r, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                          {typeof r === 'string' ? r : (r.risk || r.text || JSON.stringify(r))}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'followups' && (
                  <div className="space-y-3">
                    {followUps.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No follow-ups recorded for this meeting.</p>
                    ) : (
                      followUps.map((f, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                          {typeof f === 'string' ? f : (f.followup || f.text || JSON.stringify(f))}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right rail */}
          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Details</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><dt className="text-slate-500 dark:text-slate-400">Date</dt><dd className="font-medium text-slate-900 dark:text-white">{formatDate(meeting.created_at)}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-slate-500 dark:text-slate-400">Duration</dt><dd className="font-medium text-slate-900 dark:text-white">{formatSeconds(meeting.duration_seconds)}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-slate-500 dark:text-slate-400">Type</dt><dd className="font-medium capitalize text-slate-900 dark:text-white">{(meeting.meeting_type || 'General').replace('_', ' ')}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-slate-500 dark:text-slate-400">Notes language</dt><dd className="font-medium uppercase text-slate-900 dark:text-white">{meeting.output_language || 'en'}</dd></div>
              </dl>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <Icon.Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                <span>Only you have access. No recap has been sent. Use Share to invite others.</span>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Next steps</h2>
                <span className="text-xs font-medium text-slate-400">{pendingActions.length} open</span>
              </div>
              <div className="mt-4 space-y-3">
                {pendingActions.length === 0 ? (
                  <p className="text-sm text-slate-400">No open action items.</p>
                ) : (
                  pendingActions.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 dark:border-white/20" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{item.task}</p>
                        <p className="text-xs text-slate-400">{[item.assignee, item.due_date ? `Due ${new Date(item.due_date).toLocaleDateString()}` : null].filter(Boolean).join(' · ') || 'Unassigned'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {pendingActions.length > 0 && (
                <button onClick={() => setActiveTab('actions')} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300">
                  View all actions <Icon.Arrow className="h-4 w-4" />
                </button>
              )}
            </section>
          </aside>
        </div>

        <p className="mt-6 text-xs text-slate-400">AI-generated notes — verify names, decisions and suggested owners against the recording.</p>
      </div>

      {/* Slack modal */}
      {showSlackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/10">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">Share notes to Slack</h2>
              <button onClick={() => { setShowSlackModal(false); setSlackError(''); }} className="text-sm font-medium text-slate-400 hover:text-slate-600">Close</button>
            </div>
            {slackSuccess ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">Notes shared to Slack successfully!</div>
            ) : (
              <div className="space-y-4">
                {slackError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{slackError}</div>}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">Select Slack channel</label>
                  <select value={selectedSlackChannel} onChange={(e) => setSelectedSlackChannel(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-white/15 dark:bg-slate-900 dark:text-white">
                    <option value="">Default configured channel</option>
                    {slackChannels.map((c) => (<option key={c.id} value={c.id}>#{c.name} {c.isPrivate ? '(Private)' : ''}</option>))}
                  </select>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">This posts the executive summary, key points and pending action items with links into your Slack channel.</p>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowSlackModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5">Cancel</button>
                  <button onClick={handleSendToSlack} disabled={sendingSlack} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{sendingSlack ? 'Sending...' : 'Post to Slack'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/10">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Share meeting notes</h2>
              <button onClick={() => setShowEmailModal(false)} className="text-sm font-medium text-slate-400 hover:text-slate-600">Close</button>
            </div>
            {emailSuccess ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">Meeting notes sent successfully.</div>
            ) : (
              <form onSubmit={handleSendEmailShare} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">Recipient emails (comma separated)</label>
                  <input type="text" required placeholder="sarah@company.com, john@company.com" value={emailRecipients} onChange={(e) => setEmailRecipients(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-white/15 dark:bg-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">Subject line</label>
                  <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-white/15 dark:bg-slate-900 dark:text-white" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowEmailModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5">Cancel</button>
                  {googleStatus?.canUseGmail ? (
                    <button type="button" onClick={handleSendViaGmail} disabled={sendingEmail} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{sendingEmail ? 'Sending...' : 'Send via Gmail'}</button>
                  ) : (
                    <button type="submit" disabled={sendingEmail} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{sendingEmail ? 'Sending...' : 'Send notes'}</button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
