import React, { useEffect, useState, useRef } from 'react';
import {
  Page, Card, Text, BlockStack, InlineStack,
  Badge, Button, Banner, ProgressBar, Divider,
  InlineGrid, EmptyState, Spinner,
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

// ── Animated Number Component ──────────────────
function OdometerNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 800;
    const start = display;
    const diff = value - start;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span style={{
      fontFamily: "'SF Mono', 'Roboto Mono', 'Courier New', monospace",
      fontSize: 32,
      fontWeight: 700,
      letterSpacing: '-0.5px',
      lineHeight: 1,
    }}>
      {prefix}{typeof value === 'number' && value % 1 !== 0 ? display.toFixed(2) : display.toLocaleString()}{suffix}
    </span>
  );
}

// ── Research Progress Component ────────────────
function ResearchProgress({ shopId, onComplete }: { shopId: string; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Starting research pipeline...');
  const { get } = useApi<any>();
  const intervalRef = useRef<any>(null);

  const stages = [
    { at: 5, text: 'Analyzing store DNA...' },
    { at: 15, text: 'Scanning domain identity...' },
    { at: 25, text: 'Loading merchant preferences...' },
    { at: 35, text: 'Searching product providers...' },
    { at: 50, text: 'Fetching candidate products...' },
    { at: 60, text: 'Normalizing product data...' },
    { at: 70, text: 'Running 11-dimension scoring...' },
    { at: 80, text: 'AI analyzing product fit...' },
    { at: 90, text: 'Ranking and saving candidates...' },
    { at: 95, text: 'Generating explanations...' },
    { at: 100, text: 'Research complete!' },
  ];

  useEffect(() => {
    // Simulate progress + poll real status
    let currentProgress = 0;

    intervalRef.current = setInterval(() => {
      currentProgress += Math.random() * 4 + 1;
      if (currentProgress > 98) currentProgress = 98;

      setProgress(Math.min(currentProgress, 98));

      const stage = [...stages].reverse().find(s => currentProgress >= s.at);
      if (stage) setStatus(stage.text);
    }, 600);

    // Also poll the actual job status
    const pollJob = setInterval(async () => {
      const result = await get('/research/status');
      if (result && (result as any).status === 'COMPLETED') {
        setProgress(100);
        setStatus('Research complete! Found new candidates.');
        clearInterval(intervalRef.current);
        clearInterval(pollJob);
        setTimeout(onComplete, 1500);
      } else if (result && (result as any).status === 'FAILED') {
        setStatus('Research encountered an issue. Check logs.');
        clearInterval(intervalRef.current);
        clearInterval(pollJob);
        setTimeout(onComplete, 2000);
      }
    }, 3000);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(pollJob);
    };
  }, []);

  const isComplete = progress >= 100;

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            {!isComplete && <Spinner size="small" />}
            <Text as="h3" variant="headingMd">
              {isComplete ? '✅' : '🔬'} Product Research
            </Text>
          </InlineStack>
          <Text as="span" variant="headingSm" fontWeight="bold">
            {Math.round(progress)}%
          </Text>
        </InlineStack>
        <div style={{
          height: 8, borderRadius: 4, overflow: 'hidden',
          background: '#E4E5E7',
        }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: isComplete
              ? 'linear-gradient(90deg, #008060, #00B386)'
              : 'linear-gradient(90deg, #5C6AC4, #7C8AE4)',
            width: `${progress}%`,
            transition: 'width 0.5s ease-out',
          }} />
        </div>
        <Text as="p" variant="bodySm" tone="subdued">{status}</Text>
      </BlockStack>
    </Card>
  );
}

// ── Stat Card Component ────────────────────────
function StatCard({ label, value, prefix, suffix, sub, color, onClick }: {
  label: string; value: number; prefix?: string; suffix?: string;
  sub?: string; color: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <Card>
        <BlockStack gap="200">
          <InlineStack gap="200" blockAlign="center">
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: color,
            }} />
            <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
          </InlineStack>
          <OdometerNumber value={value} prefix={prefix} suffix={suffix} />
          {sub && <Text as="p" variant="bodySm" tone="subdued">{sub}</Text>}
        </BlockStack>
      </Card>
    </div>
  );
}

