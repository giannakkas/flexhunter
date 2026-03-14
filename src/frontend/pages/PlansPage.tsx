import { friendlyError } from '../utils/errors';
import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  InlineGrid, Banner, Divider,
} from '@shopify/polaris';
import { apiFetch } from '../hooks/useApi';

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    icon: '🆓',
    color: '#6B7280',
    features: ['3 research runs / month', '5 product imports', 'Basic scoring', 'SEO optimizer'],
    cta: 'Current Plan',
  },
  {
    key: 'starter',
    name: 'Starter',
    price: 19.99,
    icon: '🚀',
    color: '#3B82F6',
    popular: false,
    features: ['20 research runs / month', '50 product imports', '6-agent AI scoring', 'Viral prediction', 'SEO optimizer', 'Performance tracking'],
    cta: 'Upgrade',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 49.99,
    icon: '⚡',
    color: '#8B5CF6',
    popular: true,
    features: ['Unlimited research', 'Unlimited imports', '6-agent AI scoring', 'Viral prediction', 'Auto-replacement engine', 'SEO optimizer', 'Performance tracking', 'Priority support'],
    cta: 'Go Pro',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 99.99,
    icon: '🏢',
    color: '#059669',
    features: ['Everything in Pro', 'Multi-store support', 'Custom AI training', 'White-glove onboarding', 'Dedicated account manager', 'API access'],
    cta: 'Contact Sales',
  },
];

export function PlansPage() {
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<any>('/billing/plan').then(r => setCurrentPlan(r.data?.plan || 'free')).catch(() => {});
  }, []);

  const handleSubscribe = async (planKey: string) => {
    if (planKey === 'free' || planKey === currentPlan) return;
    setLoading(planKey);
    try {
      const r = await apiFetch<any>('/billing/subscribe', {
        method: 'POST',
        body: JSON.stringify({ plan: planKey }),
      });
      if (r.data?.confirmationUrl) {
        window.top?.location.assign(r.data.confirmationUrl);
      } else {
        setMessage(r.error || 'Failed to create subscription');
      }
    } catch (e: any) {
      setMessage(friendlyError(e.message));
    }
    setLoading(null);
  };

  return (
    <Page title="Plans & Pricing" subtitle="Choose the plan that fits your business">
      <BlockStack gap="400">
        {message && <Banner tone="critical" onDismiss={() => setMessage(null)}><Text as="p">{message}</Text></Banner>}

        <InlineGrid columns={4} gap="300">
          {PLANS.map(plan => {
            const isCurrent = plan.key === currentPlan;
            return (
              <div key={plan.key} style={{
                borderRadius: 16, border: plan.popular ? `2px solid ${plan.color}` : '1px solid #E5E7EB',
                background: 'white', overflow: 'hidden', position: 'relative',
                boxShadow: plan.popular ? `0 4px 20px ${plan.color}25` : 'none',
              }}>
                {plan.popular && (
                  <div style={{ background: plan.color, color: 'white', textAlign: 'center', padding: '4px 0', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ padding: '24px 20px' }}>
                  <BlockStack gap="400">
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{plan.icon}</div>
                      <Text as="h2" variant="headingLg">{plan.name}</Text>
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 36, fontWeight: 800, color: '#111827' }}>
                          ${plan.price}
                        </span>
                        {plan.price > 0 && <span style={{ fontSize: 14, color: '#6B7280' }}>/mo</span>}
                      </div>
                    </div>

                    <Divider />

                    <BlockStack gap="200">
                      {plan.features.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ color: '#10B981', fontSize: 14, lineHeight: '20px' }}>✓</span>
                          <Text as="p" variant="bodySm">{f}</Text>
                        </div>
                      ))}
                    </BlockStack>

                    <button
                      onClick={() => handleSubscribe(plan.key)}
                      disabled={isCurrent || loading === plan.key}
                      style={{
                        width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        border: isCurrent ? '2px solid #10B981' : 'none', cursor: isCurrent ? 'default' : 'pointer',
                        background: isCurrent ? '#ECFDF5' : plan.popular ? plan.color : '#F3F4F6',
                        color: isCurrent ? '#10B981' : plan.popular ? 'white' : '#374151',
                        opacity: loading === plan.key ? 0.6 : 1,
                      }}
                    >
                      {isCurrent ? '✓ Current Plan' : loading === plan.key ? 'Redirecting...' : plan.cta}
                    </button>
                  </BlockStack>
                </div>
              </div>
            );
          })}
        </InlineGrid>

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
