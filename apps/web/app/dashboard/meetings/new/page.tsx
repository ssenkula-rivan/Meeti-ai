'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { meetingsApi } from '@/lib/api';
import { Icon } from '@/components/dashboard';
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

const MEETING_TYPES = [
  { value: 'business', label: 'Business meeting' },
  { value: 'team', label: 'Team meeting' },
  { value: 'client', label: 'Client meeting' },
  { value: 'interview', label: 'Interview' },
  { value: 'class', label: 'Class' },
  { value: 'research', label: 'Research' },
  { value: 'church', label: 'Church meeting' },
  { value: 'personal', label: 'Personal notes' },
];

const OUTPUT_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'sw', label: 'Swahili' },
  { value: 'lg', label: 'Luganda' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
];

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300';

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
      setError('Give the meeting a title so you can find it later.');
      return;
    }

    if (selectedPlatform.requiresLink && !meetingLink.trim()) {
      setError(`Paste the ${selectedPlatform.label} link so you can open it in a new tab.`);
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
      setError(err.response?.data?.error || 'Could not create the meeting. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          My meetings / New
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Start a new meeting</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Set the basics now. You confirm consent and begin recording on the next screen.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Icon.Clock className="h-3.5 w-3.5" /> Nothing is recorded yet
          </span>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <form onSubmit={handleSubmit} className="space-y-6 xl:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-5">
                <div>
                  <label htmlFor="title" className={labelClass}>Meeting title</label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={fieldClass}
                    placeholder="Weekly product sync"
                  />
                </div>

                <div>
                  <label htmlFor="platform" className={labelClass}>Where is this meeting taking place?</label>
                  <select
                    id="platform"
                    value={platform}
                    onChange={(e) => {
                      setPlatform(e.target.value);
                      setMeetingLink('');
                    }}
                    className={fieldClass}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {selectedPlatform.requiresLink
                      ? 'Meeti records audio on this device. The link just opens the meeting in a new tab.'
                      : 'Audio is captured on this device. No link is required.'}
                  </p>
                </div>

                {selectedPlatform.requiresLink && (
                  <div>
                    <label htmlFor="meetingLink" className={labelClass}>{selectedPlatform.label} link</label>
                    <input
                      id="meetingLink"
                      type="url"
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      className={fieldClass}
                      placeholder={selectedPlatform.placeholder}
                    />
                    {meetingLink.trim() && (
                      <a
                        href={meetingLink.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
                      >
                        <Icon.Link className="h-4 w-4" /> Open in a new tab
                      </a>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="meetingType" className={labelClass}>Meeting type</label>
                  <select
                    id="meetingType"
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value)}
                    className={fieldClass}
                  >
                    {MEETING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sourceLanguage" className={labelClass}>Spoken language</label>
                    <select
                      id="sourceLanguage"
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className={fieldClass}
                    >
                      <option value={AUTO_DETECT}>Auto-detect</option>
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}{l.status === 'beta' ? ' (beta)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Languages marked (beta) are not yet validated on real meeting audio.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="outputLanguage" className={labelClass}>Notes language</label>
                    <select
                      id="outputLanguage"
                      value={outputLanguage}
                      onChange={(e) => setOutputLanguage(e.target.value)}
                      className={fieldClass}
                    >
                      {OUTPUT_LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      The language your summary and action items are written in.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon.Play className="h-4 w-4" />
                  {loading ? 'Creating…' : 'Continue to recording'}
                </button>
              </div>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">What happens next</h2>
              <ol className="mt-3 space-y-3 text-sm text-slate-500 dark:text-slate-400">
                <li className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">1</span>
                  Confirm everyone agrees to be recorded.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">2</span>
                  Record on this device — pause any time.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">3</span>
                  Review, then generate notes with AI.
                </li>
              </ol>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-500/30 dark:bg-violet-500/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
                <Icon.Check className="h-4 w-4" /> Private by default
              </div>
              <p className="mt-2 text-sm text-violet-700/90 dark:text-violet-200/80">
                Only you can access this recording. Nothing is shared or emailed until you choose to.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
