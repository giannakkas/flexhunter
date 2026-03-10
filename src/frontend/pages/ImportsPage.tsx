import React, { useEffect } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  IndexTable, EmptyState, ProgressBar, Banner,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';

const STATUS_MAP: Record<string, { tone: any; label: string }> = {
  TESTING: { tone: 'attention', label: 'Testing' },
  WINNER: { tone: 'success', label: 'Winner' },
  WEAK: { tone: 'critical', label: 'Weak' },
  PINNED: { tone: 'info', label: 'Pinned' },
  REPLACEMENT_SUGGESTED: { tone: 'warning', label: 'Replace?' },
  AUTO_REPLACED: { tone: 'subdued', label: 'Replaced' },
  ARCHIVED: { tone: 'subdued', label: 'Archived' },
};

export function ImportsPage() {
  const navigate = useNavigate();
  const { data: imports, get, loading } = useApi<any[]>();
  const { post } = useApi();

  useEffect(() => { get('/imports'); }, [get]);

  const handlePin = async (id: string) => { await post(`/imports/${id}/pin`, { reason: 'Pinned by merchant' }); get('/imports'); };
  const handleUnpin = async (id: string) => { await post(`/imports/${id}/unpin`); get('/imports'); };

  const items = imports || [];
  const hasNew = items.some((i: any) => !i.seoOptimized);

  const rowMarkup = items.map((item: any, index: number) => {
    const perf = item.performance;
    const st = STATUS_MAP[item.status] || { tone: 'info', label: item.status };

    return (
      <IndexTable.Row id={item.id} key={item.id} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd" fontWeight="semibold">{item.importedTitle}</Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {item.shopifyHandle ? `/${item.shopifyHandle}` : 'Local only'}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span">${item.importedPrice?.toFixed(2) || '-'}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={st.tone}>{st.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {perf ? (
            <BlockStack gap="100">
              <Text as="span" variant="bodySm">{perf.healthScore}/100</Text>
              <ProgressBar progress={perf.healthScore}
                tone={perf.healthScore >= 60 ? 'success' : perf.healthScore >= 30 ? 'highlight' : 'critical'}
                size="small" />
            </BlockStack>
          ) : <Text as="span" tone="subdued">-</Text>}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {perf ? (
            <Text as="span" variant="bodySm">
              {perf.views} views / {perf.conversions} sales
            </Text>
          ) : <Text as="span" tone="subdued">No data</Text>}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button size="slim" variant="primary"
              onClick={() => navigate(`/seo?product=${item.id}`)}>
              Optimize SEO
            </Button>
            {item.isPinned ? (
              <Button size="slim" onClick={() => handleUnpin(item.id)}>Unpin</Button>
            ) : (
              <Button size="slim" onClick={() => handlePin(item.id)}>Pin</Button>
            )}
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Imported Products" subtitle={`${items.length} products`}>
      <BlockStack gap="400">
        {hasNew && (
          <Banner tone="info" title="Optimize your products for search">
            <Text as="p">
              Products perform better with optimized titles, descriptions, and meta tags.
              Click "Optimize SEO" on each product for AI-powered recommendations.
            </Text>
          </Banner>
        )}

        {items.length === 0 && !loading ? (
          <Card>
            <EmptyState heading="No products imported yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{ content: 'Browse Candidates', onAction: () => navigate('/candidates') }}
            >
              <Text as="p">Approve candidates from research to start importing.</Text>
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

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
