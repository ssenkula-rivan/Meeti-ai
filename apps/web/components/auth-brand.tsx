import Link from 'next/link';

/* Shared marketing panel for the auth screens. The preview card is an
   illustrative product mock (static, decorative) — the same style used on the
   landing page — not a claim about the signed-in user's real data. */

const svgProps = {
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const SparkleIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} {...svgProps}>
    <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </svg>
);
const VideoIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} {...svgProps}>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="m16 10 6-3v10l-6-3z" />
  </svg>
);
const DocIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} {...svgProps}>
    <path d="M14 3v5h5" />
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
  </svg>
);

export function AuthBrandPanel({
  eyebrow,
  headline,
  sub,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  sub: string;
}) {
  return (
    <aside className="hidden bg-violet-50 px-10 py-12 dark:bg-slate-900 lg:flex lg:flex-col xl:px-14">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
        <SparkleIcon className="h-4 w-4" /> {eyebrow}
      </div>
      <h2 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 dark:text-white xl:text-5xl">
        {headline}
      </h2>
      <p className="mt-4 max-w-md text-base text-slate-500 dark:text-slate-400">{sub}</p>

      <div className="mt-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
            <VideoIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Product sync</p>
            <p className="text-xs text-slate-400">Example meeting · 32 min</p>
          </div>
        </div>
        <div className="mt-4 flex gap-4 border-b border-slate-100 pb-2 text-xs font-medium dark:border-white/5">
          <span className="text-violet-600 dark:text-violet-300">AI summary</span>
          <span className="text-slate-400">Transcript</span>
          <span className="text-slate-400">Action items</span>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
          A clearer direction for the redesign
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          The team aligned on a simpler homepage and a focused first-time experience.
        </p>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
            Next steps
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="h-4 w-4 flex-none rounded border border-slate-300 dark:border-white/20" />
            Review homepage wireframes
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
        <DocIcon className="h-4 w-4" /> Transcripts · AI summaries · Action items
      </div>

      <div className="mt-auto pt-10 text-xs text-slate-400">
        Private by default.{' '}
        <Link href="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-200">
          How we handle your data
        </Link>
      </div>
    </aside>
  );
}
