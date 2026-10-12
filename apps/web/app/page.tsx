import Link from 'next/link';
import type { Metadata } from 'next';
import { ThemeToggle } from '@/components/theme';

export const metadata: Metadata = {
  title: 'Meeti - Turn meetings into actionable notes',
  description: 'Record or upload a meeting and get a transcript, summary, decisions and action items automatically.',
  alternates: { canonical: '/' },
  openGraph: { title: 'Meeti - Turn meetings into actionable notes', description: 'Record or upload a meeting and get a transcript, summary, decisions and action items automatically.', url: '/' },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img src="/apple-touch-icon.png" alt="Meeti" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-2xl font-bold tracking-tight">Meeti</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className="hidden text-sm font-medium text-muted-foreground transition hover:text-foreground sm:block">
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              AI meeting notes · Built for East Africa
            </span>
            <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
              Turn every meeting into
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">clear, actionable notes</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-muted-foreground">
              Record meetings in multiple languages, get AI-powered transcripts,
              summaries, and action items. Works on iPhone, Android, and Web.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                Start Free
              </Link>
              <Link
                href="#features"
                className="rounded-xl border border-border bg-card px-8 py-4 text-lg font-semibold text-foreground transition hover:border-primary/40"
              >
                Learn More
              </Link>
            </div>
          </div>

          <div id="features" className="mt-32 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Record and Listen</h3>
              <p className="text-muted-foreground">
                Capture meetings in English with automatic language detection, plus
                beta support for Swahili, Luganda and other languages.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-success/10 text-success">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Understand</h3>
              <p className="text-muted-foreground">
                AI extracts summaries, decisions, action items, and deadlines
                from your meetings automatically.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Act</h3>
              <p className="text-muted-foreground">
                Track tasks, set reminders, and export to PDF, Google Drive, Gmail and
                Slack. Never miss a follow-up.
              </p>
            </div>
          </div>

          <div className="mt-32 rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-600 p-12 text-center text-white shadow-glow">
            <h2 className="mb-4 text-3xl font-bold">Built for Uganda and East Africa</h2>
            <p className="mx-auto mb-8 max-w-2xl text-xl opacity-90">
              Designed for the way people meet in Uganda and across East Africa, with
              more languages added over time.
            </p>
            <Link
              href="/register"
              className="inline-block rounded-xl bg-white px-8 py-4 text-lg font-semibold text-blue-700 transition hover:bg-gray-100"
            >
              Try It Now
            </Link>
          </div>
        </div>
      </main>

      <footer className="mt-24 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h4 className="mb-4 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features" className="hover:text-foreground">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
                <li><Link href="/security" className="hover:text-foreground">Security</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground">About</Link></li>
                <li><Link href="/about" className="hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/ai-policy" className="hover:text-foreground">AI Policy</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground">Help Center</Link></li>
                <li><Link href="/about" className="hover:text-foreground">Contact Support</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
            © 2026 Meeti. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
