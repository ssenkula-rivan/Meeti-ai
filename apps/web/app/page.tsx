import Link from 'next/link';
import type { Metadata } from 'next';
import { ThemeToggle } from '@/components/theme';
import PricingSection from '@/components/landing/pricing';

export const metadata: Metadata = {
  title: 'Meeti - Turn meetings into actionable notes',
  description:
    'Record or upload a meeting and get a transcript, summary, decisions and action items automatically.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Meeti - Turn meetings into actionable notes',
    description:
      'Record or upload a meeting and get a transcript, summary, decisions and action items automatically.',
    url: '/',
  },
};

/* ---------- inline icons (lucide-style, 24x24, stroke) ---------- */

type IconProps = { className?: string };

function Icon({ path, className }: { path: React.ReactNode; className?: string }) {
  return (
    <svg
      className={className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

const SparklesIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />} />
);
const CheckIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<path d="M5 13l4 4L19 7" />} />
);
const ArrowRightIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<path d="M5 12h14M13 6l6 6-6 6" />} />
);
const ArrowUpRightIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<path d="M7 17L17 7M8 7h9v9" />} />
);
const CalendarIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />
);
const MicIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v4" /></>} />
);
const ListChecksIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<><path d="M11 6h9M11 12h9M11 18h9" /><path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" /></>} />
);
const FileAudioIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<><path d="M14 3v5h5" /><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M9 17v-3M12 17v-5M15 17v-2" /></>} />
);
const VideoIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M22 8l-6 4 6 4V8z" /></>} />
);
const ChartIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<path d="M3 3v18h18M7 14l3-4 3 3 4-6" />} />
);
const MessagesIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />} />
);
const GraduationIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<><path d="M22 9L12 4 2 9l10 5 10-5z" /><path d="M6 11v5c0 1 3 3 6 3s6-2 6-3v-5" /></>} />
);
const BriefcaseIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18" /></>} />
);
const SendIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />} />
);
const BlocksIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></>} />
);
const ShieldIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>} />
);
const CircleCheckIcon = ({ className }: IconProps) => (
  <Icon className={className} path={<><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>} />
);

/* ---------- content data ---------- */

const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Use cases', href: '#use-cases' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'Pricing', href: '#pricing' },
];

const CAPABILITIES = ['Capture the conversation', 'Find the important moments', 'Keep next steps moving'];

const STEPS = [
  { n: '01', icon: CalendarIcon, title: 'Bring your meeting', body: 'Start a meeting, join with a link or upload an existing recording. Connect your calendar to keep your schedule close.' },
  { n: '02', icon: MicIcon, title: 'Stay in the moment', body: 'Record with everyone’s awareness. Meeti captures the transcript so you can focus on the people, not the keyboard.' },
  { n: '03', icon: ListChecksIcon, title: 'Move the work forward', body: 'Review the AI summary, check the decisions and assign action items. Share a useful recap with your team.' },
];

const FEATURES = [
  { icon: FileAudioIcon, title: 'A transcript you can revisit', body: 'Capture spoken details and find the moment you need without starting the recording over.', tag: 'Recordings and transcripts, together' },
  { icon: SparklesIcon, title: 'Summaries with substance', body: 'Get the highlights and decisions in a clear recap. Review the important points before you share.', tag: 'A useful starting point, ready for your review' },
  { icon: ListChecksIcon, title: 'Next steps with owners', body: 'Turn follow-ups into action items, with owners and due dates that keep the work moving.', tag: 'Know who’s doing what, and when' },
];

const RECAP_BENEFITS = ['Review decisions before sharing', 'Keep action items close to their context', 'Ask your AI assistant about the meeting'];

const USE_CASES = [
  { icon: ChartIcon, title: 'Sales', body: 'Stay with the customer. Capture needs, objections and next steps, then keep follow-ups connected to the deal.', tag: 'Discovery calls · Demos · Follow-ups' },
  { icon: MessagesIcon, title: 'Interview', body: 'Listen more closely. Keep a clear record of candidate conversations and revisit the details with your team.', tag: 'Hiring · Research · Debriefs' },
  { icon: GraduationIcon, title: 'Education', body: 'Focus on learning. Revisit the key ideas from lessons, tutoring and group discussions in your notes.', tag: 'Lessons · Study groups · Workshops' },
  { icon: BriefcaseIcon, title: 'Business', body: 'Keep the team aligned. Turn planning sessions, project reviews and weekly syncs into shared next steps.', tag: 'Planning · Reviews · Team syncs' },
];

const INTEGRATIONS = [
  { icon: VideoIcon, title: 'Meet & schedule', tools: 'Google Calendar · Zoom\nGoogle Meet · Microsoft Teams', body: 'Keep your schedule and conversations connected.' },
  { icon: SendIcon, title: 'Share & document', tools: 'Slack · Notion', body: 'Bring recaps and decisions to your team’s channels and pages.' },
  { icon: BlocksIcon, title: 'Act & automate', tools: 'Asana · HubSpot · Zapier', body: 'Turn meeting outcomes into tasks, deal context and workflows.' },
];

