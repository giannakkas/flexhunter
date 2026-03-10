import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  IndexTable, Thumbnail, Filters, ChoiceList, EmptyState,
  Tooltip, ProgressBar, Modal,
} from '@shopify/polaris';
import { useApi } from '../hooks/useApi';

const STATUS_BADGES: Record<string, { tone: any; label: string }> = {
  CANDIDATE: { tone: 'info', label: 'Candidate' },
  APPROVED: { tone: 'success', label: 'Approved' },
  IMPORTING: { tone: 'attention', label: 'Importing' },
  REJECTED: { tone: 'critical', label: 'Rejected' },
};

export function CandidatesPage() {
  const { data: candidates, get, loading } = useApi<any[]>();
  const { post } = useApi();
  const [statusFilter, setStatusFilter] = useState<string[]>(['CANDIDATE']);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

  useEffect(() => {
    get(`/candidates?status=${statusFilter.join(',')}&sort=score`);
  }, [get, statusFilter]);

  const handleApprove = async (id: string) => {
    await post(`/candidates/${id}/approve`);
    get(`/candidates?status=${statusFilter.join(',')}&sort=score`);
  };

  const handleReject = async (id: string) => {
    await post(`/candidates/${id}/reject`);
    get(`/candidates?status=${statusFilter.join(',')}&sort=score`);
  };

  const items = candidates || [];

  const resourceName = { singular: 'candidate', plural: 'candidates' };

  const rowMarkup = items.map((item: any, index: number) => {
    const score = item.score;
    const statusBadge = STATUS_BADGES[item.status] || { tone: 'info', label: item.status };

    return (
      <IndexTable.Row id={item.id} key={item.id} position={index}>
        <IndexTable.Cell>
          <Thumbnail
            source={item.imageUrls?.[0] || 'https://via.placeholder.com/40'}
            alt={item.title}
            size="small"
          />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="100">
            <Button variant="plain" onClick={() => setSelectedCandidate(item)}>
              <Text as="span" variant="bodyMd" fontWeight="semibold">{item.title}</Text>
            </Button>
            <Text as="span" variant="bodySm" tone="subdued">{item.category}</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">${item.suggestedPrice?.toFixed(2) || '—'}</Text>
          <br />
          <Text as="span" variant="bodySm" tone="subdued">Cost: ${item.costPrice?.toFixed(2) || '—'}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {score && (
            <Tooltip content={`Domain: ${score.domainFit} | Audience: ${score.audienceFit} | Trend: ${score.trendFit}`}>
              <BlockStack gap="100">
                <Text as="span" variant="bodyMd" fontWeight="bold">
                  {score.finalScore.toFixed(1)}
                </Text>
                <ProgressBar
                  progress={score.finalScore}
                  tone={score.finalScore >= 70 ? 'success' : score.finalScore >= 50 ? 'highlight' : 'critical'}
                  size="small"
                />
              </BlockStack>
            </Tooltip>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {item.status === 'CANDIDATE' && (
            <InlineStack gap="200">
              <Button size="slim" variant="primary" onClick={() => handleApprove(item.id)}>Import</Button>
              <Button size="slim" tone="critical" onClick={() => handleReject(item.id)}>Skip</Button>
            </InlineStack>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Product Candidates" subtitle={`${items.length} candidates found`}>
      <BlockStack gap="400">
        <Card>
          <Filters
            queryValue=""
            queryPlaceholder="Search candidates..."
            onQueryChange={() => {}}
            onQueryClear={() => {}}
            onClearAll={() => setStatusFilter(['CANDIDATE'])}
            filters={[
              {
                key: 'status',
                label: 'Status',
                filter: (
                  <ChoiceList
                    title="Status"
                    titleHidden
                    allowMultiple
                    choices={[
                      { label: 'Candidate', value: 'CANDIDATE' },
                      { label: 'Approved', value: 'APPROVED' },
                      { label: 'Rejected', value: 'REJECTED' },
                    ]}
                    selected={statusFilter}
                    onChange={setStatusFilter}
                  />
                ),
                shortcut: true,
              },
            ]}
          />
        </Card>

        {items.length === 0 && !loading ? (
          <Card>
            <EmptyState
              heading="No candidates yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <Text as="p">Run a research pipeline to discover product candidates for your store.</Text>
            </EmptyState>
          </Card>
        ) : (
          <Card>
            <IndexTable
              resourceName={resourceName}
              itemCount={items.length}
              headings={[
                { title: '' },
                { title: 'Product' },
                { title: 'Price' },
                { title: 'Score' },
                { title: 'Status' },
                { title: 'Actions' },
              ]}
              selectable={false}
              loading={loading}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        )}

        {/* Detail Modal */}
        {selectedCandidate && (
          <Modal
            open
            onClose={() => setSelectedCandidate(null)}
            title={selectedCandidate.title}
            primaryAction={
              selectedCandidate.status === 'CANDIDATE'
                ? { content: 'Approve & Import', onAction: () => { handleApprove(selectedCandidate.id); setSelectedCandidate(null); } }
                : undefined
            }
            secondaryActions={[{ content: 'Close', onAction: () => setSelectedCandidate(null) }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <Text as="p">{selectedCandidate.description}</Text>

                <InlineStack gap="400">
                  <Badge>Category: {selectedCandidate.category}</Badge>
                  <Badge>Source: {selectedCandidate.sourceName || selectedCandidate.providerType}</Badge>
                  {selectedCandidate.shippingDays && <Badge>Ships in {selectedCandidate.shippingDays} days</Badge>}
                </InlineStack>

                {selectedCandidate.score && (
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Score Breakdown</Text>
                    {Object.entries(selectedCandidate.score)
                      .filter(([k]) => !['id', 'candidateId', 'scoredAt', 'createdAt', 'updatedAt', 'scoringVersion'].includes(k))
                      .filter(([, v]) => typeof v === 'number')
                      .map(([key, value]) => (
                        <InlineStack key={key} align="space-between">
                          <Text as="span" variant="bodySm">{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                          <Text as="span" variant="bodySm" fontWeight="semibold">{(value as number).toFixed(1)}</Text>
                        </InlineStack>
                      ))}

                    {selectedCandidate.score.explanation && (
                      <BlockStack gap="100">
                        <Text as="h4" variant="headingSm">Why This Product?</Text>
                        <Text as="p">{selectedCandidate.score.explanation}</Text>
                      </BlockStack>
                    )}

                    {selectedCandidate.score.fitReasons?.length > 0 && (
                      <InlineStack gap="200" wrap>
                        {selectedCandidate.score.fitReasons.map((r: string, i: number) => (
                          <Badge key={i} tone="success">{r}</Badge>
                        ))}
                      </InlineStack>
                    )}

                    {selectedCandidate.score.concerns?.length > 0 && (
                      <InlineStack gap="200" wrap>
                        {selectedCandidate.score.concerns.map((c: string, i: number) => (
                          <Badge key={i} tone="warning">{c}</Badge>
                        ))}
                      </InlineStack>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}
      </BlockStack>
    </Page>
  );
}
