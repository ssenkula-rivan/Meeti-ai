import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site-config';
import { Fill } from '@/components/legal';

export const metadata: Metadata = {
  title: 'About',
  description: 'About Meeti and Cranictech, the company behind it.',
  alternates: { canonical: '/about' },
  openGraph: { title: 'About Meeti', description: 'About Meeti and Cranictech.', url: '/about' },
};

export default function About() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">Meeti</Link>
          <nav className="flex gap-4 text-sm text-gray-600">
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold mb-6">About Meeti</h1>
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          DRAFT — Items marked [SET] still need to be confirmed before publishing.
        </div>
        <div className="space-y-5 leading-relaxed text-gray-800">
          <p>
            Meeti turns meetings into clear, actionable notes. Record a meeting, and
            Meeti produces a transcript, summary, decisions and action items &mdash;
            so nothing said in the room gets lost.
          </p>
          <p>
            Meeti runs on iPhone, Android and the web, and works in several languages. It
            is built for teams and individuals who want reliable meeting records without
            spending time writing them up.
          </p>
          <p>
            Meeti is operated by <strong>{SITE.legal.entityName}</strong>, of {SITE.legal.address}
            {' '}(company registration number: <Fill value={SITE.legal.registrationNumber} />).
            For questions, contact <Fill value={SITE.legal.supportEmail} />.
          </p>
          <p className="text-sm text-gray-500">
            See our <Link href="/privacy" className="underline">Privacy Policy</Link>,{' '}
            <Link href="/terms" className="underline">Terms of Service</Link> and{' '}
            <Link href="/ai-policy" className="underline">AI Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