const CONTROL_PRINCIPLES = [
  { title: 'Clear recording awareness', body: 'Everyone will see when recording starts. Let participants know before you capture a conversation.' },
  { title: 'Permission by permission', body: 'Microphone, notifications and calendar access are explained separately. Skip a step and change it later in Settings.' },
  { title: 'A private workspace', body: 'Only invited people can join your meeting. Manage shared integrations as a workspace admin.' },
];

const FAQS = [
  { q: 'Can I try Meeti for free?', a: 'Yes. The Free plan includes 60 transcription minutes each month, 1 GB of recording storage and basic AI summaries.' },
  { q: 'How can I bring a meeting into Meeti?', a: 'Start a meeting, schedule one, join with a link or upload an existing recording. You can also connect your calendar and supported meeting tools.' },
  { q: 'Do I have to connect my calendar?', a: 'No. Calendar access is optional. You can skip it during setup and connect later from Integrations.' },
  { q: 'Will people know a meeting is being recorded?', a: 'Everyone will see when recording starts. Always let participants know and make sure you have the permission you need before recording.' },
  { q: 'Can my team share meeting outcomes?', a: 'Use your workspace to collaborate on summaries and action items. Connect tools such as Slack, Notion and Asana to keep follow-ups close to the work.' },
  { q: 'Can I change my plan later?', a: 'Yes. Manage your plan, seats and billing details from Settings → Billing. Monthly and yearly billing options are available.' },
];

/* ---------- shared button styles ---------- */

const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-violet-200';

/* ---------- decorative mocks (illustrative only, no invented metrics) ---------- */

