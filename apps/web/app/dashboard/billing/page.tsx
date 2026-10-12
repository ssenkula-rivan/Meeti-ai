'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { billingApi, authApi, type UsageSummary } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { Card, PageHeader, Badge } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_annual: number;
  features: string[];
}

function AllowanceBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const remaining = Math.max(0, Math.round((limit - used) * 100) / 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {used} / {limit} · {remaining} left
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, subRes, summaryRes, profileRes] = await Promise.all([
        billingApi.getPlans(),
        billingApi.getSubscription().catch(() => null),
        billingApi.getUsageSummary().catch(() => null),
        authApi.getProfile().catch(() => null),
      ]);
      setPlans(plansRes.data || []);
      setSubscription(subRes?.data || null);
      setSummary(summaryRes?.data || null);
      setProfile(profileRes?.data ?? null);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Upgrade does not self-activate; the server enforces payment.
  const handleUpgrade = async (plan: Plan) => {
    setBusyPlan(plan.id);
    setMessage(null);
    try {
      await billingApi.startCheckout(plan.id);
      // Would redirect if a payment provider were configured.
      setMessage({ tone: 'info', text: 'Redirecting to secure checkout…' });
    } catch (err: any) {
      const text =
        err?.response?.data?.error ||
        'Online payments are not enabled on this server yet, so paid plans cannot be activated. Your free manual notes remain fully available.';
      setMessage({ tone: 'error', text });
    } finally {
      setBusyPlan(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    setBusyPlan('cancel');
    try {
      await billingApi.cancelSubscription();
      await loadData();
      setMessage({ tone: 'info', text: 'Subscription cancelled. You keep access until the end of the period.' });
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.response?.data?.error || 'Failed to cancel subscription' });
    } finally {
      setBusyPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm font-medium text-muted-foreground">Loading billing information…</div>
      </div>
    );
  }

  const isPaid = subscription?.status === 'active' && subscription?.source === 'subscription';
  const currentSlug = summary?.plan.slug || subscription?.plan_slug || 'free';

  return (
    <AppShell userName={profile?.profile?.full_name} userEmail={profile?.user?.email}>
      <div className="space-y-8">
        <PageHeader
          title="Billing & Plans"
          subtitle="Your plan, usage this month, and what upgrades include."
        />

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.tone === 'error'
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-border bg-muted text-foreground'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Current plan + usage */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Current plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary?.plan.name || 'Free'}
                {summary ? ` · $${summary.plan.priceMonthly}/month` : ''}
              </p>
            </div>
            <Badge tone={isPaid ? 'success' : 'muted'}>{isPaid ? 'Paid' : 'Free'}</Badge>
          </div>

          {summary ? (
            <div className="space-y-4">
              <AllowanceBar
                label="AI transcription minutes (this month)"
                used={summary.transcriptionMinutes.used}
                limit={summary.transcriptionMinutes.limit}
              />
              <AllowanceBar
                label="Exports (this month)"
                used={summary.exports.used}
                limit={summary.exports.limit}
              />
              <p className="text-xs text-muted-foreground">
                Manual notes and template formatting are always free and unlimited — they don&apos;t use
                the AI allowance above. AI features work only when the transcription service is
                configured and has credit.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Usage summary unavailable.</p>
          )}

          {isPaid && (
            <div className="mt-4">
              <button
                onClick={handleCancel}
                disabled={busyPlan === 'cancel'}
                className="rounded-lg border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
              >
                {busyPlan === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
              </button>
            </div>
          )}
        </Card>

        {/* Plans */}
        <div>
          <h2 className="mb-4 text-xl font-bold text-foreground">Choose a plan</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.slug === currentSlug;
              const isFree = Number(plan.price_monthly) === 0;
              return (
                <Card
                  key={plan.id}
                  className={`flex flex-col p-6 ${isCurrent ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    {isCurrent && <Badge tone="primary">Current</Badge>}
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-foreground">
                      {isFree ? 'Free' : `$${plan.price_monthly}`}
                    </span>
                    {!isFree && <span className="text-muted-foreground">/month</span>}
                  </div>
                  <ul className="mb-6 flex-1 space-y-2">
                    {(plan.features || []).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-0.5 text-success">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={isCurrent || busyPlan === plan.id}
                    className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                      isCurrent
                        ? 'cursor-not-allowed bg-muted text-muted-foreground'
                        : isFree
                          ? 'border border-border text-foreground hover:bg-muted'
                          : 'bg-primary text-primary-foreground hover:opacity-90'
                    }`}
                  >
                    {isCurrent
                      ? 'Current plan'
                      : busyPlan === plan.id
                        ? 'Checking…'
                        : isFree
                          ? 'Stay on Free'
                          : 'Upgrade'}
                  </button>
                </Card>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Upgrading requires a completed payment. Secure checkout is not enabled on this server
            yet, so paid plans cannot be activated — no payment details are collected here, and
            nothing is charged automatically.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
