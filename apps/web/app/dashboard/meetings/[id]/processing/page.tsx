'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { meetingsApi, type Meeting } from '@/lib/api';
import { Icon } from '@/components/dashboard';

type StageState = 'waiting' | 'active' | 'done';

export default function ProcessingPage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const friendlyFailure = (raw: string): string => {
    const t = (raw || '').toLowerCase();
    if (t.includes('credit') || t.includes('429') || t.includes('insufficient')) {
      return 'The AI service is out of credit, so notes can’t be generated yet. Add credit to the provider account and retry.';
    }
    if (t.includes('not found') && t.includes('audio')) {
      return 'No audio was found for this meeting. This can happen for meetings created from a link without a recording. Please record on this device and try again.';
    }
    if (t.includes('econnreset') || t.includes('connection error') || t.includes('network')) {
      return 'Could not reach the AI service. Please check the connection and retry.';
    }
    if (raw) return `Processing failed: ${raw}`;
    return 'Processing ran into an issue while generating notes. Your recording is safe.';
  };

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await meetingsApi.get(meetingId);
        if (cancelled) return;
        setMeeting(res.data);
        if (res.data.status === 'completed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => router.push(`/dashboard/meetings/${meetingId}`), 900);
        } else if (res.data.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setFailed(true);
          setErrorMsg(friendlyFailure((res.data.metadata as any)?.failureReason || ''));
        }
      } catch (err) {
        if (!cancelled) console.error('Failed to check processing status:', err);
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 2500);
    const clock = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(clock);
    };
  }, [meetingId]);

  const handleRetry = async () => {
    setFailed(false);
    setErrorMsg('');
    try {
      await meetingsApi.process(meetingId);
    } catch (err) {
      setFailed(true);
      setErrorMsg('Could not restart processing. Please try again.');
    }
  };

  // Stages are derived from the single meeting status the backend reports.
  // We never invent per-stage percentages — an indeterminate pulse is shown
  // while a stage is running.
  const hasAudio = !!meeting?.audio_url;
  const isDone = meeting?.status === 'completed';
  const uploadStage: StageState = hasAudio || isDone ? 'done' : 'active';
  const transcribeStage: StageState = isDone ? 'done' : failed ? 'waiting' : uploadStage === 'done' ? 'active' : 'waiting';
  const notesStage: StageState = isDone ? 'done' : 'waiting';

  const fmtElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
  };

  const fmtDuration = (seconds?: number) => {
    if (!seconds) return null;
    const m = Math.round(seconds / 60);
    return m < 1 ? '< 1 min' : `${m} min`;
  };

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recording lifecycle / Processing
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {failed ? 'Processing stopped' : 'Turning your recording into notes'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {meeting?.title || 'Your meeting'}
              {meeting ? ` · ${new Date(meeting.started_at || meeting.created_at).toLocaleDateString()}` : ''}
            </p>
          </div>
          <span
            className={
              failed
                ? 'inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300'
                : isDone
                ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                : 'inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
            }
          >
            {failed ? 'Needs a retry' : isDone ? 'Notes ready' : 'Transcription in progress'}
          </span>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                  <Icon.Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {failed ? 'Your recording is safe' : 'Your recording is in good hands'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {failed
                      ? errorMsg
                      : 'We’re identifying speakers and building your transcript, then drafting notes.'}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-1">
                <Stage
                  state={uploadStage}
                  title="Upload recording"
                  subtitle="Your audio is stored securely on the server."
                />
                <Stage
                  state={transcribeStage}
                  title="Transcribe & identify speakers"
                  subtitle="Converting the recording into a searchable transcript."
                />
                <Stage
                  state={notesStage}
                  title="Generate notes, decisions & actions"
                  subtitle="Summary, key decisions and suggested next steps come last."
                />
              </div>

              {!failed && !isDone && (
                <p className="mt-5 text-xs text-slate-400">
                  This has been running for {fmtElapsed(elapsed)}. Time varies with recording length and demand —
                  you can safely leave this page, processing continues in the background.
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                {failed ? (
                  <>
                    <button
                      onClick={handleRetry}
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
                    >
                      <Icon.Sparkles className="h-4 w-4" /> Retry processing
                    </button>
                    <Link
                      href={`/dashboard/meetings/${meetingId}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      View meeting
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/dashboard/meetings"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Back to meetings
                  </Link>
                )}
              </div>
            </div>

            {!failed && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  <Icon.Check className="h-4 w-4" /> You can safely leave this page
                </div>
                <p className="mt-1.5 text-sm text-emerald-700/90 dark:text-emerald-200/80">
                  Processing continues in the background. Find this recording in your library whenever you return.
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recording details</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <Detail label="Meeting" value={meeting?.title || '—'} />
                <Detail label="Date" value={meeting ? new Date(meeting.started_at || meeting.created_at).toLocaleString() : '—'} />
                <Detail label="Duration" value={meeting ? fmtDuration(meeting.duration_seconds) || 'Not yet recorded' : '—'} />
                <Detail label="Notes language" value={meeting?.output_language?.toUpperCase() || '—'} />
              </dl>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-500/30 dark:bg-violet-500/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
                <Icon.Check className="h-4 w-4" /> Private by default
              </div>
              <p className="mt-1.5 text-sm text-violet-700/90 dark:text-violet-200/80">
                Notes aren’t shared automatically. You’ll review the summary and choose who can access it.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Stage({ state, title, subtitle }: { state: StageState; title: string; subtitle: string }) {
  const ring =
    state === 'done'
      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'
      : state === 'active'
      ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300'
      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500';

  return (
    <div className="flex items-start gap-3 py-3">
      <span className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full ${ring}`}>
        {state === 'done' ? (
          <Icon.Check className="h-4 w-4" />
        ) : state === 'active' ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        ) : (
          <Icon.Clock className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
          <span
            className={
              state === 'done'
                ? 'text-xs font-semibold text-emerald-600 dark:text-emerald-400'
                : state === 'active'
                ? 'text-xs font-semibold text-violet-600 dark:text-violet-400'
                : 'text-xs font-medium text-slate-400'
            }
          >
            {state === 'done' ? 'Complete' : state === 'active' ? 'In progress' : 'Waiting'}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}