function HeroPreviewMock() {
  return (
    <div className="mx-auto mt-4 w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
      <div className="flex">
        <div className="hidden w-48 shrink-0 flex-col gap-1 border-r border-slate-100 bg-slate-50 p-4 dark:border-white/5 dark:bg-white/5 sm:flex">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-violet-600" />
            <span className="text-sm font-bold text-slate-800 dark:text-white">Meeti</span>
          </div>
          {['Dashboard', 'My meetings', 'Recordings', 'Action items', 'Calendar', 'AI assistant'].map((item, i) => (
            <div
              key={item}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${i === 0 ? 'bg-violet-100 font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200' : 'text-slate-500 dark:text-slate-400'}`}
            >
              <span className="h-3.5 w-3.5 rounded-sm bg-current opacity-60" />
              {item}
            </div>
          ))}
        </div>
        <div className="flex-1 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-4 w-40 rounded bg-slate-200 dark:bg-white/10" />
              <div className="mt-2 h-3 w-56 rounded bg-slate-100 dark:bg-white/5" />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">
              <span>New meeting</span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-slate-100 p-3 dark:border-white/5">
                <div className="h-2.5 w-16 rounded bg-slate-200 dark:bg-white/10" />
                <div className="mt-3 h-5 w-12 rounded bg-violet-200 dark:bg-violet-500/30" />
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 dark:border-white/5">
                <span className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-white/10" />
                <div className="flex-1">
                  <div className="h-2.5 w-40 rounded bg-slate-200 dark:bg-white/10" />
                  <div className="mt-1.5 h-2 w-24 rounded bg-slate-100 dark:bg-white/5" />
                </div>
                <span className="h-2 w-10 rounded-full bg-emerald-200 dark:bg-emerald-500/30" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecapMock() {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200">
          <VideoIcon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="h-3 w-52 rounded bg-slate-200 dark:bg-white/10" />
          <div className="mt-1.5 h-2.5 w-32 rounded bg-slate-100 dark:bg-white/5" />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        {['Summary', 'Transcript', 'Action items'].map((t, i) => (
          <span key={t} className={`rounded-md px-3 py-1 text-xs font-medium ${i === 0 ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-2.5 rounded bg-slate-100 dark:bg-white/5" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
      <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-white/5">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-violet-300 dark:border-violet-400/50" />
            <span className="h-2.5 flex-1 rounded bg-slate-100 dark:bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img src="/apple-touch-icon.png" alt="Meeti" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-xl font-bold tracking-tight">Meeti</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link href="/login" className="hidden text-sm font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:block">
              Log in
            </Link>
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section id="product" className="mx-auto max-w-7xl px-6 pb-20 pt-16 text-center lg:px-8 lg:pt-20">
          <div className="mx-auto flex max-w-3xl flex-col items-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3.5 py-1.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-400/20">
              <SparklesIcon className="h-4 w-4" />
              Meet your AI meeting assistant
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Be in the conversation.
              <br />
              <span className="text-violet-600 dark:text-violet-400">We’ll take the notes.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-500 dark:text-slate-400">
              Turn meetings into clear transcripts, useful summaries and next steps. Less busywork, from the first hello to the final follow-up.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/register" className={primaryBtn}>
                Get started
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <a href="#how-it-works" className={secondaryBtn}>
                Explore Meeti
              </a>
            </div>
            <p className="mt-5 text-sm text-slate-400 dark:text-slate-500">
              Free plan includes 60 transcription minutes every month.
            </p>
          </div>

          <div className="mt-14">
            <HeroPreviewMock />
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {CAPABILITIES.map((c) => (
              <div key={c} className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                {c}
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300">A lighter workflow</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">From a conversation to a clear next step.</h2>
            <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">One connected place for the meeting, the notes and what happens next.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-3xl border border-slate-200 bg-white p-8 dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-violet-200 dark:text-violet-500/40">{s.n}</span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                    <s.icon className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Core features */}
        <section className="border-y border-slate-100 bg-slate-50/70 dark:border-white/5 dark:bg-white/5">
          <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300">The details, taken care of</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Less replaying. More understanding.</h2>
              <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">Everything your team needs to turn a busy meeting into a useful record.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-3xl border border-slate-200 bg-white p-8 dark:border-white/10 dark:bg-slate-900">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                    <f.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.body}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">{f.tag}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Meeting recap showcase */}
        <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300">After the meeting</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">The important things,<br />without the replay.</h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-500 dark:text-slate-400">
                Your recording is only the beginning. Bring the transcript, summary and action items into one focused workspace, so the conversation can become progress.
              </p>
              <ul className="mt-6 space-y-3">
                {RECAP_BENEFITS.map((b) => (
                  <li key={b} className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                    <CircleCheckIcon className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
                    {b}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={`${primaryBtn} mt-8`}>
                Meet your AI assistant
                <ArrowUpRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <div className="rounded-3xl bg-violet-50 p-8 dark:bg-violet-500/10">
              <RecapMock />
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section id="use-cases" className="border-y border-slate-100 bg-slate-50/70 dark:border-white/5 dark:bg-white/5">
          <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300">For the way you meet</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Different conversations. The same clarity.</h2>
              <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">Make room for the people in front of you, wherever your work takes you.</p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map((u) => (
                <div key={u.title} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 dark:border-white/10 dark:bg-slate-900">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                    <u.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{u.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{u.body}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">{u.tag}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section id="integrations" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300">Connected to your workday</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Your favorite tools,<br />working better together.</h2>
              <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">Bring Meeti to your calls and send the useful details to the places your team already works.</p>
            </div>
            <Link href="/dashboard/integrations" className={secondaryBtn}>
              Explore integrations
              <ArrowUpRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {INTEGRATIONS.map((it) => (
              <div key={it.title} className="rounded-3xl border border-slate-200 bg-white p-8 dark:border-white/10 dark:bg-slate-900">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                  <it.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{it.title}</h3>
                <p className="mt-2 whitespace-pre-line text-sm font-semibold text-slate-800 dark:text-slate-100">{it.tools}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{it.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy and control */}
        <section className="bg-violet-700 dark:bg-violet-950">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:px-8">
            <div className="text-white">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <ShieldIcon className="h-6 w-6" />
              </span>
              <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">Your conversations.<br />Your control.</h2>
              <p className="mt-4 max-w-md text-violet-100">
                Choose what to connect, what to record and who to invite. Permissions are yours to manage.
              </p>
            </div>
            <div className="space-y-6">
              {CONTROL_PRINCIPLES.map((c) => (
                <div key={c.title} className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">{c.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-violet-100/90">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <PricingSection />

        {/* FAQ */}
        <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,380px)_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300">Good to know</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">A few questions,<br />answered.</h2>
              <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">A clearer picture before your first meeting.</p>
              <Link href="/about" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 dark:text-violet-300">
                Visit Help &amp; support
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">
              {FAQS.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold">
                    {f.q}
                    <span className="text-violet-600 transition group-open:rotate-45 dark:text-violet-300" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Start CTA */}
        <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-8">
          <div className="rounded-[2rem] bg-gradient-to-br from-violet-600 to-violet-800 px-6 py-16 text-center text-white shadow-xl sm:px-12">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <SparklesIcon className="h-6 w-6" />
            </span>
            <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">Your next meeting, with a little less busywork.</h2>
            <p className="mt-4 text-lg text-violet-100">Make more room for meaningful conversations.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-50">
                Get started
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Log in to your workspace
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <img src="/apple-touch-icon.png" alt="Meeti" className="h-8 w-8 rounded-lg object-cover" />
                <span className="text-xl font-bold tracking-tight">Meeti</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Less notes. More focus. Your AI meeting assistant, from conversation to follow-up.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Product</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
                <li><a href="#product" className="hover:text-slate-900 dark:hover:text-white">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white">How it works</a></li>
                <li><Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Use cases</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
                {USE_CASES.map((u) => (
                  <li key={u.title}><a href="#use-cases" className="hover:text-slate-900 dark:hover:text-white">{u.title}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Get started</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
                <li><Link href="/register" className="hover:text-slate-900 dark:hover:text-white">Create an account</Link></li>
                <li><Link href="/login" className="hover:text-slate-900 dark:hover:text-white">Log in</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 text-sm text-slate-400 dark:border-white/10 sm:flex-row">
            <span>© 2026 Meeti. All rights reserved.</span>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
              <Link href="/security" className="hover:text-slate-900 dark:hover:text-white">Security</Link>
              <Link href="/ai-policy" className="hover:text-slate-900 dark:hover:text-white">AI Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