// ── Health Gauge Component ─────────────────────
function HealthGauge({ score }: { score: number }) {
  const color = score >= 60 ? '#008060' : score >= 30 ? '#B98900' : score > 0 ? '#D72C0D' : '#8C9196';
  const rotation = (score / 100) * 180 - 90;

  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Background arc */}
        <path d="M 10 75 A 60 60 0 0 1 130 75" fill="none" stroke="#E4E5E7" strokeWidth="10" strokeLinecap="round" />
        {/* Score arc */}
        <path d="M 10 75 A 60 60 0 0 1 130 75" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 188.5} 188.5`} />
        {/* Score text */}
        <text x="70" y="68" textAnchor="middle" fill={color} fontSize="24" fontWeight="bold"
          fontFamily="'SF Mono', monospace">{score}</text>
        <text x="70" y="78" textAnchor="middle" fill="#8C9196" fontSize="9">/100</text>
      </svg>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, loading, get } = useApi<DashboardData>();
  const { data: onboarding, get: getOnboarding } = useApi<OnboardingStatus>();
  const { post: startResearch, loading: researchLoading } = useApi();
  const { post: syncPerf, loading: syncLoading } = useApi();
  const [showResearchProgress, setShowResearchProgress] = useState(false);

  useEffect(() => {
    get('/dashboard');
    getOnboarding('/onboarding/status');
  }, [get, getOnboarding]);

  const handleResearch = async () => {
    setShowResearchProgress(true);
    const result = await startResearch('/research/start');
    // If research ran synchronously, it returns data directly
    if (result?.data) {
      setShowResearchProgress(false);
      get('/dashboard');
    }
  };

  const handleResearchComplete = () => {
    setShowResearchProgress(false);
    get('/dashboard');
  };

  const handleSync = async () => {
    await syncPerf('/performance/sync');
    setTimeout(() => get('/dashboard'), 1500);
  };

  const isNew = !onboarding?.isComplete;
  const hasNoCandidates = (stats?.totalCandidates || 0) === 0;
  const hasNoImports = (stats?.totalImported || 0) === 0;

  // ── Welcome Screen ───────────────────────────
  if (isNew && !loading) {
    return (
      <Page title="">
        <BlockStack gap="500">
          <Card>
            <div style={{
              background: 'linear-gradient(135deg, #0D1117 0%, #161B22 40%, #1A2332 100%)',
              borderRadius: 12, padding: '36px 32px', color: 'white',
            }}>
              <BlockStack gap="300">
                <div style={{ fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', color: '#58A6FF', fontWeight: 600 }}>
                  PRODUCT INTELLIGENCE
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
                  Welcome to FlexHunter
                </div>
                <div style={{ fontSize: 15, color: '#8B949E', lineHeight: 1.5, maxWidth: 600 }}>
                  Describe your store, sit back, and watch the magic happen. Our AI finds
                  the perfect products, imports them, tracks performance, and replaces underperformers.
                </div>
                <div style={{ paddingTop: 12 }}>
                  <Button variant="primary" size="large" onClick={() => navigate('/onboarding')}>
                    Get Started — 2 min setup
                  </Button>
                </div>
              </BlockStack>
            </div>
          </Card>

          <InlineGrid columns={3} gap="400">
            {[
              { n: '01', title: 'Describe Your Store', desc: 'Tell us your audience, vibe, and niche.', active: true },
              { n: '02', title: 'Run Research', desc: 'AI searches for matching products.', active: false },
              { n: '03', title: 'Import Winners', desc: 'Approve and import to Shopify.', active: false },
            ].map((step) => (
              <Card key={step.n}>
                <BlockStack gap="200">
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: step.active ? '#5C6AC4' : '#8C9196',
                    letterSpacing: 1.5,
                  }}>STEP {step.n}</div>
                  <Text as="h3" variant="headingSm">{step.title}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{step.desc}</Text>
                  {step.active ? (
                    <Button variant="primary" onClick={() => navigate('/onboarding')} fullWidth size="slim">
                      Start
                    </Button>
                  ) : (
                    <Button disabled fullWidth size="slim">Locked</Button>
                  )}
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>
        </BlockStack>
      </Page>
    );
  }

  if (loading || !stats) {
    return <Page title="Dashboard"><Card><Spinner /></Card></Page>;
  }

  const setupSteps = [
    { done: onboarding?.isComplete, label: 'Setup' },
    { done: stats.totalCandidates > 0, label: 'Research' },
    { done: stats.totalImported > 0, label: 'Import' },
  ];
  const completedSteps = setupSteps.filter(s => s.done).length;

  return (
    <Page title="">
      <BlockStack gap="500">

        {/* ── Header Bar ──────────────────────── */}
        <Card>
          <div style={{
            background: 'linear-gradient(135deg, #0D1117 0%, #161B22 40%, #1A2332 100%)',
            borderRadius: 10, padding: '20px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <img
                src="/logo.png"
                alt="FlexHunter"
                style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }}
              />
              <div>
                <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>FlexHunter</div>
                <div style={{ color: '#8B949E', fontSize: 12 }}>Product Intelligence Dashboard</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={() => navigate('/')} size="slim">Dashboard</Button>
              <Button onClick={handleSync} loading={syncLoading} size="slim">Sync Performance</Button>
              <Button variant="primary" onClick={handleResearch} loading={researchLoading} size="slim">
                Run Research
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Research Progress ────────────────── */}
        {showResearchProgress && (
          <ResearchProgress shopId="" onComplete={handleResearchComplete} />
        )}

        {/* ── Setup Progress ──────────────────── */}
        {completedSteps < 3 && !showResearchProgress && (
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="h3" variant="headingSm">Getting Started</Text>
                <Badge tone={completedSteps === 3 ? 'success' : 'attention'}>
                  {completedSteps}/3
                </Badge>
              </InlineStack>
              <ProgressBar progress={(completedSteps / 3) * 100} tone="primary" size="small" />
              <InlineStack gap="400">
                {setupSteps.map((step, i) => (
                  <InlineStack key={i} gap="100" blockAlign="center">
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: step.done ? '#008060' : '#D0D5DD',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 10, fontWeight: 700,
                    }}>{step.done ? '✓' : ''}</div>
                    <Text as="span" variant="bodySm" tone={step.done ? undefined : 'subdued'}>
                      {step.label}
                    </Text>
                  </InlineStack>
                ))}
              </InlineStack>
              {hasNoCandidates && (
                <Button variant="primary" onClick={handleResearch} loading={researchLoading} fullWidth>
                  Run Your First Research
                </Button>
              )}
              {!hasNoCandidates && hasNoImports && (
                <Button variant="primary" onClick={() => navigate('/candidates')} fullWidth>
                  Review & Import Candidates
                </Button>
              )}
            </BlockStack>
          </Card>
        )}

        {/* ── Alerts ──────────────────────────── */}
        {stats.pendingReplacements > 0 && (
          <Banner
            title={`${stats.pendingReplacements} product(s) need attention`}
            tone="warning"
            action={{ content: 'Review', onAction: () => navigate('/replacements') }}
          />
        )}

        {/* ── Stat Cards (Odometer Style) ─────── */}
        <InlineGrid columns={4} gap="400">
          <StatCard
            label="Candidates" value={stats.totalCandidates} color="#5C6AC4"
            sub="products found" onClick={() => navigate('/candidates')}
          />
          <StatCard
            label="Imported" value={stats.totalImported} color="#007ACE"
            sub={`${stats.totalTesting} testing · ${stats.totalWinners} winners`}
            onClick={() => navigate('/imports')}
          />
          <StatCard
            label="Revenue" value={stats.totalRevenue} prefix="$" color="#008060"
            sub="from imported products"
          />
          <StatCard
            label="Weak Products" value={stats.totalWeak} color="#D72C0D"
            sub={stats.totalWeak > 0 ? 'need replacement' : 'none detected'}
          />
        </InlineGrid>

        {/* ── Health + Pipeline ────────────────── */}
        <InlineGrid columns={2} gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">Catalog Health</Text>
              <Divider />
              <HealthGauge score={stats.avgHealthScore} />
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: stats.avgHealthScore >= 60 ? '#F1F8F5'
                  : stats.avgHealthScore >= 30 ? '#FFF8E6'
                  : stats.avgHealthScore > 0 ? '#FFF4F4' : '#F6F6F7',
                textAlign: 'center',
              }}>
                <Text as="p" variant="bodySm">
                  {stats.avgHealthScore >= 60 ? 'Catalog performing well!'
                    : stats.avgHealthScore >= 30 ? 'Room for improvement.'
                    : stats.avgHealthScore > 0 ? 'Products need attention.'
                    : 'No data yet. Import products to start.'}
                </Text>
              </div>
              <Text as="p" variant="bodySm" tone="subdued">
                Research: {stats.lastResearchAt ? new Date(stats.lastResearchAt).toLocaleDateString() : 'Never'}
                {' · '}
                Sync: {stats.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleDateString() : 'Never'}
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">Product Pipeline</Text>
              <Divider />
              {[
                { label: 'Testing', count: stats.totalTesting, color: '#FFC453' },
                { label: 'Winners', count: stats.totalWinners, color: '#008060' },
                { label: 'Weak', count: stats.totalWeak, color: '#D72C0D' },
                { label: 'Pending Replace', count: stats.pendingReplacements, color: '#9C6ADE' },
              ].map((item) => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 6, background: '#FAFBFC',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 13 }}>{item.label}</span>
                  </div>
                  <span style={{
                    fontFamily: "'SF Mono', monospace", fontWeight: 700, fontSize: 15,
                    color: item.count > 0 ? item.color : '#8C9196',
                  }}>{item.count}</span>
                </div>
              ))}
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* ── Quick Actions ───────────────────── */}
        <InlineGrid columns={3} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Research Console</Text>
              <Text as="p" variant="bodySm" tone="subdued">Store DNA, domain analysis, triggers.</Text>
              <Button onClick={() => navigate('/research')} fullWidth>Open</Button>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Automation</Text>
              <Text as="p" variant="bodySm" tone="subdued">Replacement mode, thresholds.</Text>
              <Button onClick={() => navigate('/settings')} fullWidth>Configure</Button>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Audit Log</Text>
              <Text as="p" variant="bodySm" tone="subdued">Every decision logged.</Text>
              <Button onClick={() => navigate('/audit')} fullWidth>View</Button>
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
