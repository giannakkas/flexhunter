import React from 'react';
import { Page, Card, BlockStack, Text, Button, InlineStack, Divider } from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';

export function OnboardingPage() {
  const navigate = useNavigate();

  return (
    <Page>
      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px' }}>
        <Card>
          <BlockStack gap="600">
            {/* Logo & Welcome */}
            <div style={{ textAlign: 'center', paddingTop: 10 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔬</div>
              <Text as="h1" variant="headingXl">Welcome to FlexHunter</Text>
              <div style={{ height: 8 }} />
              <Text as="p" variant="bodyLg" tone="subdued">
                AI-powered product discovery that finds winning products before your competitors.
              </Text>
            </div>

            <Divider />

            {/* Steps */}
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">How it works — 3 simple steps:</Text>

              {[
                { step: '1', icon: '🧬', title: 'Describe Your Store', desc: 'Tell our AI what you sell and who your customers are. Just 3 simple fields.', color: '#5C6AC4' },
                { step: '2', icon: '🔬', title: 'AI Finds Products', desc: '6 specialized AI agents search live suppliers, score products, and filter for your niche.', color: '#007ACE' },
                { step: '3', icon: '🚀', title: 'Import & Optimize', desc: 'Select winners, import to Shopify with one click, then optimize SEO for traffic.', color: '#008060' },
              ].map(s => (
                <div key={s.step} style={{
                  display: 'flex', gap: 16, padding: '16px 20px', borderRadius: 12,
                  background: `${s.color}06`, border: `1px solid ${s.color}20`,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: s.color, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 700,
                  }}>{s.icon}</div>
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="bold">Step {s.step}: {s.title}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">{s.desc}</Text>
                  </div>
                </div>
              ))}
            </BlockStack>

            <Divider />

            {/* CTA */}
            <div style={{ textAlign: 'center', paddingBottom: 10 }}>
              <Button variant="primary" size="large" onClick={() => navigate('/research')}>
                🧬 Set Up Your Store DNA
              </Button>
              <div style={{ height: 8 }} />
              <Text as="p" variant="bodySm" tone="subdued">Takes about 30 seconds</Text>
            </div>
          </BlockStack>
        </Card>
      </div>
    </Page>
  );
}
