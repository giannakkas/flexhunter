import React, { useEffect } from 'react';
import {
  Page, Layout, Card, Text, BlockStack, InlineStack,
  Badge, Button, Banner, ProgressBar, Divider,
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

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, loading, get } = useApi<DashboardData>();
  const { post: startResearch, loading: researchLoading } = useApi();
  const { post: syncPerf, loading: syncLoading } = useApi();

  useEffect(() => {
    get('/dashboard');
  }, [get]);

  const handleResearch = async () => {
    await startResearch('/research/start');
    setTimeout(() => get('/dashboard'), 2000);
  };

  const handleSync = async () => {
    await syncPerf('/performance/sync');
    setTimeout(() => get('/dashboard'), 2000);
  };

  if (loading || !stats) {
    return (
      <Page title="Dashboard">
        <Card><BlockStack gap="400"><Text as="p">Loading dashboard...</Text></BlockStack></Card>
      </Page>
    );
  }

  return (
    <Page
      title="FlexHunter Dashboard"
      subtitle="Intelligent Product Hunter & Catalog Optimizer"
      primaryAction={{
        content: 'Run Research',
        onAction: handleResearch,
        loading: researchLoading,
      }}
      secondaryActions={[
        { content: 'Sync Performance', onAction: handleSync, loading: syncLoading },
      ]}
    >
      <Layout>
        {stats.pendingReplacements > 0 && (
          <Layout.Section>
            <Banner
              title={`${stats.pendingReplacements} replacement(s) pending review`}
              tone="warning"
              action={{ content: 'Review', onAction: () => navigate('/replacements') }}
            >
              <Text as="p">
                Some products have been flagged for replacement. Review them to keep your catalog optimized.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineStack gap="400" wrap>
            <StatCard label="Candidates" value={stats.totalCandidates} tone="info" />
            <StatCard label="Imported" value={stats.totalImported} />
            <StatCard label="Testing" value={stats.totalTesting} tone="attention" />
            <StatCard label="Winners" value={stats.totalWinners} tone="success" />
            <StatCard label="Weak" value={stats.totalWeak} tone="critical" />
            <StatCard label="Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} tone="success" />
          </InlineStack>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Catalog Health</Text>
              <Divider />
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span">Average Health Score</Text>
                  <Badge tone={stats.avgHealthScore >= 60 ? 'success' : stats.avgHealthScore >= 30 ? 'warning' : 'critical'}>
                    {stats.avgHealthScore}/100
                  </Badge>
                </InlineStack>
                <ProgressBar progress={stats.avgHealthScore} tone={stats.avgHealthScore >= 60 ? 'success' : 'critical'} size="small" />
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" tone="subdued">
                  Last research: {stats.lastResearchAt ? new Date(stats.lastResearchAt).toLocaleDateString() : 'Never'}
                </Text>
                <Text as="span" tone="subdued">
                  Last sync: {stats.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleDateString() : 'Never'}
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Quick Actions</Text>
              <Divider />
              <BlockStack gap="300">
                <Button onClick={() => navigate('/research')} variant="primary" fullWidth>
                  Open Research Console
                </Button>
                <Button onClick={() => navigate('/candidates')} fullWidth>
                  Browse Candidates ({stats.totalCandidates})
                </Button>
                <Button onClick={() => navigate('/settings')} fullWidth>
                  Automation Settings
                </Button>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: any }) {
  return (
    <Card>
      <BlockStack gap="100" inlineAlign="center">
        <Text as="p" tone="subdued" variant="bodySm">{label}</Text>
        <Text as="p" variant="headingLg" fontWeight="bold">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Text>
        {tone && <Badge tone={tone}>{label}</Badge>}
      </BlockStack>
    </Card>
  );
}
