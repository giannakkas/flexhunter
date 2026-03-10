import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  Thumbnail, EmptyState, Modal, Divider,
  InlineGrid, Tabs, Spinner, Banner, TextField,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi, apiFetch } from '../hooks/useApi';

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm">{label}</Text>
        <Text as="span" variant="bodySm" fontWeight="semibold">{Math.round(value)}</Text>
      </InlineStack>
      <div style={{ height: 6, borderRadius: 3, background: '#E4E5E7', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, background: color,
          width: `${Math.min(100, value)}%`, transition: 'width 0.3s ease',
        }} />
      </div>
    </BlockStack>
  );
}

export function CandidatesPage() {
  const navigate = useNavigate();
  const { data: candidates, get, loading } = useApi<any[]>();
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const tabs = [
    { id: 'CANDIDATE', content: 'New Candidates' },
    { id: 'APPROVED', content: 'Approved' },
    { id: 'REJECTED', content: 'Skipped' },
  ];

  const statusFilter = tabs[selectedTab].id;

  useEffect(() => {
    get(`/candidates?status=${statusFilter}&sort=score`);
  }, [get, statusFilter]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/candidates/${id}/approve`, { method: 'POST' });
      setMessage('Product imported successfully!');
    } catch (err: any) {
      setMessage(`Import failed: ${err.message}`);
    }
    await get(`/candidates?status=${statusFilter}&sort=score`);
    setActionLoading(null);
    setSelectedCandidate(null);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    await apiFetch(`/candidates/${id}/reject`, { method: 'POST' });
    await get(`/candidates?status=${statusFilter}&sort=score`);
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this candidate permanently?')) return;
    setActionLoading(id);
    await apiFetch(`/candidates/${id}`, { method: 'DELETE' });
    await get(`/candidates?status=${statusFilter}&sort=score`);
    setActionLoading(null);
  };

  const handleResetAll = async () => {
    if (!window.confirm('Delete ALL non-imported candidates? This cannot be undone.')) return;
    await apiFetch('/candidates/reset', { method: 'POST' });
    await get(`/candidates?status=${statusFilter}&sort=score`);
    setMessage('All candidates cleared');
  };

  const items = (candidates || []).filter((item: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return item.title.toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q);
  });

  return (
    <Page
      title="Product Candidates"
      subtitle={`${items.length} products`}
      primaryAction={{
        content: 'Run New Research',
        onAction: async () => {
          await apiFetch('/research/start', { method: 'POST' });
          await get(`/candidates?status=CANDIDATE&sort=score`);
          setSelectedTab(0);
          setMessage('Research complete! New candidates added.');
        },
      }}
      secondaryActions={[
        { content: 'Clear All', onAction: handleResetAll, destructive: true },
      ]}
    >
      <BlockStack gap="400">
        {message && (
          <Banner tone="success" onDismiss={() => setMessage(null)}>
            <Text as="p">{message}</Text>
          </Banner>
        )}

        <Tabs tabs={tabs} selected={selectedTab} onSelect={(i) => { setSelectedTab(i); setSearchQuery(''); }} />

        {/* Search */}
        <TextField
          label=""
          labelHidden
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by title or category..."
          autoComplete="off"
          clearButton
          onClearButtonClick={() => setSearchQuery('')}
        />

        {loading && <Card><div style={{ textAlign: 'center', padding: 20 }}><Spinner /></div></Card>}

        {!loading && items.length === 0 && (
          <Card>
            <EmptyState
              heading={statusFilter === 'CANDIDATE' ? 'No candidates yet' : `No ${statusFilter.toLowerCase()} products`}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={statusFilter === 'CANDIDATE' ? {
                content: 'Run Research',
                onAction: async () => {
                  await apiFetch('/research/start', { method: 'POST' });
                  await get('/candidates?status=CANDIDATE&sort=score');
                },
              } : undefined}
            >
              <Text as="p">
                {statusFilter === 'CANDIDATE'
                  ? 'Run a research pipeline to discover products.'
                  : 'Products appear here as you review candidates.'}
              </Text>
            </EmptyState>
          </Card>
        )}

        {!loading && items.length > 0 && (
          <InlineGrid columns={2} gap="400">
            {items.map((item: any) => {
              const score = item.score;
              const finalScore = score?.finalScore || 0;
              const scoreColor = finalScore >= 70 ? '#008060' : finalScore >= 50 ? '#B98900' : '#D72C0D';

              return (
                <Card key={item.id}>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <InlineStack gap="300" blockAlign="start">
                        <Thumbnail
                          source={item.imageUrls?.[0] || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'}
                          alt={item.title}
                          size="medium"
                        />
                        <BlockStack gap="100">
                          <Button variant="plain" onClick={() => setSelectedCandidate(item)}>
                            <Text as="span" variant="headingSm">{item.title}</Text>
                          </Button>
                          <InlineStack gap="200">
                            <Badge tone="info">{item.category || 'General'}</Badge>
                            <Badge tone={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'critical' : 'attention'}>
                              {item.status === 'CANDIDATE' ? 'New' : item.status === 'APPROVED' ? 'Imported' : 'Skipped'}
                            </Badge>
                          </InlineStack>
                        </BlockStack>
                      </InlineStack>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        border: `3px solid ${scoreColor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        fontFamily: "'SF Mono', monospace", fontWeight: 700, fontSize: 15,
                      }}>
                        {finalScore.toFixed(0)}
                      </div>
                    </InlineStack>

                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                      background: '#FAFBFC', borderRadius: 8, padding: '10px 12px',
                    }}>
                      <div><div style={{ fontSize: 10, color: '#6D7175' }}>Sell</div><div style={{ fontWeight: 600, fontSize: 14 }}>${item.suggestedPrice?.toFixed(2) || '-'}</div></div>
                      <div><div style={{ fontSize: 10, color: '#6D7175' }}>Cost</div><div style={{ fontWeight: 600, fontSize: 14 }}>${item.costPrice?.toFixed(2) || '-'}</div></div>
                      <div><div style={{ fontSize: 10, color: '#6D7175' }}>Margin</div><div style={{ fontWeight: 600, fontSize: 14, color: '#008060' }}>
                        {item.costPrice && item.suggestedPrice ? `${(((item.suggestedPrice - item.costPrice) / item.suggestedPrice) * 100).toFixed(0)}%` : '-'}
                      </div></div>
                      <div><div style={{ fontSize: 10, color: '#6D7175' }}>Ships</div><div style={{ fontWeight: 600, fontSize: 14 }}>{item.shippingDays || '-'}d</div></div>
                    </div>

                    {score?.fitReasons?.length > 0 && (
                      <InlineStack gap="200" wrap>
                        {score.fitReasons.slice(0, 3).map((r: string, i: number) => (
                          <Badge key={i} tone="success">{r}</Badge>
                        ))}
                      </InlineStack>
                    )}

                    <Divider />
                    <InlineStack gap="200" align="end">
                      <Button size="slim" tone="critical" variant="plain"
                        onClick={() => handleDelete(item.id)}
                        loading={actionLoading === item.id}>
                        Delete
                      </Button>
                      {item.status === 'CANDIDATE' && (
                        <>
                          <Button size="slim" onClick={() => handleReject(item.id)}
                            loading={actionLoading === item.id}>
                            Skip
                          </Button>
                          <Button size="slim" variant="primary"
                            onClick={() => handleApprove(item.id)}
                            loading={actionLoading === item.id}>
                            Import
                          </Button>
                        </>
                      )}
                      {item.status === 'REJECTED' && (
                        <Button size="slim" variant="primary"
                          onClick={() => handleApprove(item.id)}
                          loading={actionLoading === item.id}>
                          Restore & Import
                        </Button>
                      )}
                    </InlineStack>
                  </BlockStack>
                </Card>
              );
            })}
          </InlineGrid>
        )}

        {/* Detail Modal */}
        {selectedCandidate && (
          <Modal
            open onClose={() => setSelectedCandidate(null)}
            title={selectedCandidate.title} size="large"
            primaryAction={selectedCandidate.status !== 'APPROVED' ? {
              content: 'Import to Shopify',
              onAction: () => handleApprove(selectedCandidate.id),
              loading: actionLoading === selectedCandidate.id,
            } : undefined}
            secondaryActions={[{ content: 'Close', onAction: () => setSelectedCandidate(null) }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <Text as="p">{selectedCandidate.description}</Text>
                <InlineStack gap="300">
                  {selectedCandidate.reviewCount && <Badge>Rating: {selectedCandidate.reviewRating} ({selectedCandidate.reviewCount.toLocaleString()} reviews)</Badge>}
                  {selectedCandidate.orderVolume && <Badge>{selectedCandidate.orderVolume.toLocaleString()} orders</Badge>}
                  <Badge>Source: {selectedCandidate.sourceName || selectedCandidate.providerType}</Badge>
                </InlineStack>
                {selectedCandidate.score && (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingMd">Score Breakdown</Text>
                    <InlineGrid columns={2} gap="300">
                      <ScoreBar label="Domain Fit" value={selectedCandidate.score.domainFit} color="#5C6AC4" />
                      <ScoreBar label="Store Fit" value={selectedCandidate.score.storeFit} color="#5C6AC4" />
                      <ScoreBar label="Audience Fit" value={selectedCandidate.score.audienceFit} color="#007ACE" />
                      <ScoreBar label="Trend Fit" value={selectedCandidate.score.trendFit} color="#007ACE" />
                      <ScoreBar label="Visual Virality" value={selectedCandidate.score.visualVirality} color="#9C6ADE" />
                      <ScoreBar label="Novelty" value={selectedCandidate.score.novelty} color="#9C6ADE" />
                      <ScoreBar label="Price Fit" value={selectedCandidate.score.priceFit} color="#008060" />
                      <ScoreBar label="Margin Fit" value={selectedCandidate.score.marginFit} color="#008060" />
                      <ScoreBar label="Shipping" value={selectedCandidate.score.shippingFit} color="#B98900" />
                      <ScoreBar label="Low Saturation" value={selectedCandidate.score.saturationInverse} color="#B98900" />
                    </InlineGrid>
                    {selectedCandidate.score.explanation && (
                      <div style={{ padding: '12px 16px', borderRadius: 8, background: '#F0F5FF', border: '1px solid #B4D5FE' }}>
                        <Text as="p" variant="bodySm">{selectedCandidate.score.explanation}</Text>
                      </div>
                    )}
                  </>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}

        <div style={{ paddingBottom: 40 }} />
      </BlockStack>
    </Page>
  );
}
