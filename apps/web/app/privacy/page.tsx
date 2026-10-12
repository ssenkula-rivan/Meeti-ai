import LegalLayout from '../../components/LegalLayout';
import { Fill } from '@/components/legal';
import { SITE } from '@/lib/site-config';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Meeti collects, uses and protects your personal data.',
  alternates: { canonical: '/privacy' },
  openGraph: { title: 'Meeti - Privacy Policy', description: 'How Meeti collects, uses and protects your personal data.', url: '/privacy' },
};

export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updated="11 October 2026"
      notice="DRAFT — This policy has not yet been reviewed by a qualified lawyer and items marked [SET] still need to be confirmed. Do not publish until reviewed."
    >
      <p>
        This Privacy Policy explains how Meeti (&quot;we&quot;, &quot;us&quot;) collects,
        uses and protects your personal data when you use our web, iPhone and Android
        apps at <a href="https://meeti.org.uk" className="text-blue-600 underline">meeti.org.uk</a>.
        It should be read with our{' '}
        <a href="/terms" className="text-blue-600 underline">Terms of Service</a> and{' '}
        <a href="/ai-policy" className="text-blue-600 underline">AI Policy</a>.
      </p>

      <h2 className="text-xl font-semibold pt-4">1. Who we are</h2>
      <p>
        Meeti is operated by <strong>{SITE.legal.entityName}</strong>, of {SITE.legal.address}.
        Company registration number: <Fill value={SITE.legal.registrationNumber} />. Data
        protection contact: <Fill value={SITE.legal.privacyEmail} />.
      </p>

      <h2 className="text-xl font-semibold pt-4">2. Data we collect</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Account data:</strong> your email address and password (stored only as a bcrypt hash).</li>
        <li><strong>Profile data:</strong> any details you choose to add, such as your name, country, timezone and language preferences.</li>
        <li><strong>Meeting content:</strong> audio recordings you upload or capture, and the transcripts, summaries, decisions and action items generated from them.</li>
        <li><strong>Usage metadata:</strong> meeting titles, dates, detected language and processing status.</li>
        <li><strong>Analytics:</strong> we do not use third-party analytics or advertising trackers.</li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">3. How we use your data and legal basis</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>To provide transcription, AI summaries, task tracking and exports &mdash; performance of a contract.</li>
        <li>To authenticate you and secure your account &mdash; legitimate interest / contract.</li>
        <li>To comply with law and prevent abuse &mdash; legal obligation / legitimate interest.</li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">4. Who we share your data with</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>OpenAI</strong> &mdash; to transcribe audio and to generate summaries and translations. See our AI Policy.</li>
        <li><strong>Amazon Web Services (AWS)</strong> &mdash; our hosting provider. The application server, the PostgreSQL database and your audio recordings are stored on AWS infrastructure.</li>
        <li><strong>Google</strong> (Drive, Gmail, Calendar) and <strong>Slack</strong> &mdash; only if you connect them and choose to export content.</li>
        <li><strong>Payments:</strong> we do not currently process payments; paid checkout is not active, so no card or payment data is collected.</li>
        <li>We do not sell your personal data.</li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">5. International transfers</h2>
      <p>
        Your data is stored and processed on AWS servers in the <strong>United States</strong>{' '}
        (region us-east-1), and AI requests are processed by OpenAI in the{' '}
        <strong>United States</strong>. If you are in Uganda or elsewhere, this means your
        data is transferred outside your country.{' '}
        <Fill value={SITE.legal.dataTransferSafeguards} />.
      </p>

      <h2 className="text-xl font-semibold pt-4">6. Retention</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>We keep your recordings and notes until you delete them or delete your account.</li>
        <li>You can delete an individual meeting at any time in the app; this also removes that meeting&apos;s stored audio.</li>
        <li>You can permanently delete your account and all associated data from Settings &gt; Delete Account (you will be asked to confirm your password).</li>
        <li>We may retain limited data where the law requires it.</li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">7. Your rights</h2>
      <p>
        Subject to applicable law, you can request access, correction, deletion,
        objection, data portability, and withdrawal of consent. You can exercise most of
        these directly in the app (editing your profile, deleting meetings, deleting your
        account). For anything else, contact{' '}
        <Fill value={SITE.legal.privacyEmail} />. You also have the right to
        complain to a data protection authority &mdash; see section 10.
      </p>

      <h2 className="text-xl font-semibold pt-4">8. Security</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>All traffic between your device and our servers is encrypted in transit using HTTPS/TLS.</li>
        <li>Passwords are hashed with bcrypt and are never stored in plain text.</li>
        <li>Access to the app uses signed tokens (JWT) rather than exposing your credentials.</li>
        <li>
          <strong>Honest limitation:</strong> encryption of data at rest (on the storage
          volume and database) is <Fill value={SITE.legal.dataAtRestEncryption} />,
          and no method of transmission or storage is perfectly secure.
        </li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">9. Children</h2>
      <p>
        Meeti is intended for adults. We propose a minimum age of{' '}
        <Fill value={SITE.legal.ageLimit} /> and do not knowingly collect data from
        children.
      </p>

      <h2 className="text-xl font-semibold pt-4">10. Complaints and regulator</h2>
      <p>
        You may complain to the data protection authority in your country. For users in
        Uganda this is the <strong>Personal Data Protection Office</strong> (under the Data
        Protection and Privacy Act, 2019); for UK users, the{' '}
        <strong>Information Commissioner&apos;s Office (ICO)</strong>.{' '}
        <Fill value={SITE.legal.dataControllerRegistration} />.
      </p>

      <h2 className="text-xl font-semibold pt-4">11. Changes</h2>
      <p>
        We may update this policy. Material changes will be noticed on this page or, once a
        contact address is available, by email.
      </p>
    </LegalLayout>
  );
}
