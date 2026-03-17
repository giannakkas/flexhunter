import { friendlyError } from '../utils/errors';
import React, { useState, useEffect } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  TextField, Banner, Spinner, Divider, InlineGrid,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../hooks/useApi';

const PLACEHOLDER = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';

const DIR_COLORS: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  surging: { bg: '#DCFCE7', color: '#15803D', label: 'SURGING', icon: '🔥' },
  rising: { bg: '#D1FAE5', color: '#047857', label: 'RISING', icon: '📈' },
  stable: { bg: '#EFF6FF', color: '#1D4ED8', label: 'STABLE', icon: '📊' },
  declining: { bg: '#F3F4F6', color: '#6B7280', label: 'DECLINING', icon: '📉' },
  unknown: { bg: '#F9FAFB', color: '#9CA3AF', label: 'NO DATA', icon: '❓' },
};

const STAGE_COLORS: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  early_acceleration: { bg: '#DCFCE7', color: '#15803D', label: '🔥 Early Viral — 2-3 weeks early', icon: '🔥' },
  breakout_candidate: { bg: '#FFF7ED', color: '#C2410C', label: '🚀 Breakout — 1-2 weeks early', icon: '🚀' },
  rising_trend: { bg: '#FEF9C3', color: '#A16207', label: '📈 Rising — 1 week early', icon: '📈' },
  stable_trend: { bg: '#EFF6FF', color: '#1D4ED8', label: '📊 Stable', icon: '📊' },
  saturated: { bg: '#F3F4F6', color: '#6B7280', label: '⚠️ Already Mainstream', icon: '⚠️' },
};

function ScoreRing({ value, size = 48 }: { value: number; size?: number }) {
  const c = value >= 75 ? '#10B981' : value >= 55 ? '#F59E0B' : value >= 35 ? '#F97316' : '#EF4444';
  const pct = value / 100;
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={5}
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize={size * 0.3} fontWeight="800" fill={c}>{value}</text>
    </svg>
  );
}

