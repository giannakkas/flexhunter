import React, { useEffect } from 'react';
import {
  Page, Layout, Card, Text, BlockStack, InlineStack,
  Badge, Button, Banner, ProgressBar, Divider,
  InlineGrid,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';

interface DashboardData {
  totalCandidates: number;
  totalImported: number;
  totalTesting: number;
  totalWinners: number;
  totalWeak: number;
  pendingReplacements: number;
  totalRevenue: number;
  avgHealthScore: number;
  lastResearchAt: string | null;
  lastSyncAt: string | null;
}

interface OnboardingStatus {
  isComplete: boolean;
  settings: any;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, loading, get } = useApi<DashboardData>();
  const { data: onboarding, get: getOnboarding } = useApi<OnboardingStatus>();
  const { post: startResearch, loading: researchLoading } = useApi();
  const { post: syncPerf, loading: syncLoading } = useApi();

  useEffect(() => {
    get('/dashboard');
    getOnboarding('/onboarding/status');
  }, [get, getOnboarding]);

  const handleResearch = async () => {
    await startResearch('/research/start');
    setTimeout(() => get('/dashboard'), 2000);
  };

  const handleSync = async () => {
    await syncPerf('/performance/sync');
    setTimeout(() => get('/dashboard'), 2000);
  };

  const isNew = !onboarding?.isComplete;
  const hasNoCandidates = (stats?.totalCandidates || 0) === 0;
  const hasNoImports = (stats?.totalImported || 0) === 0;

  // ── Welcome Screen for New Users ─────────────
  if (isNew && !loading) {
    return (
      <Page title="">
        <BlockStack gap="600">
          {/* Hero */}
          <Card>
            <BlockStack gap="400">
              <div style={{
                background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
                borderRadius: 12, padding: '32px 28px', color: 'white',
              }}>
                <BlockStack gap="300">
                  <Text as="h1" variant="headingXl">
                    Welcome to FlexHunter 🎯
                  </Text>
                  <Text as="p" variant="bodyLg">
                    Your AI-powered product hunter. We'll find the perfect products for your store,
                    import them, track performance, and automatically replace underperformers.
                  </Text>
                  <div style={{ paddingTop: 8 }}>
                    <Button variant="primary" size="large" onClick={() => navigate('/onboarding')}>
                      Get Started — 2 min setup →
                    </Button>
                  </div>
                </BlockStack>
              </div>
            </BlockStack>
          </Card>

          {/* Steps */}
          <InlineGrid columns={3} gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #5C6AC4, #202E78)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 'bold', fontSize: 16,
                  }}>1</div>
                  <Text as="h3" variant="headingMd">Describe Your Store</Text>
                </InlineStack>
                <Text as="p" tone="subdued">
                  Tell us about your audience, vibe, and niche.
                  This powers all product recommendations.
                </Text>
                <Button variant="primary" onClick={() => navigate('/onboarding')} fullWidth>
                  Start Setup
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#E4E5E7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#6D7175', fontWeight: 'bold', fontSize: 16,
                  }}>2</div>
                  <Text as="h3" variant="headingMd" tone="subdued">Run Research</Text>
                </InlineStack>
                <Text as="p" tone="subdued">
                  AI searches for products matching your store DNA,
                  domain identity, and target audience.
                </Text>
                <Button disabled fullWidth>Complete Step 1 First</Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#E4E5E7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#6D7175', fontWeight: 'bold', fontSize: 16,
                  }}>3</div>
                  <Text as="h3" variant="headingMd" tone="subdued">Import Winners</Text>
                </InlineStack>
                <Text as="p" tone="subdued">
                  Review scored candidates, approve the best ones,
                  and import directly to Shopify.
                </Text>
                <Button disabled fullWidth>Complete Step 2 First</Button>
              </BlockStack>
            </Card>
          </InlineGrid>

          {/* How it works */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">How It Works</Text>
              <Divider />
              <InlineGrid columns={4} gap="400">
                <BlockStack gap="100">
                  <Text as="p" variant="headingSm">🧬 Store DNA</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Your domain, description, and catalog create a unique profile.
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="headingSm">🔍 Deep Research</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Products scored across 11 dimensions including domain fit and trend.
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="headingSm">📊 Smart Testing</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Track views, conversions, and revenue automatically.
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="headingSm">🔄 Auto-Optimize</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Underperformers get replaced with better-fit products.
                  </Text>
                </BlockStack>
              </InlineGrid>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    );
  }

  // ── Active Dashboard ─────────────────────────
  if (loading || !stats) {
    return (
      <Page title="Dashboard">
        <Card><Text as="p">Loading...</Text></Card>
      </Page>
    );
  }

  const setupSteps = [
    { done: onboarding?.isComplete, label: 'Setup Complete' },
    { done: stats.totalCandidates > 0, label: 'First Research' },
    { done: stats.totalImported > 0, label: 'First Import' },
  ];
  const completedSteps = setupSteps.filter(s => s.done).length;
  const setupProgress = (completedSteps / setupSteps.length) * 100;

  return (
    <Page
      title="Dashboard"
      primaryAction={{
        content: '🔍 Run Research',
        onAction: handleResearch,
        loading: researchLoading,
      }}
      secondaryActions={[
        { content: 'Sync Performance', onAction: handleSync, loading: syncLoading },
      ]}
    >
      <BlockStack gap="500">

        {/* Progress Tracker */}
        {setupProgress < 100 && (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="h3" variant="headingMd">🎯 Getting Started</Text>
                <Badge tone={setupProgress === 100 ? 'success' : 'attention'}>
                  {completedSteps}/{setupSteps.length}
                </Badge>
              </InlineStack>
              <ProgressBar progress={setupProgress} tone="primary" size="small" />
              <InlineStack gap="400">
                {setupSteps.map((step, i) => (
                  <InlineStack key={i} gap="100" blockAlign="center">
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: step.done ? '#008060' : '#E4E5E7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 11, fontWeight: 'bold',
                    }}>{step.done ? '✓' : ''}</div>
                    <Text as="span" variant="bodySm" tone={step.done ? undefined : 'subdued'}>
                      {step.label}
                    </Text>
                  </InlineStack>
                ))}
              </InlineStack>
              {hasNoCandidates && (
                <Button variant="primary" onClick={handleResearch} loading={researchLoading}>
                  Run Your First Research →
                </Button>
              )}
              {!hasNoCandidates && hasNoImports && (
                <Button variant="primary" onClick={() => navigate('/candidates')}>
                  Review & Import Candidates →
                </Button>
              )}
            </BlockStack>
          </Card>
        )}

        {/* Alerts */}
        {stats.pendingReplacements > 0 && (
          <Banner
            title={`${stats.pendingReplacements} product(s) need attention`}
            tone="warning"
            action={{ content: 'Review', onAction: () => navigate('/replacements') }}
          />
        )}

        {/* Stat Cards */}
        <InlineGrid columns={3} gap="400">
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/candidates')}>
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">🔎 Candidates</Text>
                <Text as="p" variant="heading2xl">{stats.totalCandidates}</Text>
                <Text as="p" variant="bodySm" tone="subdued">products found</Text>
              </BlockStack>
            </Card>
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/imports')}>
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">📦 Imported</Text>
                <Text as="p" variant="heading2xl">{stats.totalImported}</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {stats.totalTesting} testing · {stats.totalWinners} winners
                </Text>
              </BlockStack>
            </Card>
          </div>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">💰 Revenue</Text>
              <Text as="p" variant="heading2xl">${stats.totalRevenue.toFixed(2)}</Text>
              <Text as="p" variant="bodySm" tone="subdued">from imported products</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Pipeline + Health */}
        <InlineGrid columns={2} gap="400">
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">📊 Product Pipeline</Text>
              <Divider />
              {[
                { label: 'Testing', count: stats.totalTesting, color: '#FFC453', tone: 'attention' as const },
                { label: 'Winners', count: stats.totalWinners, color: '#008060', tone: 'success' as const },
                { label: 'Weak', count: stats.totalWeak, color: '#D72C0D', tone: 'critical' as const },
                { label: 'Pending Replacement', count: stats.pendingReplacements, color: '#9C6ADE', tone: 'warning' as const },
              ].map((item) => (
                <InlineStack key={item.label} align="space-between">
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    <Text as="span">{item.label}</Text>
                  </InlineStack>
                  <Badge tone={item.tone}>{item.count}</Badge>
                </InlineStack>
              ))}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">❤️ Catalog Health</Text>
              <Divider />
              <InlineStack align="space-between">
                <Text as="span">Health Score</Text>
                <Text as="span" variant="headingLg" fontWeight="bold">{stats.avgHealthScore}/100</Text>
              </InlineStack>
              <ProgressBar
                progress={stats.avgHealthScore}
                tone={stats.avgHealthScore >= 60 ? 'success' : stats.avgHealthScore >= 30 ? 'highlight' : 'critical'}
                size="small"
              />
              <div style={{
                padding: '12px 16px', borderRadius: 8,
                background: stats.avgHealthScore >= 60 ? '#F1F8F5'
                  : stats.avgHealthScore >= 30 ? '#FFF8E6'
                  : stats.avgHealthScore > 0 ? '#FFF4F4' : '#F6F6F7',
              }}>
                <Text as="p" variant="bodySm">
                  {stats.avgHealthScore >= 60 ? '✅ Catalog performing well!'
                    : stats.avgHealthScore >= 30 ? '⚡ Room for improvement — run research for fresh candidates.'
                    : stats.avgHealthScore > 0 ? '🔴 Products need attention. Check replacement queue.'
                    : '📋 No data yet. Import products to start tracking.'}
                </Text>
              </div>
              <Divider />
              <Text as="p" variant="bodySm" tone="subdued">
                Last research: {stats.lastResearchAt ? new Date(stats.lastResearchAt).toLocaleDateString() : 'Never'}
                {' · '}
                Last sync: {stats.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleDateString() : 'Never'}
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Quick Actions */}
        <InlineGrid columns={3} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">🔬 Research Console</Text>
              <Text as="p" variant="bodySm" tone="subdued">Store DNA, domain analysis, trigger research.</Text>
              <Button onClick={() => navigate('/research')} fullWidth>Open</Button>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">⚙️ Automation</Text>
              <Text as="p" variant="bodySm" tone="subdued">Replacement mode, thresholds, test rules.</Text>
              <Button onClick={() => navigate('/settings')} fullWidth>Configure</Button>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">📜 Audit Log</Text>
              <Text as="p" variant="bodySm" tone="subdued">Every decision explained and logged.</Text>
              <Button onClick={() => navigate('/audit')} fullWidth>View</Button>
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
