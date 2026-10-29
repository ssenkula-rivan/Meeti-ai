'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PermissionsPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [microphonePermission, setMicrophonePermission] = useState<PermissionState>('prompt');
  const [notificationPermission, setNotificationPermission] = useState<PermissionState>('prompt');
  const [micError, setMicError] = useState<string | null>(null);
  // 'checking' -> verifying the session; 'redirecting' -> no session, heading to
  // sign-in; 'ready' -> signed in, show the flow. This prevents the blank
  // "no response" flash a direct visit used to show while the redirect ran.
  const [authState, setAuthState] = useState<'checking' | 'redirecting' | 'ready'>('checking');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setAuthState('redirecting');
      const t = setTimeout(() => router.push('/login'), 400);
      return () => clearTimeout(t);
    }

    // Check current permission states
    checkPermissions();
    setAuthState('ready');
  }, [router]);

  const checkPermissions = async () => {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      try {
        const micResult = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicrophonePermission(micResult.state);
      } catch (error) {
        console.log('Microphone permission check failed:', error);
      }

      try {
        const notifResult = await navigator.permissions.query({ name: 'notifications' as PermissionName });
        setNotificationPermission(notifResult.state);
      } catch (error) {
        console.log('Notification permission check failed:', error);
      }
    }
  };

  const requestMicrophonePermission = async () => {
    setMicError(null);
    // getUserMedia requires a secure context; surface a clear message instead of
    // silently doing nothing (which previously read as "no response").
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('This browser does not expose a microphone API. You can continue and enable it later.');
      setMicrophonePermission('denied');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      setMicrophonePermission('granted');
      setStep(2);
    } catch (error: any) {
      console.error('Microphone permission denied:', error);
      setMicError(
        error?.name === 'NotAllowedError'
          ? 'Microphone access was blocked. You can skip for now and enable it in your browser settings.'
          : 'We could not access the microphone. You can skip for now and try again later.'
      );
      setMicrophonePermission('denied');
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission as PermissionState);
      if (permission === 'granted') {
        setStep(3);
      }
    } catch (error) {
      console.error('Notification permission denied:', error);
      setNotificationPermission('denied');
    }
  };

  const handleSkipCalendar = () => {
    setStep(4);
  };

  const handleComplete = () => {
    router.push('/dashboard');
  };

  if (authState !== 'ready') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
          <p className="text-sm font-medium text-gray-500">
            {authState === 'redirecting' ? 'Redirecting to sign in\u2026' : 'Checking your session\u2026'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Permissions
          </h1>
          <p className="text-gray-600">
            {step === 1 ? 'Let us access your microphone' : 
             step === 2 ? 'Enable notifications' :
             step === 3 ? 'Calendar access (optional)' :
             'You\'re all set!'}
          </p>
        </div>

        {step === 1 && (
          <div className="bg-white border rounded-lg p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Microphone Access</h2>
              <p className="text-gray-600 mb-4">
                We need access to your microphone to record meetings. This is required for the app to function.
              </p>
              <div className="text-sm text-gray-500 mb-4">
                {microphonePermission === 'granted' && (
                  <span className="text-green-600">Permission granted</span>
                )}
                {microphonePermission === 'denied' && (
                  <span className="text-red-600">{micError || 'Permission denied. Please enable in browser settings.'}</span>
                )}
                {microphonePermission === 'prompt' && (
                  <span>Click below to request permission</span>
                )}
              </div>
            </div>

            <button
              onClick={requestMicrophonePermission}
              disabled={microphonePermission === 'granted'}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {microphonePermission === 'granted' ? 'Continue' : 'Allow Microphone Access'}
            </button>

            {microphonePermission === 'denied' && (
              <button
                onClick={() => setStep(2)}
                className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Skip for now
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="bg-white border rounded-lg p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Notifications</h2>
              <p className="text-gray-600 mb-4">
                Enable notifications to get alerts when meeting processing is complete, reminders for action items, and follow-up notifications.
              </p>
              <div className="text-sm text-gray-500 mb-4">
                {notificationPermission === 'granted' && (
                  <span className="text-green-600">Permission granted</span>
                )}
                {notificationPermission === 'denied' && (
                  <span className="text-red-600">Permission denied. Please enable in browser settings.</span>
                )}
                {notificationPermission === 'prompt' && (
                  <span>Click below to request permission</span>
                )}
              </div>
            </div>

            <button
              onClick={requestNotificationPermission}
              disabled={notificationPermission === 'granted'}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {notificationPermission === 'granted' ? 'Continue' : 'Enable Notifications'}
            </button>

            <button
              onClick={handleSkipCalendar}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 font-semibold"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white border rounded-lg p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Calendar Integration</h2>
              <p className="text-gray-600 mb-4">
                Connect your calendar to automatically attach meeting notes to calendar events. This is optional and can be enabled later.
              </p>
            </div>

            <button
              onClick={() => {
                // TODO: Implement calendar integration
                setStep(4);
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Connect Calendar
            </button>

            <button
              onClick={handleSkipCalendar}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 font-semibold"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="bg-white border rounded-lg p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">You&apos;re all set!</h2>
              <p className="text-gray-600 mb-4">
                You can change these permissions anytime in your settings.
              </p>
            </div>

            <button
              onClick={handleComplete}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}