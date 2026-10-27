'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

const TRANSLATION_LANGUAGES = [
  { code: 'sw', label: 'Swahili' },
  { code: 'lg', label: 'Luganda' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'ar', label: 'Arabic' },
];

export default function MeetingDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeTab, setActiveTab] = useState<'notes' | 'actions' | 'decisions' | 'risks' | 'followups' | 'transcript'>('notes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('business');
  const [copyNotification, setCopyNotification] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Player State
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Translation State
  const [selectedLang, setSelectedLang] = useState('sw');
  const [translating, setTranslating] = useState(false);
  const [translatedData, setTranslatedData] = useState<any | null>(null);

  // Email Share Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<any>(null);
  const [showGoogleMenu, setShowGoogleMenu] = useState(false);

  // Slack Share Modal State
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [slackStatus, setSlackStatus] = useState<any>(null);
  const [slackChannels, setSlackChannels] = useState<any[]>([]);
  const [selectedSlackChannel, setSelectedSlackChannel] = useState('');
  const [sendingSlack, setSendingSlack] = useState(false);
  const [slackSuccess, setSlackSuccess] = useState(false);
  const [slackError, setSlackError] = useState('');

  useEffect(() => {
    loadAllMeetingData();
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
      const res = await meetingsApi.update(params.id, {
        title: editTitle,
        meeting_type: editType,
      });
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
      setActionItems((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: nextStatus } : a))
      );
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
      alert(
        serverMsg ||
          'Translation failed. The AI service is unavailable right now \u2014 it may be out of credit or misconfigured.'
      );
    } finally {
      setTranslating(false);
    }
  };

  const handleSendEmailShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const emails = emailRecipients
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));

    if (emails.length === 0) {
      alert('Please enter at least one valid recipient email address.');
      return;
    }

    setSendingEmail(true);
    try {
      await meetingsApi.shareEmail(params.id, {
        recipients: emails,
        subject: emailSubject,
      });
      setEmailSuccess(true);
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailSuccess(false);
        setEmailRecipients('');
      }, 2000);
    } catch (err) {
      alert('Failed to send email notes.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSaveToDrive = async (format: 'doc' | 'pdf' = 'doc') => {
    try {
      const response = await integrationsApi.saveToDrive(params.id, format);
      if (response.data.webViewLink) {
        window.open(response.data.webViewLink, '_blank');
      }
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

    const emails = emailRecipients
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));

    if (emails.length === 0) {
      alert('Please enter at least one valid recipient email address.');
      return;
    }

    setSendingEmail(true);
    try {
      await integrationsApi.sendGmail(params.id, emails, emailSubject);
      setEmailSuccess(true);
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailSuccess(false);
        setEmailRecipients('');
      }, 2000);
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
      setTimeout(() => {
        setShowSlackModal(false);
        setSlackSuccess(false);
      }, 2000);
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
    if (meeting.meeting_type) {
      text += `Type: ${meeting.meeting_type.replace('_', ' ')}\n`;
    }
    if (meeting.duration_seconds) {
      text += `Duration: ${formatSeconds(meeting.duration_seconds)}\n`;
    }
    text += `\n`;

    if (summary?.executive_summary) {
      text += `## Executive Summary\n${summary.executive_summary}\n\n`;
    }
    if (summary?.summary) {
      text += `## Detailed Summary\n${summary.summary}\n\n`;
    }
    if (decisions.length > 0) {
      text += `## Key Decisions\n`;
      decisions.forEach((d) => {
        text += `- ${d.decision}\n`;
      });
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
    setTimeout(() => setCopyNotification(false), 2500);
  };

  const handleDownloadFile = (extension: 'md' | 'txt') => {
    const text = generateNotesContent();
    if (!text || !meeting) return;

    const safeTitle = (meeting.title || 'meeting-notes')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
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
  };

  const handlePrint = () => {
    window.open(`/api/meetings/${params.id}/export/html`, '_blank');
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this meeting?')) return;

    try {
      await meetingsApi.delete(params.id);
      router.push('/dashboard/meetings');
    } catch (err) {
      setError('Failed to delete meeting');
    }
  };

  const handleReprocess = async () => {
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
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatSeconds = (totalSeconds?: number) => {
    if (totalSeconds === undefined || totalSeconds === null) return '00:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-gray-600 font-medium">Loading meeting notes...</div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
        <div className="text-red-600 font-medium">{error || 'Meeting not found'}</div>
        <button
          onClick={() => router.push('/dashboard/meetings')}
          className="text-blue-600 hover:underline text-sm font-medium"
        >
          Return to Meetings
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950">
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/meetings')}
                className="text-gray-600 hover:text-gray-900 font-medium text-sm border px-3 py-1.5 rounded-lg"
              >
                Back to Meetings
              </button>
              <h1 className="text-lg font-semibold text-gray-900 truncate max-w-sm sm:max-w-md">
                {meeting.title}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyNotes}
                className="px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                {copyNotification ? 'Copied' : 'Copy Notes'}
              </button>

              <button
                onClick={() => setShowEmailModal(true)}
                className="px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Share by Email
              </button>

              <button
                onClick={() => {
                  if (!slackStatus?.connected) {
                    router.push('/dashboard/integrations');
                  } else {
                    setShowSlackModal(true);
                  }
                }}
                className="px-3 py-1.5 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow-2xs"
              >
                <span>#</span> Share to Slack
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowGoogleMenu(!showGoogleMenu)}
                  className="px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center gap-1"
                >
                  Google
                </button>

                {showGoogleMenu && (
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 text-sm">
                    {googleStatus?.canUseDrive ? (
                      <button
                        onClick={() => {
                          handleSaveToDrive('doc');
                          setShowGoogleMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                      >
                        Save to Drive (DOCX)
                      </button>
                    ) : (
                      <div className="px-4 py-2 text-gray-400 text-xs">
                        Drive not connected
                      </div>
                    )}
                    {googleStatus?.canUseGmail ? (
                      <button
                        onClick={() => {
                          setShowEmailModal(true);
                          setShowGoogleMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                      >
                        Send via Gmail
                      </button>
                    ) : (
                      <div className="px-4 py-2 text-gray-400 text-xs">
                        Gmail not connected
                      </div>
                    )}
                    {googleStatus?.canUseCalendar ? (
                      <button
                        onClick={() => {
                          alert('Calendar integration coming soon - you can create events from settings');
                          setShowGoogleMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                      >
                        Create Calendar Event
                      </button>
                    ) : (
                      <div className="px-4 py-2 text-gray-400 text-xs">
                        Calendar not connected
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center gap-1"
                >
                  Export
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 text-sm">
                    <button
                      onClick={() => {
                        handleDownloadFile('md');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                    >
                      Download Markdown (.md)
                    </button>
                    <button
                      onClick={() => {
                        handleDownloadFile('txt');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                    >
                      Download Text (.txt)
                    </button>
                    <button
                      onClick={() => {
                        const pdfUrl = exportsApi.downloadPDF(params.id);
                        window.open(pdfUrl, '_blank');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                    >
                      Download PDF
                    </button>
                    <button
                      onClick={() => {
                        const docxUrl = exportsApi.downloadDOCX(params.id);
                        window.open(docxUrl, '_blank');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                    >
                      Download DOCX
                    </button>
                    <button
                      onClick={() => {
                        handlePrint();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                    >
                      Printable Document (HTML)
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleDelete}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Delete Meeting"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Slack Share Modal */}
      {showSlackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="text-purple-600 font-extrabold text-lg">#</span> Share Notes to Slack
              </h2>
              <button
                onClick={() => {
                  setShowSlackModal(false);
                  setSlackError('');
                }}
                className="text-gray-400 hover:text-gray-600 text-sm font-medium"
              >
                ✕
              </button>
            </div>

            {slackSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-semibold text-center">
                ✓ Notes shared to Slack channel successfully!
              </div>
            ) : (
              <div className="space-y-4">
                {slackError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-medium">
                    {slackError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Slack Channel
                  </label>
                  <select
                    value={selectedSlackChannel}
                    onChange={(e) => setSelectedSlackChannel(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Default configured channel</option>
                    {slackChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name} {c.isPrivate ? '(Private)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-slate-500">
                  This will format the meeting executive summary, key points, and pending action items with direct links into your Slack channel.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSlackModal(false)}
                    className="px-4 py-2 border rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendToSlack}
                    disabled={sendingSlack}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 transition shadow-xs"
                  >
                    {sendingSlack ? 'Sending...' : 'Post to Slack'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Share Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-semibold text-gray-900">Share Meeting Notes</h2>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-medium"
              >
                Close
              </button>
            </div>

            {emailSuccess ? (
              <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-sm text-center">
                Meeting notes sent successfully.
              </div>
            ) : (
              <form onSubmit={handleSendEmailShare} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Recipient Emails (comma separated)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="sarah@company.com, john@company.com"
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-4 py-2 border rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  {googleStatus?.canUseGmail ? (
                    <button
                      type="button"
                      onClick={handleSendViaGmail}
                      disabled={sendingEmail}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {sendingEmail ? 'Sending...' : 'Send via Gmail'}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={sendingEmail}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {sendingEmail ? 'Sending...' : 'Send Notes'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Details Card */}
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between gap-4 border-b pb-6">
            <div className="space-y-2">
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-xl font-bold text-gray-900 border px-3 py-1.5 rounded-lg w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="text-sm border px-3 py-1.5 rounded-lg text-gray-700 focus:outline-none"
                    >
                      <option value="business">Business Meeting</option>
                      <option value="interview">Interview</option>
                      <option value="standup">Standup</option>
                      <option value="lecture">Lecture / Class</option>
                      <option value="general">General</option>
                    </select>
                    <button
                      onClick={handleSaveEdit}
                      className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="border text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">{meeting.title}</h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-gray-400 hover:text-blue-600 font-medium border px-2 py-0.5 rounded"
                  >
                    Edit
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
                  meeting.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : meeting.status === 'processing'
                    ? 'bg-amber-100 text-amber-800'
                    : meeting.status === 'recording'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {meeting.status}
                </span>
                <span className="text-gray-400">-</span>
                <span className="text-gray-600 font-medium capitalize">
                  {meeting.meeting_type || 'General'}
                </span>
                {meeting.detected_languages && meeting.detected_languages.length > 0 && (
                  <>
                    <span className="text-gray-400">-</span>
                    <span className="text-gray-600 font-medium">
                      {meeting.detected_languages.map((l: string) => l.toUpperCase()).join(', ')}
                    </span>
                  </>
                )}
                {meeting.output_language && meeting.output_language !== 'en' && (
                  <>
                    <span className="text-gray-400">-</span>
                    <span className="text-blue-600 font-medium">
                      Notes: {meeting.output_language.toUpperCase()}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {meeting.status === 'completed' ? (
                <button
                  onClick={() => router.push(`/dashboard/meetings/${meeting.id}/record`)}
                  className="bg-blue-600 text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Record Again
                </button>
              ) : meeting.status === 'processing' ? (
                <button
                  onClick={() => router.push(`/dashboard/meetings/${meeting.id}/processing`)}
                  className="bg-amber-600 text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-amber-700 transition"
                >
                  View Processing
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/meetings/${meeting.id}/record`)}
                    className="bg-red-600 text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-red-700 transition"
                  >
                    Start Recording
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-gray-300 text-gray-700 text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    Upload Audio
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 text-sm">
            <div>
              <div className="text-gray-500 text-xs">Date Recorded</div>
              <div className="font-medium text-gray-900 mt-1">{formatDate(meeting.created_at)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Duration</div>
              <div className="font-medium text-gray-900 mt-1">{formatSeconds(meeting.duration_seconds)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Type</div>
              <div className="font-medium text-gray-900 capitalize mt-1">{meeting.meeting_type || 'General'}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Notes Language</div>
              <div className="font-medium text-gray-900 uppercase mt-1">{meeting.output_language || 'EN'}</div>
            </div>
          </div>
        </div>

        {/* Audio Player Card if audio exists */}
        {meeting.audio_url && (
          <div className="bg-white border rounded-xl p-4 shadow-sm space-y-2">
            <audio
              ref={audioRef}
              src={meeting.audio_url}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
              onEnded={() => setIsPlaying(false)}
            />
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-semibold text-gray-900">Audio Recording Playback</span>
              <span>{formatSeconds(currentTime)} / {formatSeconds(audioDuration || meeting.duration_seconds)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlayPause}
                className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition w-8 h-8 flex items-center justify-center text-xs font-bold"
              >
                {isPlaying ? '||' : '>'}
              </button>
              <input
                type="range"
                min={0}
                max={audioDuration || meeting.duration_seconds || 100}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex items-center gap-1">
                {[1, 1.25, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      playbackRate === speed ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Audio Upload Panel - shown for draft / failed meetings */}
        {(meeting.status === 'draft' || meeting.status === 'failed') && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Upload Audio File</h2>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.webm"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />

            {uploading ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Uploading audio...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">Do not close this page while uploading.</p>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium text-gray-700 mb-1">Drag and drop audio here</p>
                <p className="text-xs text-gray-400">or click to browse - MP3, WAV, M4A, WebM, OGG up to 200 MB</p>
              </div>
            )}

            {uploadError && (
              <p className="text-red-600 text-xs mt-3">{uploadError}</p>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'notes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Notes & Summary
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'actions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Action Items ({actionItems.length})
          </button>
          <button
            onClick={() => setActiveTab('decisions')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'decisions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Decisions ({decisions.length})
          </button>
          <button
            onClick={() => setActiveTab('risks')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'risks'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Risks ({risks.length})
          </button>
          <button
            onClick={() => setActiveTab('followups')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'followups'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Follow-ups ({followUps.length})
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'transcript'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Transcript ({segments.length})
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            {/* Translation Action Bar */}
            <div className="bg-white border rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-gray-600">
                <span className="font-semibold text-gray-900">Multilingual Translation:</span> Translate notes into local or international languages.
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="text-xs border rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none"
                >
                  {TRANSLATION_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleTranslate}
                  disabled={translating}
                  className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {translating ? 'Translating...' : 'Translate Notes'}
                </button>
              </div>
            </div>

            {translatedData && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Translated Notes ({translatedData.targetLanguage.toUpperCase()})
                  </h4>
                  <button
                    onClick={() => setTranslatedData(null)}
                    className="text-xs text-amber-700 hover:text-amber-900 font-medium"
                  >
                    Hide
                  </button>
                </div>
                {translatedData.translatedExecutiveSummary && (
                  <p className="text-amber-950 text-sm font-medium italic border-b border-amber-200 pb-2">
                    {translatedData.translatedExecutiveSummary}
                  </p>
                )}
                <p className="text-amber-950 text-sm leading-relaxed whitespace-pre-line">
                  {translatedData.translatedSummary}
                </p>
              </div>
            )}

            {summary?.executive_summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
                  Executive Takeaway
                </h3>
                <p className="text-blue-950 font-medium text-sm leading-relaxed">
                  {summary.executive_summary}
                </p>
              </div>
            )}

            {(summary as any)?.sentiment && (
              <div className="flex items-center gap-2 bg-gray-50 border rounded-xl p-3 px-4 shadow-sm">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Overall Sentiment:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                  (summary as any).sentiment === 'positive'
                    ? 'bg-green-100 text-green-800'
                    : (summary as any).sentiment === 'negative'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-200 text-gray-800'
                }`}>
                  {(summary as any).sentiment}
                </span>
              </div>
            )}

            {(summary as any)?.key_points && (summary as any).key_points.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2 shadow-sm">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Key Points & Takeaways
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-amber-950">
                  {(summary as any).key_points.map((point: string, idx: number) => (
                    <li key={idx} className="leading-relaxed">{point}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Comprehensive Summary</h3>
              {summary?.summary ? (
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                  {summary.summary}
                </p>
              ) : (
                <div className="text-gray-500 text-sm py-4">
                  {meeting.status === 'processing'
                    ? 'Notes are being generated by the processing worker...'
                    : 'No summary generated yet. Click "Process Audio" above to analyze the meeting.'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Assigned Tasks</h3>
            {actionItems.length === 0 ? (
              <div className="text-gray-500 text-sm py-6 text-center">
                No action items detected for this meeting.
              </div>
            ) : (
              <div className="space-y-3">
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-4 border rounded-lg hover:border-gray-300 transition bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={item.status === 'completed'}
                      onChange={() => handleToggleActionStatus(item)}
                      className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${item.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {item.task}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                        {item.assignee && (
                          <span>Assignee: <strong className="font-medium text-gray-700">{item.assignee}</strong></span>
                        )}
                        {item.due_date && (
                          <span>Due: <strong className="font-medium text-gray-700">{new Date(item.due_date).toLocaleDateString()}</strong></span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded uppercase font-semibold tracking-wider ${
                      item.priority === 'high'
                        ? 'bg-red-100 text-red-700'
                        : item.priority === 'medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'decisions' && (
          <div className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Agreed Decisions</h3>
            {decisions.length === 0 ? (
              <div className="text-gray-500 text-sm py-6 text-center">
                No decisions recorded for this meeting.
              </div>
            ) : (
              <div className="space-y-3">
                {decisions.map((d) => (
                  <div key={d.id} className="p-4 border rounded-lg bg-gray-50 space-y-1">
                    <p className="text-sm font-semibold text-gray-900">{d.decision}</p>
                    {d.source_timestamp !== undefined && d.source_timestamp !== null && (
                      <span className="text-xs text-gray-500 font-mono">
                        Timestamp: {formatSeconds(d.source_timestamp)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Audio Transcript</h3>
            {segments.length === 0 ? (
              <div className="text-gray-500 text-sm py-6 text-center">
                No transcript segments available.
              </div>
            ) : (
              <div className="space-y-4">
                {segments.map((seg) => (
                  <div
                    key={seg.id || seg.segment_index}
                    onClick={() => handleSeek(seg.start_time)}
                    className="border-b pb-4 last:border-b-0 cursor-pointer hover:bg-blue-50/50 p-2 rounded transition"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span className="font-semibold text-blue-700">
                        {seg.speaker_name || seg.speaker_label || 'Speaker'}
                      </span>
                      <span className="font-mono text-blue-600 hover:underline">
                        {formatSeconds(seg.start_time)} - {formatSeconds(seg.end_time)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{seg.text}</p>
                    {seg.translated_text && (
                      <p className="text-sm text-gray-600 leading-relaxed mt-2 italic">
                        {seg.translated_text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}