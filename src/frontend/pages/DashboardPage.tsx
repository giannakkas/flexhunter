import React, { useEffect, useState, useRef } from 'react';
import {
  Page, Card, Text, BlockStack, InlineStack,
  Badge, Button, Banner, Divider,
  InlineGrid, EmptyState, Spinner,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi, apiFetch } from '../hooks/useApi';

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

// ── Animated Number ──────────────────────────
function AnimNum({ value, prefix = '', suffix = '', duration = 1000 }: { value: number; prefix?: string; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    const startTime = Date.now();
    const animate = () => {
      const p = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      if (p < 1) requestAnimationFrame(animate);
      else prevRef.current = value;
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span style={{ fontFamily: "'SF Mono', 'Roboto Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{prefix}{display.toLocaleString()}{suffix}</span>;
}

// ── Animated Gauge ───────────────────────────
function HealthGauge({ score, label }: { score: number; label: string }) {
  const [animScore, setAnimScore] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimScore(score), 200);
    return () => clearTimeout(t);
  }, [score]);

  const angle = (animScore / 100) * 180;
  const color = animScore >= 75 ? '#34D399' : animScore >= 50 ? '#FBBF24' : animScore >= 25 ? '#F97316' : '#EF4444';
  const radius = 70;
  const circumference = Math.PI * radius;
  const offset = circumference - (animScore / 100) * circumference;

  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      <svg width="180" height="100" viewBox="0 0 180 100">
        {/* Background arc */}
        <path d="M 10 90 A 70 70 0 0 1 170 90" fill="none" stroke="#E5E7EB" strokeWidth="12" strokeLinecap="round" />
        {/* Animated arc */}
        <path d="M 10 90 A 70 70 0 0 1 170 90" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s ease-out, stroke 0.5s ease' }} />
        {/* Score text */}
        <text x="90" y="78" textAnchor="middle" style={{ fontSize: 28, fontWeight: 800, fontFamily: "'SF Mono', monospace", fill: color }}>
          {animScore}
        </text>
        <text x="90" y="95" textAnchor="middle" style={{ fontSize: 10, fill: '#9CA3AF' }}>/100</text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginTop: -4 }}>{label}</div>
    </div>
  );
}

// ── Stat Card ────────────────────────────────
function StatCard({ title, value, prefix, suffix, icon, color, bg, subtitle, delay = 0 }: {
  title: string; value: number; prefix?: string; suffix?: string; icon: string; color: string; bg: string; subtitle?: string; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <div style={{
      background: `linear-gradient(135deg, ${bg} 0%, white 100%)`,
      borderRadius: 14, padding: '18px 20px', border: '1px solid #E5E7EB',
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1.1, marginTop: 6 }}>
            <AnimNum value={value} prefix={prefix} suffix={suffix} />
          </div>
          {subtitle && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{subtitle}</div>}
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>{icon}</div>
      </div>
    </div>
  );
}

