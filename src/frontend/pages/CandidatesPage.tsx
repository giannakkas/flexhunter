import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  Thumbnail, EmptyState, Modal, ProgressBar, Divider,
  InlineGrid, Tabs, Banner,
} from '@shopify/polaris';
import { useApi } from '../hooks/useApi';

const STATUS_BADGES: Record<string, { tone: any; label: string }> = {
  CANDIDATE: { tone: 'info', label: 'New' },
  APPROVED: { tone: 'success', label: 'Approved' },
  IMPORTING: { tone: 'attention', label: 'Importing...' },
  REJECTED: { tone: 'critical', label: 'Skipped' },
};

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm">{label}</Text>
        <Text as="span" variant="bodySm" fontWeight="semibold">{value}</Text>
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
  const { data: candidates, get, loading } = useApi<any[]>();
  const { post } = useApi();
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    await post(`/candidates/${id}/approve`);
    await get(`/candidates?status=${statusFilter}&sort=score`);
    setActionLoading(null);
    setSelectedCandidate(null);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    await post(`/candidates/${id}/reject`);
    await get(`/candidates?status=${statusFilter}&sort=score`);
    setActionLoading(null);
  };

  const items = candidates || [];

  return (
    <Page
      title="Product Candidates"
      subtitle={`${items.length} products ${statusFilter === 'CANDIDATE' ? 'ready for review' : ''}`}
    >
      <BlockStack gap="400">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />

        {items.length === 0 && !loading ? (
          <Card>
            <EmptyState
              heading={statusFilter === 'CANDIDATE' ? 'No candidates yet' : `No ${statusFilter.toLowerCase()} products`}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <Text as="p">
                {statusFilter === 'CANDIDATE'
                  ? 'Run a research pipeline from the Dashboard to discover products for your store.'
                  : 'Products will appear here as you review candidates.'}
              </Text>
            </EmptyState>
          </Card>
        ) : (
          <InlineGrid columns={2} gap="400">
            {items.map((item: any) => {
              const score = item.score;
              const finalScore = score?.finalScore || 0;
              const scoreColor = finalScore >= 70 ? '#008060' : finalScore >= 50 ? '#B98900' : '#D72C0D';
              const statusBadge = STATUS_BADGES[item.status] || { tone: 'info', label: item.status };

              return (
                <Card key={item.id}>
                  <BlockStack gap="300">
                    {/* Header */}
                    <InlineStack align="space-between" blockAlign="start">
                      <InlineStack gap="300" blockAlign="start">
                        <Thumbnail
                          source={item.imageUrls?.[0] || 'https://via.placeholder.com/60x60/f0f0f0/999?text=No+img'}
                          alt={item.title}
                          size="medium"
                        />
                        <BlockStack gap="100">
                          <Button variant="plain" onClick={() => setSelectedCandidate(item)}>
                            <Text as="span" variant="headingSm">{item.title}</Text>
                          </Button>
                          <InlineStack gap="200">
                            <Badge tone="info">{item.category || 'Uncategorized'}</Badge>
                            <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
                          </InlineStack>
                        </BlockStack>
                      </InlineStack>

                      {/* Score Circle */}
                      <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        border: `3px solid ${scoreColor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Text as="span" variant="headingSm" fontWeight="bold">
                          {finalScore.toFixed(0)}
                        </Text>
                      </div>
                    </InlineStack>

                    {/* Price & Margin */}
                    <InlineStack gap="400">
                      <BlockStack gap="0">
                        <Text as="p" variant="bodySm" tone="subdued">Sell Price</Text>
                        <Text as="p" variant="headingSm">${item.suggestedPrice?.toFixed(2) || '—'}</Text>
                      </BlockStack>
                      <BlockStack gap="0">
                        <Text as="p" variant="bodySm" tone="subdued">Cost</Text>
                        <Text as="p" variant="headingSm">${item.costPrice?.toFixed(2) || '—'}</Text>
                      </BlockStack>
                      {item.costPrice && item.suggestedPrice && (
                        <BlockStack gap="0">
                          <Text as="p" variant="bodySm" tone="subdued">Margin</Text>
                          <Text as="p" variant="headingSm" tone="success">
                            {(((item.suggestedPrice - item.costPrice) / item.suggestedPrice) * 100).toFixed(0)}%
                          </Text>
                        </BlockStack>
                      )}
                      {item.shippingDays && (
                        <BlockStack gap="0">
                          <Text as="p" variant="bodySm" tone="subdued">Ships in</Text>
                          <Text as="p" variant="headingSm">{item.shippingDays}d</Text>
                        </BlockStack>
                      )}
                    </InlineStack>

                    {/* Fit Reasons */}
                    {score?.fitReasons?.length > 0 && (
                      <InlineStack gap="200" wrap>
                        {score.fitReasons.slice(0, 3).map((r: string, i: number) => (
                          <Badge key={i} tone="success">{r}</Badge>
                        ))}
                      </InlineStack>
                    )}

                    {/* Actions */}
                    {item.status === 'CANDIDATE' && (
                      <>
                        <Divider />
                        <InlineStack gap="200" align="end">
                          <Button
                            size="slim"
                            tone="critical"
                            onClick={() => handleReject(item.id)}
                            loading={actionLoading === item.id}
                          >
                            Skip
                          </Button>
                          <Button
                            size="slim"
                            variant="primary"
                            onClick={() => handleApprove(item.id)}
                            loading={actionLoading === item.id}
                          >
                            ✅ Import to Shopify
                          </Button>
                        </InlineStack>
                      </>
                    )}
                  </BlockStack>
                </Card>
              );
            })}
          </InlineGrid>
        )}

        {/* Detail Modal */}
        {selectedCandidate && (
          <Modal
            open
            onClose={() => setSelectedCandidate(null)}
            title={selectedCandidate.title}
            size="large"
            primaryAction={
              selectedCandidate.status === 'CANDIDATE'
                ? {
                    content: '✅ Approve & Import',
                    onAction: () => handleApprove(selectedCandidate.id),
                    loading: actionLoading === selectedCandidate.id,
                  }
                : undefined
            }
            secondaryActions={[{ content: 'Close', onAction: () => setSelectedCandidate(null) }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <Text as="p">{selectedCandidate.description}</Text>

                <InlineStack gap="300">
                  <Badge>Source: {selectedCandidate.sourceName || selectedCandidate.providerType}</Badge>
                  {selectedCandidate.reviewCount && (
                    <Badge>⭐ {selectedCandidate.reviewRating} ({selectedCandidate.reviewCount} reviews)</Badge>
                  )}
                  {selectedCandidate.orderVolume && (
                    <Badge>📦 {selectedCandidate.orderVolume.toLocaleString()} orders</Badge>
                  )}
                </InlineStack>

                {selectedCandidate.score && (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingMd">Score Breakdown</Text>
                    <InlineGrid columns={2} gap="300">
                      <ScoreBar label="🧬 Domain Fit" value={selectedCandidate.score.domainFit} color="#5C6AC4" />
                      <ScoreBar label="🏪 Store Fit" value={selectedCandidate.score.storeFit} color="#5C6AC4" />
                      <ScoreBar label="🎯 Audience Fit" value={selectedCandidate.score.audienceFit} color="#007ACE" />
                      <ScoreBar label="📈 Trend Fit" value={selectedCandidate.score.trendFit} color="#007ACE" />
                      <ScoreBar label="📸 Visual Virality" value={selectedCandidate.score.visualVirality} color="#9C6ADE" />
                      <ScoreBar label="✨ Novelty" value={selectedCandidate.score.novelty} color="#9C6ADE" />
                      <ScoreBar label="💰 Price Fit" value={selectedCandidate.score.priceFit} color="#008060" />
                      <ScoreBar label="📊 Margin Fit" value={selectedCandidate.score.marginFit} color="#008060" />
                      <ScoreBar label="🚚 Shipping Fit" value={selectedCandidate.score.shippingFit} color="#B98900" />
                      <ScoreBar label="🏷️ Low Saturation" value={selectedCandidate.score.saturationInverse} color="#B98900" />
                    </InlineGrid>

                    {selectedCandidate.score.explanation && (
                      <div style={{
                        padding: '12px 16px', borderRadius: 8, background: '#F0F5FF',
                        border: '1px solid #B4D5FE',
                      }}>
                        <Text as="p" variant="bodySm">
                          💡 {selectedCandidate.score.explanation}
                        </Text>
                      </div>
                    )}

                    {selectedCandidate.score.concerns?.length > 0 && (
                      <InlineStack gap="200" wrap>
                        {selectedCandidate.score.concerns.map((c: string, i: number) => (
                          <Badge key={i} tone="warning">⚠️ {c}</Badge>
                        ))}
                      </InlineStack>
                    )}
                  </>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}
      </BlockStack>
    </Page>
  );
}
