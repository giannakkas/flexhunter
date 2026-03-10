import React, { useEffect } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  IndexTable, EmptyState, ProgressBar, Tooltip,
} from '@shopify/polaris';
import { useApi } from '../hooks/useApi';

const STATUS_BADGES: Record<string, { tone: any; label: string }> = {
  TESTING: { tone: 'attention', label: 'Testing' },
  WINNER: { tone: 'success', label: 'Winner' },
  WEAK: { tone: 'critical', label: 'Weak' },
  PINNED: { tone: 'info', label: 'Pinned' },
  REPLACEMENT_SUGGESTED: { tone: 'warning', label: 'Replace?' },
  AUTO_REPLACED: { tone: 'subdued', label: 'Replaced' },
  ARCHIVED: { tone: 'subdued', label: 'Archived' },
};

export function ImportsPage() {
  const { data: imports, get, loading } = useApi<any[]>();
  const { post } = useApi();

  useEffect(() => { get('/imports'); }, [get]);

  const handlePin = async (id: string) => {
    await post(`/imports/${id}/pin`, { reason: 'Merchant pinned' });
    get('/imports');
  };

  const handleUnpin = async (id: string) => {
    await post(`/imports/${id}/unpin`);
    get('/imports');
  };

  const items = imports || [];

  const rowMarkup = items.map((item: any, index: number) => {
    const perf = item.performance;
    const statusBadge = STATUS_BADGES[item.status] || { tone: 'info', label: item.status };

    return (
      <IndexTable.Row id={item.id} key={item.id} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd" fontWeight="semibold">{item.importedTitle}</Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {item.shopifyHandle ? `/${item.shopifyHandle}` : 'Draft'}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span">${item.importedPrice?.toFixed(2) || '—'}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {perf ? (
            <Tooltip content={`Views: ${perf.views} | Conv: ${perf.conversions} | Rev: $${perf.revenue.toFixed(2)}`}>
              <BlockStack gap="100">
                <Text as="span" variant="bodySm">{perf.healthScore}/100</Text>
                <ProgressBar
                  progress={perf.healthScore}
                  tone={perf.healthScore >= 60 ? 'success' : perf.healthScore >= 30 ? 'highlight' : 'critical'}
                  size="small"
                />
              </BlockStack>
            </Tooltip>
          ) : (
            <Text as="span" tone="subdued">No data</Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {perf ? (
            <BlockStack gap="100">
              <Text as="span" variant="bodySm">Views: {perf.views}</Text>
              <Text as="span" variant="bodySm">Conv: {perf.conversions} ({perf.conversionRate.toFixed(1)}%)</Text>
              <Text as="span" variant="bodySm">Rev: ${perf.revenue.toFixed(2)}</Text>
            </BlockStack>
          ) : (
            <Text as="span" tone="subdued">—</Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            {item.isPinned ? (
              <Button size="slim" onClick={() => handleUnpin(item.id)}>Unpin</Button>
            ) : (
              <Button size="slim" variant="primary" onClick={() => handlePin(item.id)}>Pin</Button>
            )}
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Imported Products" subtitle={`${items.length} products imported`}>
      {items.length === 0 && !loading ? (
        <Card>
          <EmptyState
            heading="No products imported yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p">Approve candidates from the research pipeline to start importing.</Text>
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <IndexTable
            resourceName={{ singular: 'product', plural: 'products' }}
            itemCount={items.length}
            headings={[
              { title: 'Product' },
              { title: 'Price' },
              { title: 'Status' },
              { title: 'Health' },
              { title: 'Performance' },
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
