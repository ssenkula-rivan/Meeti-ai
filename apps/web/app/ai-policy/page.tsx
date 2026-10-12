import LegalLayout from '../../components/LegalLayout';
import { Fill } from '@/components/legal';
import { SITE } from '@/lib/site-config';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Policy',
  description: 'How Meeti uses artificial intelligence, its limits, and your responsibilities.',
  alternates: { canonical: '/ai-policy' },
  openGraph: { title: 'Meeti - AI Policy', description: 'How Meeti uses AI, its limits, and your responsibilities.', url: '/ai-policy' },
};

export default function AIPolicy() {
  return (
    <LegalLayout
      title="AI Policy"
      updated="11 October 2026"
      notice="DRAFT — This policy has not yet been reviewed by a qualified lawyer and items marked [SET] still need to be confirmed. Do not publish until reviewed."
    >
      <p>
        This policy explains how Meeti uses artificial intelligence, what data it
        processes, its limits, and your responsibilities. It forms part of our{' '}
        <a href="/terms" className="text-blue-600 underline">Terms of Service</a>{' '}
        and <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a>.
      </p>

      <h2 className="text-xl font-semibold pt-4">1. What our AI does</h2>
      <p>
        Meeti uses AI to convert meeting audio into text (transcription), detect the
        spoken language, and generate summaries, key points, decisions, action items,
        deadlines, and translations. AI output is a draft for you to review and edit.
      </p>

      <h2 className="text-xl font-semibold pt-4">2. AI providers and processing</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          Transcription and language detection are performed by a
          <strong> speech-to-text model provided by OpenAI</strong>.
        </li>
        <li>
          Summarisation, analysis and translation are performed by a
          <strong> large-language model provided by OpenAI</strong>.
        </li>
        <li>
          We may change the specific underlying models over time as providers
          retire or replace them; the provider and the processing described here
          stay the same.
        </li>
        <li>
          Your audio and transcript text are sent to OpenAI only to produce these
          results for you.
        </li>
        <li>
          Processing location: OpenAI&apos;s cloud infrastructure, primarily in the{' '}
          <strong>United States</strong>.
        </li>
        <li>
          Under our OpenAI API agreement, content submitted through the API is{' '}
          <strong>not used by OpenAI to train its models</strong> and is not retained
          beyond the period OpenAI&apos;s API data-retention policy allows.
        </li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">3. Your data is not used for AI training</h2>
      <p>
        We do not use your recordings, transcripts or notes to train third-party AI
        models, and we do not sell your content. AI processing happens solely to
        deliver the features you request.
      </p>

      <h2 className="text-xl font-semibold pt-4">4. Accuracy limits</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>AI output can be wrong: misheard words, wrong or missing action items, invented details, and incorrect deadlines.</li>
        <li>Accuracy is lower for noisy audio, overlapping speakers, accents, and code-switching between languages.</li>
        <li>Automatic language detection can misidentify the language.</li>
        <li>
          Some languages advertised in the app are low-resource and may be unsupported
          or noticeably less accurate. Our speech-to-text provider reliably supports
          major world languages (for example English and Swahili); accuracy and support for{' '}
          <strong>Luganda, Runyankole, Rukiga, Ateso, Luo and Acholi</strong> vary and
          may be limited. Do not rely on output for these languages without checking
          the recording.
        </li>
        <li>You must review AI output before relying on it, especially for legal, medical, financial, employment or safety decisions.</li>
        <li>Meeti is not a substitute for official minutes or professional advice.</li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">5. Human oversight</h2>
      <p>
        AI results are drafts you can edit. Our staff do not listen to your recordings
        unless you request support or a security/abuse investigation requires it.
      </p>

      <h2 className="text-xl font-semibold pt-4">6. Recording consent (your responsibility)</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>You must have the legal right to record every meeting you upload or capture.</li>
        <li>You must inform participants and obtain any consent the law requires before recording.</li>
        <li>Do not record private conversations without consent.</li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">7. Prohibited AI uses</h2>
      <p>You may not use Meeti to:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>record or process people unlawfully or without required consent;</li>
        <li>generate content to harass, defraud or deceive;</li>
        <li>process unlawful content, or content that exploits children;</li>
        <li>attempt to extract, reverse-engineer or abuse our models or providers;</li>
        <li>make solely automated decisions with legal or similarly significant effect on a person.</li>
      </ul>

      <h2 className="text-xl font-semibold pt-4">8. Third-party exports</h2>
      <p>
        When you export to Google Drive, Gmail, Google Calendar or Slack, you authorise
        Meeti to send that content to the service you choose. Those services&apos; own
        terms and privacy policies apply.
      </p>

      <h2 className="text-xl font-semibold pt-4">9. Reporting AI problems</h2>
      <p>
        Report errors, harmful output or privacy concerns to{' '}
        <Fill value={SITE.legal.supportEmail} />. We aim to respond within{' '}
        <Fill value={SITE.legal.responseTime} />.
      </p>
    </LegalLayout>
  );
}
