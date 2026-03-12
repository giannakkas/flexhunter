import React, { useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  TextField, Banner, Spinner, Divider, InlineGrid,
} from '@shopify/polaris';
import { apiFetch } from '../hooks/useApi';

const DIR_COLORS: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  surging: { bg: '#FEE2E2', color: '#B91C1C', label: 'SURGING', icon: '🔥' },
  rising: { bg: '#FEF9C3', color: '#A16207', label: 'RISING', icon: '📈' },
  stable: { bg: '#EFF6FF', color: '#1D4ED8', label: 'STABLE', icon: '📊' },
  declining: { bg: '#F3F4F6', color: '#6B7280', label: 'DECLINING', icon: '📉' },
  unknown: { bg: '#F9FAFB', color: '#9CA3AF', label: 'NO DATA', icon: '❓' },
};

function ScoreRing({ value, size = 56 }: { value: number; size?: number }) {
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
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    const kws = keywords.split(',').map(k => k.trim()).filter(k => k.length > 1);
    if (kws.length === 0) { setError('Enter at least one keyword'); return; }
    setLoading(true); setError(null); setResults([]);
    try {
      const r = await apiFetch<any>('/trends/analyze', {
        method: 'POST',
        body: JSON.stringify({ keywords: kws }),
      });
      setResults(r.data || []);
      if ((r.data || []).length === 0) setError('No trend data found. Try different keywords.');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <Page title="Trend Intelligence" subtitle="Analyze product trends across Google, TikTok & Amazon">
      <BlockStack gap="400">

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">Enter product keywords to analyze</Text>
            <TextField label="" labelHidden value={keywords} onChange={setKeywords}
              placeholder="e.g., LED desk lamp, portable blender, magnetic phone mount"
              autoComplete="off"
              helpText="Separate multiple keywords with commas (max 10)" />
            <InlineStack align="end">
              <Button variant="primary" onClick={analyze} loading={loading}>
                🔍 Analyze Trends
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {error && <Banner tone="critical" onDismiss={() => setError(null)}><Text as="p">{error}</Text></Banner>}

        {loading && (
          <Card>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spinner size="large" />
              <div style={{ marginTop: 12 }}>
                <Text as="p" variant="bodyMd" fontWeight="bold">Querying Google Trends, TikTok & Amazon...</Text>
                <Text as="p" variant="bodySm" tone="subdued">This may take 10-20 seconds per keyword</Text>
              </div>
            </div>
          </Card>
        )}

        {results.length > 0 && (
          <BlockStack gap="300">
            {results.map((trend: any, i: number) => {
              const dir = DIR_COLORS[trend.trendDirection] || DIR_COLORS.unknown;
              return (
                <Card key={i}>
                  <BlockStack gap="300">
                    {/* Header */}
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="300" blockAlign="center">
                        <ScoreRing value={trend.overallScore} />
                        <BlockStack gap="0">
                          <Text as="h2" variant="headingMd">{trend.keyword}</Text>
                          <InlineStack gap="200">
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                              background: dir.bg, color: dir.color,
                            }}>{dir.icon} {dir.label}</span>
                            <Badge tone="info">Confidence: {(trend.confidence * 100).toFixed(0)}%</Badge>
                          </InlineStack>
                        </BlockStack>
                      </InlineStack>
                    </InlineStack>

                    {/* Signals */}
                    {trend.signals?.length > 0 && (
                      <div style={{ padding: '12px 16px', background: '#F9FAFB', borderRadius: 10 }}>
                        <BlockStack gap="100">
                          {trend.signals.map((s: string, j: number) => (
                            <Text key={j} as="p" variant="bodySm">{s}</Text>
                          ))}
                        </BlockStack>
                      </div>
                    )}

                    {/* Source Details */}
                    <InlineGrid columns={3} gap="300">
                      {/* Google */}
                      <div style={{ padding: 12, borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" fontWeight="bold">🔍 Google Trends</Text>
                          {trend.google ? (
                            <>
                              <Text as="p" variant="bodySm">Interest: {trend.google.interest}/100</Text>
                              <Text as="p" variant="bodySm">30d change: {trend.google.change30d > 0 ? '+' : ''}{trend.google.change30d}%</Text>
                              {trend.google.relatedQueries?.length > 0 && (
                                <Text as="p" variant="bodySm" tone="subdued">Related: {trend.google.relatedQueries.slice(0, 3).join(', ')}</Text>
                              )}
                            </>
                          ) : <Text as="p" variant="bodySm" tone="subdued">No data</Text>}
                        </BlockStack>
                      </div>

                      {/* TikTok */}
                      <div style={{ padding: 12, borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" fontWeight="bold">📱 TikTok</Text>
                          {trend.tiktok ? (
                            <>
                              <Text as="p" variant="bodySm">Views: {formatNum(trend.tiktok.viewCount)}</Text>
                              <Text as="p" variant="bodySm">Videos: {formatNum(trend.tiktok.videoCount)}</Text>
                              <Text as="p" variant="bodySm">Growth: {trend.tiktok.growthRate > 0 ? '+' : ''}{trend.tiktok.growthRate}%</Text>
                            </>
                          ) : <Text as="p" variant="bodySm" tone="subdued">No data</Text>}
                        </BlockStack>
                      </div>

                      {/* Amazon */}
                      <div style={{ padding: 12, borderRadius: 10, background: '#FEF9C3', border: '1px solid #FDE68A' }}>
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" fontWeight="bold">🛒 Amazon</Text>
                          {trend.amazon ? (
                            <>
                              <Text as="p" variant="bodySm">Demand: {trend.amazon.demandSignal}</Text>
                              <Text as="p" variant="bodySm">Avg price: ${trend.amazon.avgPrice}</Text>
                              <Text as="p" variant="bodySm">Rating: {trend.amazon.avgRating}★</Text>
                            </>
                          ) : <Text as="p" variant="bodySm" tone="subdued">No data</Text>}
                        </BlockStack>
                      </div>
                    </InlineGrid>
                  </BlockStack>
                </Card>
              );
            })}
          </BlockStack>
        )}

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}

function formatNum(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
}
