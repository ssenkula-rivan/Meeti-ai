'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { meetingsApi } from '@/lib/api';
import { SUPPORTED_LANGUAGES, AUTO_DETECT } from '@/lib/languages';

type PlatformOption = {
  value: string;
  label: string;
  requiresLink: boolean;
  placeholder?: string;
};

const PLATFORMS: PlatformOption[] = [
  { value: 'in-person', label: 'In-person / Room', requiresLink: false },
  { value: 'google-meet', label: 'Google Meet', requiresLink: true, placeholder: 'https://meet.google.com/xxx-xxxx-xxx' },
  { value: 'zoom', label: 'Zoom', requiresLink: true, placeholder: 'https://zoom.us/j/00000000000' },
  { value: 'microsoft-teams', label: 'Microsoft Teams', requiresLink: true, placeholder: 'https://teams.microsoft.com/l/meetup-join/...' },
  { value: 'webex', label: 'Cisco Webex', requiresLink: true, placeholder: 'https://yourcompany.webex.com/meet/username' },
  { value: 'phone', label: 'Phone Call', requiresLink: false },
  { value: 'whatsapp', label: 'WhatsApp', requiresLink: false },
  { value: 'telegram', label: 'Telegram', requiresLink: false },
  { value: 'other', label: 'Other', requiresLink: false },
];

export default function NewMeetingPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('business');
  const [sourceLanguage, setSourceLanguage] = useState(AUTO_DETECT);
  const [outputLanguage, setOutputLanguage] = useState('en');
  const [platform, setPlatform] = useState('in-person');
  const [meetingLink, setMeetingLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedPlatform = PLATFORMS.find((p) => p.value === platform) ?? PLATFORMS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Meeting title is required');
      return;
    }

    if (selectedPlatform.requiresLink && !meetingLink.trim()) {
      setError(`Enter the ${selectedPlatform.label} link so the meeting can be joined.`);
      return;
    }

    setLoading(true);
    try {
      const response = await meetingsApi.create({
        title: title.trim(),
        meetingType,
        sourceLanguage,
        outputLanguage,
        platform,
        meetingLink: selectedPlatform.requiresLink ? meetingLink.trim() : undefined,
      });
      router.push(`/dashboard/meetings/${response.data.id}/record`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create meeting');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button
              onClick={() => router.back()}
              className="text-gray-700 hover:text-gray-900"
            >
              Back
            </button>
            <h1 className="text-xl font-semibold">New Meeting</h1>
            <div className="w-16" />
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Project Planning Meeting"
              required
            />
          </div>

          <div>
            <label htmlFor="platform" className="block text-sm font-medium text-gray-700 mb-2">
              Where is this meeting taking place?
            </label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value);
                setMeetingLink('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500">
              {selectedPlatform.requiresLink
                ? 'Paste the invitation link to join the meeting. Audio is recorded on this device.'
                : 'Recording starts immediately on this device. No link required.'}
            </p>
          </div>

          {selectedPlatform.requiresLink && (
            <div>
              <label htmlFor="meetingLink" className="block text-sm font-medium text-gray-700 mb-2">
                {selectedPlatform.label} Link
              </label>
              <input
                id="meetingLink"
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={selectedPlatform.placeholder}
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="meetingType" className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Type
            </label>
            <select
              id="meetingType"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="business">Business Meeting</option>
              <option value="interview">Interview</option>
              <option value="class">Class</option>
              <option value="client">Client Meeting</option>
              <option value="church">Church Meeting</option>
              <option value="team">Team Meeting</option>
              <option value="personal">Personal Notes</option>
              <option value="research">Research</option>
            </select>
          </div>

          <div>
            <label htmlFor="sourceLanguage" className="block text-sm font-medium text-gray-700 mb-2">
              Recording Language
            </label>
            <select
              id="sourceLanguage"
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={AUTO_DETECT}>Auto-detect</option>
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}{l.status === 'beta' ? ' (beta)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500">
              Languages marked (beta) are improving and are not yet validated on real meeting audio.
            </p>
          </div>

          <div>
            <label htmlFor="outputLanguage" className="block text-sm font-medium text-gray-700 mb-2">
              Notes Language
            </label>
            <select
              id="outputLanguage"
              value={outputLanguage}
              onChange={(e) => setOutputLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="sw">Swahili</option>
              <option value="lg">Luganda</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {loading ? 'Creating...' : selectedPlatform.requiresLink ? 'Join & Start Recording' : 'Start Recording'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}