export function TrendsPage() {
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [viralProducts, setViralProducts] = useState<any[]>([]);
  const [viralSummary, setViralSummary] = useState<any>(null);
  const [viralLoading, setViralLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  // Load viral products on mount
  useEffect(() => {
    loadViralProducts();
  }, []);

  const loadViralProducts = async () => {
    setViralLoading(true);
    try {
      const r = await apiFetch<any>('/trends/viral-products');
      setViralProducts(r.data || []);
      setViralSummary(r.summary || null);
    } catch {}
    setViralLoading(false);
  };

  const analyzeCustom = async () => {
    const kws = keywords.split(',').map(k => k.trim()).filter(k => k.length > 1);
    if (kws.length === 0) { setError('Enter at least one keyword'); return; }
    setLoading(true); setError(null); setResults([]);
    try {
      const r = await apiFetch<any>('/trends/analyze', { method: 'POST', body: JSON.stringify({ keywords: kws }) });
      setResults(r.data || []);
    } catch (e: any) { setError(friendlyError(e.message)); }
    setLoading(false);
  };

  const discoverWinning = async () => {
    setDiscoverLoading(true); setError(null); setResults([]);
    try {
      const r = await apiFetch<any>('/trends/discover', { method: 'POST' });
      setResults(r.data || []);
    } catch (e: any) { setError(friendlyError(e.message)); }
    setDiscoverLoading(false);
  };

  const isSearching = loading || discoverLoading;
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', border: 'none', transition: 'all 0.2s ease',
    background: active ? 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)' : '#F3F4F6',
    color: active ? '#fff' : '#374151',
    boxShadow: active ? '0 4px 14px rgba(26,26,46,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
  });

  return (
    <Page title="Trend Intelligence" subtitle="Detect winning products before competitors">
      <BlockStack gap="400">
        {error && <Banner tone="critical" onDismiss={() => setError(null)}><Text as="p">{error}</Text></Banner>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button style={tabBtnStyle(tab === 0)} onClick={() => setTab(0)}>
            🔍 Trend Analysis
          </button>
          <button style={tabBtnStyle(tab === 1)} onClick={() => { setTab(1); loadViralProducts(); }}>
            🔥 Early Viral Products ({viralProducts.length})
          </button>
        </div>

          {/* ── Tab 0: Trend Analysis ── */}
          {tab === 0 && (
            <BlockStack gap="400">
              <div style={{ height: 12 }} />
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">Search product trends across Google, TikTok & Amazon</Text>
                  <TextField label="" labelHidden value={keywords} onChange={setKeywords}
                    placeholder="e.g., LED desk lamp, portable blender, magnetic phone mount"
                    autoComplete="off"
                    helpText="Separate keywords with commas — or click 'Discover Winning Trends' to let AI find them" />
                  <InlineStack gap="300">
                    <Button variant="primary" onClick={analyzeCustom} loading={loading} disabled={isSearching}>
                      🔍 Analyze My Keywords
                    </Button>
                    <Button onClick={discoverWinning} loading={discoverLoading} disabled={isSearching}
                      tone="success">
                      🔥 Discover Winning Trends
                    </Button>
                  </InlineStack>
                  {discoverLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#FEF3C7', borderRadius: 8 }}>
                      <Spinner size="small" />
                      <Text as="p" variant="bodySm">AI is finding trending products + checking Google, TikTok & Amazon...</Text>
                    </div>
                  )}
                </BlockStack>
              </Card>

              {/* Results */}
              {results.length > 0 && (
                <BlockStack gap="300">
                  {results.map((trend: any, i: number) => {
                    const dir = DIR_COLORS[trend.trendDirection] || DIR_COLORS.unknown;
                    return (
                      <Card key={i}>
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="300" blockAlign="center">
                              <ScoreRing value={trend.overallScore} />
                              <BlockStack gap="0">
                                <Text as="h2" variant="headingMd">{trend.keyword}</Text>
                                <InlineStack gap="200">
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: dir.bg, color: dir.color }}>{dir.icon} {dir.label}</span>
                                  <Badge tone={trend.confidence >= 0.6 ? 'success' : trend.confidence >= 0.4 ? 'info' : 'attention'}>
                                    {trend.confidence >= 0.75 ? 'High' : trend.confidence >= 0.5 ? 'Good' : trend.confidence >= 0.35 ? 'Fair' : 'Low'} confidence
                                  </Badge>
                                </InlineStack>
                              </BlockStack>
                            </InlineStack>
                          </InlineStack>

                          {trend.signals?.length > 0 && (
                            <div style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: 8 }}>
                              <BlockStack gap="100">
                                {trend.signals.map((s: string, j: number) => (
                                  <Text key={j} as="p" variant="bodySm">{s}</Text>
                                ))}
                              </BlockStack>
                            </div>
                          )}

                          <InlineGrid columns={3} gap="300">
                            <div style={{ padding: 10, borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                              <Text as="p" variant="bodySm" fontWeight="bold">🔍 Google</Text>
                              {trend.google ? <Text as="p" variant="bodySm">Interest: {trend.google.interest}/100 | 30d: {trend.google.change30d > 0 ? '+' : ''}{trend.google.change30d}%</Text> : <Text as="p" variant="bodySm" tone="subdued">Not in daily trending (niche keyword)</Text>}
                            </div>
                            <div style={{ padding: 10, borderRadius: 8, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                              <Text as="p" variant="bodySm" fontWeight="bold">📱 TikTok</Text>
                              {trend.tiktok ? <Text as="p" variant="bodySm">Views: {fmtNum(trend.tiktok.viewCount)} | Growth: +{trend.tiktok.growthRate}%</Text> : <Text as="p" variant="bodySm" tone="subdued">No niche match — try broader terms</Text>}
                            </div>
                            <div style={{ padding: 10, borderRadius: 8, background: '#FEF9C3', border: '1px solid #FDE68A' }}>
                              <Text as="p" variant="bodySm" fontWeight="bold">🛒 Amazon</Text>
                              {trend.amazon ? <Text as="p" variant="bodySm">Demand: {trend.amazon.demandSignal} | Avg: ${trend.amazon.avgPrice}</Text> : <Text as="p" variant="bodySm" tone="subdued">No listings found</Text>}
                            </div>
                          </InlineGrid>
                        </BlockStack>
                      </Card>
                    );
                  })}
                </BlockStack>
              )}
            </BlockStack>
          )}

          {/* ── Tab 1: Early Viral Products ── */}
          {tab === 1 && (
            <BlockStack gap="400">
              <div style={{ height: 12 }} />

              {/* How it works */}
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingSm">🔥 Early Viral Detection — Find Products Before Competitors</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Our AI analyzes order velocity, review-to-order ratio, price sweet spot, TikTok-friendliness, and market saturation to detect products 1-2 weeks before they go mainstream. Products are classified by how early you are.
                  </Text>
                  {viralSummary && (
                    <InlineStack gap="200">
                      {viralSummary.earlyAcceleration > 0 && <Badge tone="success">🔥 {viralSummary.earlyAcceleration} Early Viral</Badge>}
                      {viralSummary.breakoutCandidates > 0 && <Badge tone="warning">🚀 {viralSummary.breakoutCandidates} Breakout</Badge>}
                      {viralSummary.risingTrends > 0 && <Badge tone="info">📈 {viralSummary.risingTrends} Rising</Badge>}
                      <Badge>{viralSummary.total} total detected</Badge>
                    </InlineStack>
                  )}
                </BlockStack>
              </Card>

              {viralLoading && <Card><div style={{ textAlign: 'center', padding: 30 }}><Spinner size="large" /><div style={{ marginTop: 8 }}><Text as="p" variant="bodySm">Loading viral products...</Text></div></div></Card>}

              {!viralLoading && viralProducts.length === 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd">No viral products detected yet. Run AI Research first to discover products, then come back here to see which ones have early viral signals.</Text>
                    <Button onClick={() => navigate('/candidates')}>Go to Research</Button>
                  </BlockStack>
                </Card>
              )}

              {viralProducts.length > 0 && (
                <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="300">
                  {viralProducts.map((p: any) => {
                    const stage = STAGE_COLORS[p.stage] || STAGE_COLORS.stable_trend;
                    return (
                      <div key={p.id} style={{
                        borderRadius: 14, overflow: 'hidden', background: 'white',
                        border: p.stage === 'early_acceleration' ? '2px solid #22C55E' : p.stage === 'breakout_candidate' ? '2px solid #F97316' : '1px solid #E5E7EB',
                        boxShadow: p.stage === 'early_acceleration' ? '0 0 15px rgba(34,197,94,0.2)' : 'none',
                      }}>
                        {/* Stage banner */}
                        <div style={{ padding: '6px 14px', background: stage.bg, color: stage.color, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
                          {stage.label}
                        </div>

                        {/* Image */}
                        <div style={{ height: 140, background: '#f5f5f5', position: 'relative' }}>
                          <img src={p.imageUrl || PLACEHOLDER} alt="" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', top: 8, left: 8 }}><ScoreRing value={p.viralScore} size={36} /></div>
                          <div style={{ position: 'absolute', top: 8, right: 8 }}>
                            <Badge tone="info">{p.sourceName}</Badge>
                          </div>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '12px 14px' }}>
                          <BlockStack gap="200">
                            <Text as="p" variant="bodyMd" fontWeight="bold">
                              {p.title.length > 50 ? p.title.slice(0, 50) + '...' : p.title}
                            </Text>

                            <InlineStack gap="100">
                              <Badge>{p.category || 'General'}</Badge>
                              {p.orders > 0 && <Badge tone="success">{fmtNum(p.orders)} sold</Badge>}
                            </InlineStack>

                            {/* Price */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, background: '#FAFBFC', borderRadius: 8, padding: '8px 6px' }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 9, color: '#6D7175', textTransform: 'uppercase', fontWeight: 600 }}>Price</div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>${p.price?.toFixed(2)}</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 9, color: '#6D7175', textTransform: 'uppercase', fontWeight: 600 }}>Cost</div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>${p.cost?.toFixed(2)}</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 9, color: '#6D7175', textTransform: 'uppercase', fontWeight: 600 }}>Viral</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: p.viralScore >= 65 ? '#16A34A' : '#F59E0B' }}>{p.viralScore}/100</div>
                              </div>
                            </div>

                            {/* Time advantage */}
                            <div style={{
                              padding: '6px 10px', borderRadius: 8, textAlign: 'center',
                              background: p.stage === 'early_acceleration' ? '#DCFCE7' : p.stage === 'breakout_candidate' ? '#FFF7ED' : '#EFF6FF',
                              fontWeight: 700, fontSize: 12,
                              color: p.stage === 'early_acceleration' ? '#15803D' : p.stage === 'breakout_candidate' ? '#C2410C' : '#1D4ED8',
                            }}>
                              ⏰ {p.timeAdvantage}
                            </div>

                            {p.fitReasons?.length > 0 && (
                              <div style={{ padding: '8px 10px', background: '#F0FDF4', borderRadius: 8, fontSize: 12, color: '#166534' }}>
                                {p.fitReasons.slice(0, 2).map((r: string, i: number) => (
                                  <div key={i}>✓ {r}</div>
                                ))}
                              </div>
                            )}

                            <Button fullWidth size="slim" onClick={() => navigate('/candidates')}>
                              View in Research →
                            </Button>
                          </BlockStack>
                        </div>
                      </div>
                    );
                  })}
                </InlineGrid>
              )}
            </BlockStack>
          )}

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}

function fmtNum(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
}
