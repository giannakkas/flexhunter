import React, { useEffect } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  IndexTable, EmptyState, Banner,
} from '@shopify/polaris';
import { useApi } from '../hooks/useApi';

const ACTION_BADGES: Record<string, { tone: any; label: string }> = {
  SUGGESTED: { tone: 'warning', label: 'Pending Review' },
  APPROVED: { tone: 'info', label: 'Approved' },
  EXECUTED: { tone: 'success', label: 'Executed' },
  REJECTED: { tone: 'critical', label: 'Rejected' },
  ROLLED_BACK: { tone: 'subdued', label: 'Rolled Back' },
};

export function ReplacementsPage() {
  const { data: decisions, get, loading } = useApi<any[]>();
  const { post } = useApi();

  useEffect(() => { get('/replacements'); }, [get]);

  const handleApprove = async (id: string) => {
    await post(`/replacements/${id}/approve`);
    get('/replacements');
  };

  const handleReject = async (id: string) => {
    await post(`/replacements/${id}/reject`, { reason: 'Merchant decided to keep product' });
    get('/replacements');
  };

  const items = decisions || [];
  const pendingCount = items.filter((i: any) => i.action === 'SUGGESTED').length;

  const rowMarkup = items.map((item: any, index: number) => {
    const actionBadge = ACTION_BADGES[item.action] || { tone: 'info', label: item.action };

    return (
      <IndexTable.Row id={item.id} key={item.id} position={index}>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {item.currentProduct?.importedTitle || 'Unknown Product'}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={actionBadge.tone}>{actionBadge.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span">{(item.confidence * 100).toFixed(0)}%</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">{item.reason || '—'}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">{item.fitExplanation || '—'}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {item.action === 'SUGGESTED' && (
            <InlineStack gap="200">
              <Button size="slim" variant="primary" onClick={() => handleApprove(item.id)}>
                Approve
              </Button>
              <Button size="slim" tone="critical" onClick={() => handleReject(item.id)}>
                Reject
              </Button>
            </InlineStack>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Replacement Queue" subtitle={`${pendingCount} pending review`}>
      <BlockStack gap="400">
        {pendingCount > 0 && (
          <Banner title={`${pendingCount} replacement(s) need your review`} tone="warning">
            <Text as="p">
              These products have been flagged as underperforming. Review the suggested replacements below.
            </Text>
          </Banner>
        )}

        {items.length === 0 && !loading ? (
          <Card>
            <EmptyState
              heading="No replacement decisions"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <Text as="p">
                Products will appear here when the performance tracker identifies underperformers.
              </Text>
            </EmptyState>
          </Card>
        ) : (
          <Card>
            <IndexTable
              resourceName={{ singular: 'replacement', plural: 'replacements' }}
              itemCount={items.length}
              headings={[
                { title: 'Current Product' },
                { title: 'Status' },
                { title: 'Confidence' },
                { title: 'Reason' },
                { title: 'Replacement Fit' },
                { title: 'Actions' },
              ]}
              selectable={false}
              loading={loading}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        )}
        <div style={{ height: 60 }} />
      </BlockStack>
    </Page>
  );
}