// ── Pipeline Bar ─────────────────────────────
function PipelineBar({ label, count, total, color, delay = 0 }: { label: string; count: number; total: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { const t = setTimeout(() => setWidth(total > 0 ? (count / total) * 100 : 0), delay); return () => clearTimeout(t); }, [count, total, delay]);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{count}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${color}, ${color}CC)`,
          width: `${Math.max(width, count > 0 ? 2 : 0)}%`,
          transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>
    </div>
  );
}

// ── Source Badge ──────────────────────────────
function SourceBadge({ name, count, icon, color, delay = 0 }: { name: string; count: number; icon: string; color: string; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      borderRadius: 10, background: `${color}08`, border: `1px solid ${color}20`,
      opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.9)',
      transition: 'all 0.4s ease',
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{name}</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{count}</div>
    </div>
  );
}

// ── Onboarding Steps ─────────────────────────
function OnboardingWizard({ status, navigate }: { status: OnboardingStatus; navigate: any }) {
  const steps = [
    { key: 'setup', label: 'Setup', done: true, icon: '✅' },
    { key: 'research', label: 'Research', done: status?.settings, icon: status?.settings ? '✅' : '🔬' },
    { key: 'import', label: 'Import', done: false, icon: '📥' },
  ];
  const currentStep = steps.findIndex(s => !s.done);
  const pct = ((currentStep === -1 ? 3 : currentStep) / 3) * 100;

  return (
    <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)', borderRadius: 16, padding: '24px 28px', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Getting Started</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Complete these steps to start finding winning products</div>
        </div>
        <Badge tone="attention">{currentStep === -1 ? 3 : currentStep}/3</Badge>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#334155', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: s.done ? '#065F4620' : '#1E293B', border: `1px solid ${s.done ? '#065F46' : '#334155'}` }}>
            <span style={{ fontSize: 18 }}>{s.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
      </div>
      {currentStep >= 0 && (
        <button onClick={() => navigate(currentStep === 0 ? '/onboarding' : currentStep === 1 ? '/research' : '/candidates')}
          style={{ marginTop: 16, width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {currentStep === 1 ? 'Run Your First Research' : currentStep === 2 ? 'Import Your First Product' : 'Continue Setup'}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════
export function DashboardPage() {
  const navigate = useNavigate();
  const { data: dashData, get: getDash, loading } = useApi<DashboardData>();
  const { data: onboarding, get: getOnb } = useApi<OnboardingStatus>();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    getDash('/dashboard');
    getOnb('/onboarding/status');
    apiFetch<any>('/candidates?status=CANDIDATE&sort=score&limit=5').then(r => setCandidates(r.data || [])).catch(() => {});
  }, [getDash, getOnb]);

  useEffect(() => { if (dashData) setHasLoaded(true); }, [dashData]);

  const d = dashData || { totalCandidates: 0, totalImported: 0, totalTesting: 0, totalWinners: 0, totalWeak: 0, pendingReplacements: 0, totalRevenue: 0, avgHealthScore: 0, lastResearchAt: null, lastSyncAt: null };
  const isNew = !onboarding?.isComplete;
  const totalPipeline = d.totalTesting + d.totalWinners + d.totalWeak;
  const healthScore = d.avgHealthScore || (d.totalImported > 0 ? Math.min(100, Math.round((d.totalWinners / Math.max(d.totalImported, 1)) * 100 + 40)) : 0);

  if (loading && !hasLoaded) return <Page><Card><div style={{ textAlign: 'center', padding: 40 }}><Spinner size="large" /></div></Card></Page>;

  return (
    <Page>
      <BlockStack gap="400">

        {/* ── Onboarding (only for new users) ── */}
        {isNew && onboarding && <OnboardingWizard status={onboarding} navigate={navigate} />}

        {/* ── Hero Stats ── */}
        <InlineGrid columns={4} gap="300">
          <StatCard title="Candidates" value={d.totalCandidates} icon="🔍" color="#3B82F6" bg="#EFF6FF" subtitle="products found" delay={0} />
          <StatCard title="Imported" value={d.totalImported} icon="📦" color="#8B5CF6" bg="#F5F3FF" subtitle={`${d.totalTesting} testing · ${d.totalWinners} winners`} delay={100} />
          <StatCard title="Revenue" value={d.totalRevenue} prefix="$" icon="💰" color="#10B981" bg="#ECFDF5" subtitle="from imported products" delay={200} />
          <StatCard title="Weak Products" value={d.totalWeak} icon="⚠️" color={d.totalWeak > 0 ? '#EF4444' : '#9CA3AF'} bg={d.totalWeak > 0 ? '#FEF2F2' : '#F9FAFB'} subtitle={d.totalWeak > 0 ? 'need replacement' : 'none detected'} delay={300} />
        </InlineGrid>

        {/* ── Middle Section: Health + Pipeline + Quick Actions ── */}
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
          {/* Catalog Health */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Catalog Health</Text>
              <HealthGauge score={healthScore} label={healthScore >= 75 ? 'Excellent' : healthScore >= 50 ? 'Good' : healthScore >= 25 ? 'Needs Work' : 'Get Started'} />
              <div style={{ textAlign: 'center' }}>
                {d.totalImported === 0 ? (
                  <Text as="p" variant="bodySm" tone="subdued">Import products to start tracking health</Text>
                ) : (
                  <Text as="p" variant="bodySm" tone="subdued">{d.totalWinners} winners out of {d.totalImported} products</Text>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
                Research: {d.lastResearchAt ? new Date(d.lastResearchAt).toLocaleDateString() : 'Never'}
                {' · '}Sync: {d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleDateString() : 'Never'}
              </div>
            </BlockStack>
          </Card>

          {/* Product Pipeline */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Product Pipeline</Text>
              <PipelineBar label="Testing" count={d.totalTesting} total={Math.max(d.totalImported, 1)} color="#F59E0B" delay={200} />
              <PipelineBar label="Winners" count={d.totalWinners} total={Math.max(d.totalImported, 1)} color="#10B981" delay={400} />
              <PipelineBar label="Weak" count={d.totalWeak} total={Math.max(d.totalImported, 1)} color="#EF4444" delay={600} />
              <PipelineBar label="Pending Replace" count={d.pendingReplacements} total={Math.max(d.totalImported, 1)} color="#8B5CF6" delay={800} />
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#6B7280' }}>Total Imported</span>
                <span style={{ fontWeight: 800, color: '#111827' }}>{d.totalImported}</span>
              </div>
            </BlockStack>
          </Card>

          {/* Quick Actions */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Quick Actions</Text>
              <button onClick={() => navigate('/research')} style={actionBtnStyle('#3B82F6', '#EFF6FF')}>
                <span style={{ fontSize: 18 }}>🔬</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Research Console</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>Find new winning products</div>
                </div>
                <span style={{ color: '#9CA3AF' }}>→</span>
              </button>
              <button onClick={() => navigate('/candidates')} style={actionBtnStyle('#8B5CF6', '#F5F3FF')}>
                <span style={{ fontSize: 18 }}>📋</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Review Candidates</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{d.totalCandidates} products waiting</div>
                </div>
                <span style={{ color: '#9CA3AF' }}>→</span>
              </button>
              <button onClick={() => navigate('/seo')} style={actionBtnStyle('#10B981', '#ECFDF5')}>
                <span style={{ fontSize: 18 }}>✨</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>SEO Optimizer</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>Boost product rankings</div>
                </div>
                <span style={{ color: '#9CA3AF' }}>→</span>
              </button>
              <button onClick={() => navigate('/settings')} style={actionBtnStyle('#F59E0B', '#FFFBEB')}>
                <span style={{ fontSize: 18 }}>⚙️</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Settings</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>Automation & thresholds</div>
                </div>
                <span style={{ color: '#9CA3AF' }}>→</span>
              </button>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* ── Top Candidates Preview ── */}
        {candidates.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Top Candidates</Text>
                <Button size="slim" onClick={() => navigate('/candidates')}>View All ({d.totalCandidates})</Button>
              </InlineStack>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                {candidates.slice(0, 5).map((c: any, i: number) => {
                  const fs = c.score?.finalScore || 0;
                  const sc = fs >= 80 ? '#10B981' : fs >= 65 ? '#34D399' : fs >= 50 ? '#F59E0B' : '#EF4444';
                  return (
                    <div key={c.id} onClick={() => navigate('/candidates')} style={{
                      cursor: 'pointer', borderRadius: 12, border: '1px solid #E5E7EB', padding: 12,
                      transition: 'all 0.2s ease', background: 'white',
                      opacity: 0, animation: `fadeSlideIn 0.4s ease ${i * 100}ms forwards`,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                    >
                      <div style={{ width: '100%', height: 80, borderRadius: 8, overflow: 'hidden', background: '#F3F4F6', marginBottom: 8 }}>
                        <img src={c.imageUrls?.[0] || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'}
                          alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).src = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'; }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.3, height: 32, overflow: 'hidden' }}>
                        {c.title.length > 40 ? c.title.slice(0, 40) + '...' : c.title}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>${c.suggestedPrice?.toFixed(2) || '0.00'}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: 'white', background: sc,
                          padding: '2px 8px', borderRadius: 10,
                        }}>{fs.toFixed(0)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{c.sourceName || c.providerType}</div>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        )}

        {/* ── Activity Footer ── */}
        <InlineGrid columns={3} gap="300">
          <button onClick={() => navigate('/research')} style={footerCardStyle}>
            <span style={{ fontSize: 24 }}>🔬</span>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Research Console</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Store DNA, domain analysis, triggers</div>
          </button>
          <button onClick={() => navigate('/settings')} style={footerCardStyle}>
            <span style={{ fontSize: 24 }}>⚙️</span>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Automation</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Replacement mode, thresholds</div>
          </button>
          <button onClick={() => navigate('/audit')} style={footerCardStyle}>
            <span style={{ fontSize: 24 }}>📜</span>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Audit Log</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Every decision logged</div>
          </button>
        </InlineGrid>

        <div style={{ height: 80 }} />
      </BlockStack>

      {/* Keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Page>
  );
}

const actionBtnStyle = (color: string, bg: string): React.CSSProperties => ({
  all: 'unset' as any, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 14px', borderRadius: 10, border: `1px solid ${color}20`,
  background: bg, transition: 'all 0.2s ease', width: '100%', boxSizing: 'border-box',
});

const footerCardStyle: React.CSSProperties = {
  all: 'unset' as any, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  padding: '20px', borderRadius: 14, border: '1px solid #E5E7EB', background: 'white',
  textAlign: 'center', transition: 'all 0.2s ease', boxSizing: 'border-box',
};
