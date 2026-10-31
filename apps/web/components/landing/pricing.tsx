'use client';

import Link from 'next/link';
import { useState } from 'react';

type Plan = {
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
  badge?: string;
};

// Real, server-enforced plan figures (see packages/database/seed-plans.sql).
const PLANS: Plan[] = [
  {
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    blurb: 'Make space for better meeting notes.',
    features: ['60 transcription minutes / month', '1 GB recording storage', 'Basic AI summaries'],
    cta: { label: 'Start for free', href: '/register' },
  },
  {
    name: 'Pro',
    priceMonthly: 9.99,
    priceAnnual: 99.99,
    blurb: 'A focused workspace for your team.',
    features: ['500 transcription minutes / month', '10 GB workspace storage', 'AI assistant & action items'],
    cta: { label: 'Choose Pro', href: '/register' },
    highlight: true,
    badge: 'Most popular',
  },
  {
    name: 'Business',
    priceMonthly: 29.99,
    priceAnnual: 299.99,
    blurb: 'More room for growing teams.',
    features: ['2,000 transcription minutes / month', '100 GB workspace storage', 'Advanced admin & team controls'],
    cta: { label: 'Choose Business', href: '/register' },
  },
];

function Check() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PricingSection() {
  const [yearly, setYearly] = useState(false);

  const priceFor = (p: Plan) => {
    if (p.priceMonthly === 0) return { amount: '$0', note: 'For getting started' };
    if (yearly) {
      const perMonth = p.priceAnnual / 12;
      return { amount: `$${perMonth.toFixed(2).replace(/\.00$/, '')}`, note: 'per month, billed yearly' };
    }
    return { amount: `$${p.priceMonthly.toFixed(2).replace(/\.00$/, '')}`, note: 'per month' };
  };

  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300">A little more room to grow</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">The right fit for your conversations.</h2>
          <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">Start with Free. Choose more minutes, storage and workspace tools when you need them.</p>
        </div>
        <div className="flex flex-col items-start gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-sm font-semibold dark:border-white/10 dark:bg-white/5">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-lg px-4 py-1.5 transition ${!yearly ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-200' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-lg px-4 py-1.5 transition ${yearly ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-200' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Yearly
            </button>
          </div>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Save with yearly billing</span>
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p) => {
          const price = priceFor(p);
          return (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-3xl border p-8 shadow-sm transition ${
                p.highlight
                  ? 'border-violet-300 bg-violet-50/40 ring-1 ring-violet-200 dark:border-violet-400/40 dark:bg-violet-500/10 dark:ring-violet-400/30'
                  : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900'
              }`}
            >
              {p.badge && (
                <span className="absolute -top-3 left-8 rounded-full bg-violet-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{p.badge}</span>
              )}
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{price.amount}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{price.note}</span>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{p.blurb}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.cta.href}
                className={`mt-8 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                  p.highlight
                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                    : 'border border-slate-200 bg-white text-slate-900 hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:text-violet-200'
                }`}
              >
                {p.cta.label}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">All amounts in USD. Taxes may apply. Paid plan prices shown for monthly billing.</p>
    </section>
  );
}
