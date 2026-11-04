'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { ThemeToggle } from '@/components/theme';
import { AuthBrandPanel } from '@/components/auth-brand';

const eyeSvg = {
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authApi.login(email, password);
      localStorage.setItem('auth_token', response.data.token);
      router.push('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.error || 'We couldn’t sign you in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2">
          <img src="/apple-touch-icon.png" alt="Meeti" className="h-8 w-8 rounded-lg object-cover" />
          <span className="text-xl font-bold tracking-tight">Meeti</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">New here?</span>
          <Link href="/register" className="text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400">
            Create an account
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        <div className="w-full lg:w-1/2">
          <AuthBrandPanel
            eyebrow="Your AI meeting assistant"
            headline={<>Pick up where<br />you left off.</>}
            sub="Your meetings, notes and next steps — all together in one place."
          />
        </div>

        <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2 lg:px-12">
          <div className="w-full max-w-md">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300">
              Welcome back
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Good to see you again.</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Log in to keep your conversations moving forward.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-slate-700 dark:bg-slate-900"
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" {...eyeSvg}><path d="M3 3l18 18" /><path d="M10.6 5.1A9 9 0 0 1 21 12a15 15 0 0 1-3.2 3.9M6.6 6.6A15 15 0 0 0 3 12a9 9 0 0 0 12.5 4.4" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
                    ) : (
                      <svg className="h-5 w-5" {...eyeSvg}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Log in'}
                {!loading && (
                  <svg className="h-4 w-4" {...eyeSvg}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Don’t have an account?{' '}
              <Link href="/register" className="font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>

      <footer className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-6 py-5 text-sm text-slate-400 dark:border-white/10 sm:flex-row lg:px-10">
        <span>© 2026 Meeti</span>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-200">Privacy policy</Link>
          <Link href="/terms" className="hover:text-slate-600 dark:hover:text-slate-200">Terms of service</Link>
        </div>
      </footer>
    </div>
  );
}
