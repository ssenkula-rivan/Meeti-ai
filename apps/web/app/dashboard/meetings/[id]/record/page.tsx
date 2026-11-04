'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { meetingsApi } from '@/lib/api';
import { Icon } from '@/components/dashboard';

// Spoken-language options for transcription. "beta" marks languages our
// speech-to-text provider does not officially support, and "whisperCode" is
// only set for languages the provider reliably handles; beta languages fall
// back to automatic detection rather than forcing an unsupported code.
type LangOption = { code: string; label: string; beta?: boolean; whisperCode?: string };
const LANGUAGE_OPTIONS: LangOption[] = [
  { code: 'auto', label: 'Auto-detect (default)' },
  { code: 'en', label: 'English', whisperCode: 'english' },
  { code: 'sw', label: 'Swahili', whisperCode: 'swahili' },
  { code: 'lg', label: 'Luganda', beta: true },
  { code: 'nyn', label: 'Runyankole', beta: true },
  { code: 'cgg', label: 'Rukiga', beta: true },
  { code: 'teo', label: 'Ateso', beta: true },
  { code: 'luo', label: 'Luo', beta: true },
  { code: 'ach', label: 'Acholi', beta: true },
];

type Screen = 'consent' | 'recording' | 'review';

const svgProps = {
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default function RecordMeetingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [meeting, setMeeting] = useState<any>(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [screen, setScreen] = useState<Screen>('consent');
  const [loading, setLoading] = useState(true);
  const [consentGiven, setConsentGiven] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [reviewTitle, setReviewTitle] = useState('');
  const [showDiscard, setShowDiscard] = useState(false);
  const [isNewRecording, setIsNewRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    loadMeeting();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  };

  const loadMeeting = async () => {
    try {
      const res = await meetingsApi.get(params.id);
      setMeeting(res.data);
      setMeetingTitle(res.data.title || 'Meeting');
      setReviewTitle(res.data.title || '');
      const sl = (res.data as any).source_language;
      if (sl && LANGUAGE_OPTIONS.some((o) => o.code === sl)) setSourceLanguage(sl);
      setIsNewRecording(res.data.status === 'draft' && !res.data.audio_url);
      setLoading(false);
    } catch {
      setError('Failed to load meeting details');
      setLoading(false);
    }
  };

  const startRecording = async () => {
    setError('');
    try {
      // Persist the per-meeting consent before capture so the server can
      // enforce it (only active when the recording-consent flag is on).
      await meetingsApi.confirmConsent(params.id);
    } catch {
      setError('Could not record your consent. Please try again.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser.fftSize = 64;
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateLevel);
          }
        };
        updateLevel();
      } catch (audioErr) {
        console.warn('Audio level monitoring not available:', audioErr);
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach((t) => t.stop());
        const b = new Blob(chunksRef.current, { type: mimeType });
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(b);
        blobUrlRef.current = url;
        setBlob(b);
        setBlobUrl(url);
        setScreen('review');
      };

      mediaRecorder.start(1000);
      setScreen('recording');
      setPaused(false);

      await meetingsApi.start(params.id);

      timerRef.current = setInterval(() => setDuration((prev) => prev + 1), 1000);
    } catch {
      setError('Microphone access was blocked. Allow microphone permission in your browser, then try again.');
    }
  };

  const pauseRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === 'recording') {
      rec.pause();
      setPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
      setAudioLevel(0);
    }
  };

  const resumeRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === 'paused') {
      rec.resume();
      setPaused(false);
      timerRef.current = setInterval(() => setDuration((prev) => prev + 1), 1000);
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setAudioLevel(0);
      setPaused(false);
    }
  };

  const saveAndProcess = async () => {
    if (!blob) return;
    setUploading(true);
    setError('');
    try {
      if (reviewTitle.trim() && reviewTitle.trim() !== meetingTitle) {
        await meetingsApi.update(params.id, { title: reviewTitle.trim() } as any);
      }
      const formData = new FormData();
      formData.append('audio', blob, 'meeting-audio.webm');
      formData.append('chunkIndex', '0');
      const chosen = LANGUAGE_OPTIONS.find((o) => o.code === sourceLanguage);
      formData.append('language', chosen?.whisperCode || 'auto');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '';
      const response = await fetch(`${apiUrl}/upload/meeting/${params.id}/chunk/direct`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        let detail = '';
        try {
          const body = await response.json();
          detail = body?.error || body?.message || '';
        } catch {}
        throw new Error(detail || `Upload failed (HTTP ${response.status})`);
      }

      await meetingsApi.stop(params.id);
      router.push(`/dashboard/meetings/${params.id}/processing`);
    } catch (err: any) {
      setUploading(false);
      setError(`Upload failed: ${err?.message || 'unknown error'}. Your recording is still on this device — try saving again.`);
    }
  };

  const downloadOriginal = () => {
    if (!blob || !blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${(reviewTitle || meetingTitle || 'meeting').replace(/[^\w-]+/g, '_')}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const confirmDiscard = async () => {
    setShowDiscard(false);
    if (isNewRecording) {
      try {
        await meetingsApi.delete(params.id);
      } catch {}
      router.push('/dashboard/meetings');
    } else {
      router.push(`/dashboard/meetings/${params.id}`);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const minutesLabel = Math.max(1, Math.round(duration / 60));

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recording lifecycle
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {screen === 'consent'
                ? 'Before you start recording'
                : screen === 'recording'
                ? meetingTitle
                : 'Your recording has stopped'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {meeting ? new Date(meeting.started_at || meeting.created_at).toLocaleDateString() : ''}
              {screen === 'review' ? ' · Nothing is saved to your library yet' : ''}
            </p>
          </div>
          <StatusPill screen={screen} paused={paused} uploading={uploading} duration={duration} />
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            {screen === 'consent' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                    <ShieldIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Make sure everyone is comfortable.
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Recording is a shared responsibility. Let everyone know what you’ll capture before you begin.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <Responsibility
                    title="Tell every participant"
                    body="Explain that audio will be recorded and used to generate AI notes."
                  />
                  <Responsibility
                    title="Get permission before you capture"
                    body="Obtain consent from everyone, including anyone who joins later. Follow applicable laws and your organization’s policies."
                  />
                  <Responsibility
                    title="Respect a change of mind"
                    body="Pause or stop if someone withdraws consent. Review the recording before sharing a recap."
                  />
                </div>

                <div className="mt-6">
                  <label htmlFor="sourceLanguage" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Spoken language
                  </label>
                  <select
                    id="sourceLanguage"
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {LANGUAGE_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>{o.label}{o.beta ? ' — Beta' : ''}</option>
                    ))}
                  </select>
                  {LANGUAGE_OPTIONS.find((o) => o.code === sourceLanguage)?.beta && (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      <strong>Beta language.</strong> Accuracy may be limited and it falls back to automatic
                      detection. Always review the transcript before relying on it.
                    </div>
                  )}
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm dark:border-violet-500/30 dark:bg-violet-500/10">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      I confirm everyone here has been told and agrees to be recorded.
                    </span>
                    <br />
                    I’m responsible for consent and for how this recording is used and shared.
                  </span>
                </label>

                <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
                  <button
                    onClick={() => router.back()}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel · return without recording
                  </button>
                  <button
                    onClick={startRecording}
                    disabled={!consentGiven}
                    className="ml-auto inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon.Play className="h-4 w-4" /> Continue &amp; start recording
                  </button>
                </div>
              </div>
            )}

            {screen === 'recording' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        paused
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300'
                          : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300'
                      }`}
                    >
                      {paused ? <PauseIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {paused ? 'Recording paused' : 'Recording in progress'}
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {paused ? 'Capture is off. Paused time is not counted.' : 'Audio is being captured on this device.'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatDuration(duration)}
                    </div>
                    <div className="text-xs text-slate-400">Captured time</div>
                  </div>
                </div>

                <div className="mt-6 flex h-16 items-center justify-center gap-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  {paused ? (
                    <span className="text-sm text-slate-400">Microphone muted — capture paused</span>
                  ) : (
                    [0.4, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 1.0, 0.7, 0.4, 0.6, 0.9].map((m, idx) => (
                      <span
                        key={idx}
                        className="w-1.5 rounded-full bg-violet-500 transition-all duration-75"
                        style={{ height: `${Math.max(6, Math.min(48, Math.round(audioLevel * m * 0.48)))}px` }}
                      />
                    ))
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {paused ? (
                    <button
                      onClick={resumeRecording}
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
                    >
                      <Icon.Play className="h-4 w-4" /> Resume recording
                    </button>
                  ) : (
                    <button
                      onClick={pauseRecording}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <PauseIcon className="h-4 w-4" /> Pause recording
                    </button>
                  )}
                  <button
                    onClick={stopRecording}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    <StopIcon className="h-4 w-4" /> Stop &amp; review
                  </button>
                </div>
              </div>
            )}

            {screen === 'review' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Save recording</h2>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                      <Icon.Play className="h-5 w-5" />
                    </span>
                    <div className="text-sm">
                      <p className="font-medium text-slate-900 dark:text-white">Audio recording</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {formatDuration(duration)} captured{blob ? ` · ${(blob.size / 1048576).toFixed(1)} MB` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    Not saved yet
                  </span>
                </div>

                {blobUrl && (
                  <audio src={blobUrl} controls className="mt-4 w-full" />
                )}

                <div className="mt-5 space-y-5">
                  <div>
                    <label htmlFor="reviewTitle" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Recording title
                    </label>
                    <input
                      id="reviewTitle"
                      type="text"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      placeholder="Add a title"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="reviewLang" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Spoken language
                    </label>
                    <select
                      id="reviewLang"
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                      {LANGUAGE_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>{o.label}{o.beta ? ' — Beta' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Saving uploads this recording and starts transcription and AI notes. Keep this tab open until the
                    upload finishes.
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
                  <button
                    onClick={() => setShowDiscard(true)}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <TrashIcon className="h-4 w-4" /> Discard recording
                  </button>
                  <button
                    onClick={saveAndProcess}
                    disabled={uploading || !blob}
                    className="ml-auto inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Icon.Sparkles className="h-4 w-4" /> Save &amp; process recording
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {screen === 'review' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium text-slate-900 dark:text-white">Not ready to process?</p>
                    <p className="text-slate-500 dark:text-slate-400">Download the original to keep a local copy before deciding.</p>
                  </div>
                  <button
                    onClick={downloadOriginal}
                    disabled={!blob}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <DownloadIcon className="h-4 w-4" /> Download original
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {screen !== 'review' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">This meeting</h2>
                <dl className="mt-3 space-y-3 text-sm">
                  <DetailRow label="Title" value={meetingTitle || '—'} />
                  <DetailRow label="Date" value={meeting ? new Date(meeting.started_at || meeting.created_at).toLocaleDateString() : '—'} />
                  <DetailRow label="Capture" value="Audio, on this device" />
                </dl>
              </div>
            )}

            {screen === 'review' && blob && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recording details</h2>
                <dl className="mt-3 space-y-3 text-sm">
                  <DetailRow label="Duration" value={formatDuration(duration)} />
                  <DetailRow label="Size" value={`${(blob.size / 1048576).toFixed(1)} MB`} />
                  <DetailRow label="Format" value="WebM audio" />
                  <DetailRow label="Spoken" value={LANGUAGE_OPTIONS.find((o) => o.code === sourceLanguage)?.label || 'Auto-detect'} />
                </dl>
              </div>
            )}

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-500/30 dark:bg-violet-500/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
                <LockIcon className="h-4 w-4" /> Private by default
              </div>
              <p className="mt-1.5 text-sm text-violet-700/90 dark:text-violet-200/80">
                {screen === 'review'
                  ? 'Saving doesn’t share anything. Review the notes before you send a recap.'
                  : 'Only you can access this recording. Nothing is sent automatically.'}
              </p>
            </div>
          </aside>
        </div>
      </div>

      {showDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300">
                <TrashIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Discard this recording?
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  You’ll lose about {minutesLabel} of captured audio. It isn’t saved anywhere yet, so this can’t be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              Download the original first if you might want this conversation later.
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDiscard(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Keep recording
              </button>
              <button
                onClick={confirmDiscard}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <TrashIcon className="h-4 w-4" /> Discard permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatusPill({
  screen,
  paused,
  uploading,
  duration,
}: {
  screen: Screen;
  paused: boolean;
  uploading: boolean;
  duration: number;
}) {
  if (uploading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
        Saving…
      </span>
    );
  }
  if (screen === 'recording') {
    return paused ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
        <PauseIcon className="h-3.5 w-3.5" /> Paused · Not capturing
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Capturing · {formatClock(duration)}
      </span>
    );
  }
  if (screen === 'review') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Stopped · {formatClock(duration)} captured
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      Not recording
    </span>
  );
}

function formatClock(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function Responsibility({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
        <Icon.Check className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{body}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

const MicIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} {...svgProps}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" />
  </svg>
);
const PauseIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const StopIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
const TrashIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} {...svgProps}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);
const DownloadIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} {...svgProps}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);
const ShieldIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} {...svgProps}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const LockIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} {...svgProps}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
