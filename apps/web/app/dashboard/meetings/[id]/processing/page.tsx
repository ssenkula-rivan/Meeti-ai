'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { meetingsApi } from '@/lib/api';

export default function ProcessingPage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = params.id as string;

  const [status, setStatus] = useState<'processing' | 'failed' | 'completed'>('processing');
  const [progress, setProgress] = useState(15);
  const [errorMsg, setErrorMsg] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const friendlyFailure = (raw: string): string => {
    const t = (raw || '').toLowerCase();
    if (t.includes('credit') || t.includes('429') || t.includes('insufficient')) {
      return 'The AI service is out of credit, so notes can\u2019t be generated yet. Add credit to the provider account and retry.';
    }
    if (t.includes('not found') && t.includes('audio')) {
      return 'No audio was found for this meeting. This can happen for meetings created from a link without a recording. Please record on this device and try again.';
    }
    if (t.includes('econnreset') || t.includes('connection error') || t.includes('network')) {
      return 'Could not reach the AI service. Please check the connection and retry.';
    }
    if (raw) {
      return `Processing failed: ${raw}`;
    }
    return 'Processing encountered an issue while generating notes.';
  };

  useEffect(() => {
    startPolling();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [meetingId]);

  const startPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      try {
        const response = await meetingsApi.get(meetingId);
        const meeting = response.data;

        if (meeting.status === 'completed') {
          setStatus('completed');
          setProgress(100);
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => {
            router.push(`/dashboard/meetings/${meetingId}`);
          }, 800);
        } else if (meeting.status === 'failed') {
          setStatus('failed');
          setErrorMsg(friendlyFailure((meeting.metadata as any)?.failureReason || ''));
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else {
          setProgress((prev) => Math.min(prev + 10, 92));
        }
      } catch (error) {
        console.error('Failed to check processing status:', error);
      }
    }, 2000);
  };

  const handleRetry = async () => {
    try {
      setStatus('processing');
      setProgress(20);
      setErrorMsg('');
      await meetingsApi.process(meetingId);
      startPolling();
    } catch (err) {
      console.error('Failed to trigger retry:', err);
      setStatus('failed');
      setErrorMsg('Could not restart processing. Please try again.');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          {status === 'processing' || status === 'completed' ? (
            <>
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Processing Meeting
              </h1>
              <p className="text-gray-600 text-sm mb-6">
                Transcribing audio, detecting topics, identifying decisions, and structuring action items.
              </p>

              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="space-y-3 text-left border rounded-lg p-4 bg-gray-50 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-gray-700 font-medium">Audio uploaded and verified</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${progress >= 40 ? 'bg-green-500' : 'bg-blue-600 animate-pulse'}`} />
                  <span className="text-gray-700">Speech transcription and diarization</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${progress >= 80 ? 'bg-green-500' : progress >= 40 ? 'bg-blue-600 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">Notes, decisions, and tasks generation</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing Incomplete</h1>
              <p className="text-gray-600 text-sm mb-6">
                {errorMsg || 'Audio is safe, but note generation paused.'}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-sm"
                >
                  Retry Processing
                </button>
                <button
                  onClick={() => router.push(`/dashboard/meetings/${meetingId}`)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition text-sm"
                >
                  View Details
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
