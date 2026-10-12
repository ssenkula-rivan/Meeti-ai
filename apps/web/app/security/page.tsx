import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site-config';
import { Fill } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Security',
  description: 'How Meeti protects your meetings, recordings and account.',
  alternates: { canonical: '/security' },
  openGraph: { title: 'Meeti - Security', description: 'How Meeti protects your meetings and account.', url: '/security' },
};

export default function Security() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">Meeti</Link>
          <nav className="flex gap-4 text-sm text-gray-600">
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms</Link>
            <Link href="/ai-policy" className="hover:text-gray-900">AI Policy</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold mb-6">Security</h1>
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          DRAFT — This page has not yet been reviewed by a qualified lawyer and items
          marked [SET] still need to be confirmed. Do not publish until reviewed.
        </div>
        <div className="space-y-6 leading-relaxed text-gray-800">
          <p>
            We protect your meetings with industry-standard measures across transport,
            storage and access.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Encryption in transit:</strong> all traffic between your device and our servers uses HTTPS/TLS (certificates issued by Let&apos;s Encrypt).</li>
            <li><strong>Storage:</strong> your recordings and database are hosted on Amazon Web Services (EC2) with account-level access controls. <em>Encryption of data at rest is not yet enabled</em> &mdash; we state this honestly rather than claim a protection we have not implemented.</li>
            <li><strong>Passwords:</strong> hashed with bcrypt; we never store plaintext passwords.</li>
            <li><strong>Session security:</strong> access uses signed tokens (JWT) with a 7-day expiry rather than exposing your credentials. We plan to move to short-lived access tokens with refresh-token rotation and revocation; until then we do not describe the current 7-day token as &quot;short-lived&quot;.</li>
            <li><strong>Least-privilege AI processing:</strong> audio and text are sent to OpenAI only to transcribe and summarise, and are not used to train models.</li>
            <li><strong>Access controls:</strong> your meetings are scoped to your account; you can delete any meeting at any time.</li>
          </ul>
          <p>
            No system is perfectly secure. To report a security issue, email{' '}
            <Fill value={SITE.legal.securityEmail} />.
          </p>
        </div>
      </main>
    </div>
  );
}
