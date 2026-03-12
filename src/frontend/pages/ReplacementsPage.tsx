import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  EmptyState, Banner, Spinner, Divider, InlineGrid,
} from '@shopify/polaris';
import { useApi, apiFetch } from '../hooks/useApi';

const PLACEHOLDER = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';

const ACTION_BADGES: Record<string, { tone: any; label: string }> = {
  SUGGESTED: { tone: 'warning', label: 'Pending Review' },
  APPROVED: { tone: 'info', label: 'Approved' },
  EXECUTED: { tone: 'success', label: 'Executed' },
  REJECTED: { tone: 'critical', label: 'Rejected' },
};

function ProductCard({ title, image, price, orders, revenue, status, statusColor }: {
  title: string; image?: string; price?: number; orders?: number; revenue?: number; status: string; statusColor: string;
}) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: `2px solid ${statusColor}20`, background: `${statusColor}05` }}>
      <BlockStack gap="200">
        <div style={{ display: 'flex', gap: 12 }}>
          <img src={image || PLACEHOLDER} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', background: '#f0f0f0' }}
            onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text as="p" variant="bodyMd" fontWeight="bold">{title.length > 45 ? title.slice(0, 45) + '...' : title}</Text>
            <Badge tone={statusColor === '#EF4444' ? 'critical' : 'success'}>{status}</Badge>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, background: 'white', borderRadius: 8, padding: '8px 6px' }}>
          {[
            { l: 'Price', v: price ? `$${price.toFixed(2)}` : '—' },
            { l: 'Orders', v: orders?.toString() || '0' },
            { l: 'Revenue', v: revenue ? `$${revenue.toFixed(0)}` : '$0' },
          ].map(c => (
            <div key={c.l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#6D7175', textTransform: 'uppercase', fontWeight: 600 }}>{c.l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#202223' }}>{c.v}</div>
            </div>
          ))}
        </div>
      </BlockStack>
    </div>
  );
}

export function ReplacementsPage() {
  const { data: decisions, get, loading } = useApi<any[]>();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => { get('/replacements'); }, [get]);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const r = await apiFetch<any>('/replacements/scan', { method: 'POST' });
      setScanResult(r.message || `Found ${r.data?.length || 0} suggestions`);
      get('/replacements');
    } catch (e: any) {
      setScanResult(`Scan failed: ${e.message}`);
    }
    setScanning(false);
  };

  const handleApprove = async (id: string) => {
    await apiFetch(`/replacements/${id}/approve`, { method: 'POST' }).catch(() => {});
    get('/replacements');
  };

  const handleReject = async (id: string) => {
    await apiFetch(`/replacements/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: 'Merchant decided to keep' }) }).catch(() => {});
    get('/replacements');
  };

  const items = decisions || [];
  const pending = items.filter((i: any) => i.action === 'SUGGESTED');

  return (
    <Page title="Replacement Queue"
      subtitle={`${pending.length} pending review`}
      primaryAction={{ content: scanning ? 'Scanning...' : '🔍 Scan for Weak Products', onAction: handleScan, loading: scanning }}
    >
      <BlockStack gap="400">
        {scanResult && (
          <Banner tone={scanResult.includes('fail') ? 'critical' : 'info'} onDismiss={() => setScanResult(null)}>
            <Text as="p">{scanResult}</Text>
          </Banner>
        )}

        {scanning && (
          <Card>
            <div style={{ textAlign: 'center', padding: 30 }}>
              <Spinner size="large" />
              <div style={{ marginTop: 12 }}>
                <Text as="p" variant="bodyMd" fontWeight="bold">AI Scanning Imported Products...</Text>
                <Text as="p" variant="bodySm" tone="subdued">Checking performance, finding better alternatives</Text>
              </div>
            </div>
          </Card>
        )}

        {items.length === 0 && !loading && !scanning && (
          <Card>
            <BlockStack gap="400">
              <EmptyState heading="No replacement suggestions yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                action={{ content: '🔍 Scan Now', onAction: handleScan }}>
                <Text as="p">Click "Scan for Weak Products" to analyze your imported products and find better alternatives.</Text>
              </EmptyState>
              <Divider />
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">How Auto-Replacement Works</Text>
                <InlineGrid columns={3} gap="300">
                  {[
                    { icon: '📊', title: 'Detect Weak Products', desc: 'Products with 0 orders after 14 days are flagged' },
                    { icon: '🤖', title: 'AI Finds Alternatives', desc: 'AI searches your candidates for better matches' },
                    { icon: '🔄', title: 'You Decide', desc: 'Approve or reject each suggestion' },
                  ].map(s => (
                    <div key={s.title} style={{ padding: 16, borderRadius: 10, background: '#F9FAFB', textAlign: 'center' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                      <Text as="p" variant="bodySm" fontWeight="bold">{s.title}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">{s.desc}</Text>
                    </div>
                  ))}
                </InlineGrid>
              </BlockStack>
            </BlockStack>
          </Card>
        )}

        {pending.length > 0 && (
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">⚠️ Pending Review ({pending.length})</Text>
            {pending.map((item: any) => (
              <Card key={item.id}>
                <BlockStack gap="300">
                  <InlineGrid columns={2} gap="300">
                    <ProductCard
                      title={item.currentProduct?.importedTitle || 'Unknown'}
                      image={item.currentProduct?.candidate?.imageUrls?.[0]}
                      price={item.currentProduct?.importedPrice}
                      orders={item.currentProduct?.performance?.orders}
                      revenue={item.currentProduct?.performance?.revenue}
                      status="⚠️ Underperforming"
                      statusColor="#EF4444"
                    />
                    <ProductCard
                      title={item.replacementCandidate?.title || 'Suggested replacement'}
                      image={item.replacementCandidate?.imageUrls?.[0]}
                      price={item.replacementCandidate?.suggestedPrice}
                      orders={item.replacementCandidate?.orderVolume}
                      revenue={0}
                      status="✅ Recommended"
                      statusColor="#10B981"
                    />
                  </InlineGrid>
                  <div style={{ padding: '12px 16px', background: '#F9FAFB', borderRadius: 10 }}>
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" fontWeight="bold">AI Reason: {item.reason}</Text>
                        {item.fitExplanation && <Text as="p" variant="bodySm" tone="subdued">Expected: {item.fitExplanation}</Text>}
                        <Badge tone="info">Confidence: {((item.confidence || 0) * 100).toFixed(0)}%</Badge>
                      </BlockStack>
                      <InlineStack gap="200">
                        <Button size="slim" variant="primary" onClick={() => handleApprove(item.id)}>✅ Approve</Button>
                        <Button size="slim" tone="critical" onClick={() => handleReject(item.id)}>✕ Reject</Button>
                      </InlineStack>
                    </InlineStack>
                  </div>
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        )}

        {items.filter((i: any) => i.action !== 'SUGGESTED').length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">Past Decisions</Text>
              {items.filter((i: any) => i.action !== 'SUGGESTED').map((item: any) => {
                const badge = ACTION_BADGES[item.action] || { tone: 'info', label: item.action };
                return (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div>
                      <Text as="p" variant="bodySm" fontWeight="bold">{item.currentProduct?.importedTitle || 'Product'}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">{item.reason}</Text>
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                );
              })}
            </BlockStack>
          </Card>
        )}
        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
