'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { meetingsApi } from '@/lib/api';

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

export default function RecordMeetingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [meetingTitle, setMeetingTitle] = useState('');
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('auto');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    loadMeeting();
    return () => {
      cleanup();
    };
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
  };

  const loadMeeting = async () => {
    try {
      const res = await meetingsApi.get(params.id);
      setMeetingTitle(res.data.title || 'Meeting');
      setLoading(false);
    } catch (err: any) {
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
    } catch (err) {
      setError('Could not record your consent. Please try again.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Setup audio analyzer for visual feedback
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
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
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
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await uploadRecording(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000);
      setRecording(true);
      setPaused(false);

      await meetingsApi.start(params.id);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError('Microphone access denied. Please grant microphone permission in your browser.');
      console.error('Recording initialization error:', err);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
      setAudioLevel(0);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setPaused(false);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setUploading(true);
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setAudioLevel(0);
    }
  };

  const uploadRecording = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'meeting-audio.webm');
      formData.append('chunkIndex', '0');

      // Send the Whisper-supported code for the chosen language; beta/auto
      // languages fall back to 'auto' so we never force an unsupported code.
      const chosen = LANGUAGE_OPTIONS.find((o) => o.code === sourceLanguage);
      formData.append('language', chosen?.whisperCode || 'auto');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '';

      const response = await fetch(`${apiUrl}/upload/meeting/${params.id}/chunk/direct`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let detail = '';
        try {
          const body = await response.json();
          detail = body?.error || body?.message || '';
        } catch (_) {}
        throw new Error(detail || `Upload failed (HTTP ${response.status})`);
      }

      await meetingsApi.stop(params.id);
      router.push(`/dashboard/meetings/${params.id}/processing`);
    } catch (err: any) {
      setUploading(false);
      setError(`Recording upload failed: ${err?.message || 'unknown error'}. Please try saving again.`);
      console.error('Upload error:', err);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-gray-600 font-medium">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button
              onClick={() => router.back()}
              className="text-gray-700 hover:text-gray-900 font-medium"
            >
              Back
            </button>
            <h1 className="text-xl font-semibold text-gray-900 truncate max-w-md">
              {meetingTitle}
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white border rounded-xl p-8 text-center shadow-sm space-y-8">
          <div>
            <div className="text-6xl font-mono font-bold text-gray-900 mb-2">
              {formatDuration(duration)}
            </div>
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              {uploading
                ? 'Uploading audio...'
                : recording
                ? paused
                  ? 'Recording paused'
                  : 'Live recording in progress'
                : 'Ready to capture audio'}
            </div>
          </div>

          {/* Audio input level visualizer */}
          {recording && !paused && (
            <div className="flex items-center justify-center gap-1.5 h-12">
              {[0.4, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 1.0, 0.7, 0.4].map((multiplier, idx) => {
                const height = Math.max(6, Math.min(48, Math.round(audioLevel * multiplier * 0.48)));
                return (
                  <div
                    key={idx}
                    className="w-1.5 bg-blue-600 rounded-full transition-all duration-75"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>
          )}

          {!recording && !uploading && (
            <div className="space-y-6 text-left">
              <div>
                <label htmlFor="sourceLanguage" className="block text-sm font-medium text-gray-700 mb-2">
                  Spoken language
                </label>
                <select
                  id="sourceLanguage"
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                      {o.beta ? ' \u2014 Beta' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Choosing a language beats auto-detection. If you are unsure, leave it on Auto-detect.
                </p>
              </div>

              {LANGUAGE_OPTIONS.find((o) => o.code === sourceLanguage)?.beta && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <strong>Beta language.</strong> Our speech-to-text provider does not officially
                  support this language, so accuracy may be poor and it will fall back to automatic
                  detection. Always review the transcript before relying on it.
                </div>
              )}

              <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                <strong>Recording notice.</strong> [SET: recording consent notice]
              </div>

              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                />
                <span>
                  I confirm I have the legal right and the participants&apos; consent to record this
                  meeting. Recording people without consent may be unlawful where you live.
                </span>
              </label>

              <button
                onClick={startRecording}
                disabled={!consentGiven}
                className="w-full bg-red-600 text-white py-4 rounded-xl hover:bg-red-700 transition font-semibold text-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Recording
              </button>

              {!consentGiven && (
                <p className="text-xs text-gray-500 text-center">
                  Tick the consent box above to enable recording.
                </p>
              )}
            </div>
          )}

          {recording && !uploading && (
            <div className="flex gap-4 justify-center">
              {paused ? (
                <button
                  onClick={resumeRecording}
                  className="flex-1 bg-green-600 text-white py-4 rounded-xl hover:bg-green-700 transition font-semibold text-lg"
                >
                  Resume
                </button>
              ) : (
                <button
                  onClick={pauseRecording}
                  className="flex-1 bg-amber-500 text-white py-4 rounded-xl hover:bg-amber-600 transition font-semibold text-lg"
                >
                  Pause
                </button>
              )}
              <button
                onClick={stopRecording}
                className="flex-1 bg-gray-900 text-white py-4 rounded-xl hover:bg-black transition font-semibold text-lg"
              >
                Stop and Save
              </button>
            </div>
          )}

          {uploading && (
            <div className="py-4">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-600 text-sm">Saving audio and initiating processing...</p>
            </div>
          )}

          <div className="text-xs text-gray-400">
            Audio is securely captured and sent to the processing pipeline upon completion.
          </div>
        </div>
      </main>
    </div>
  );
}