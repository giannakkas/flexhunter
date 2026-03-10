import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  IndexTable, EmptyState, ProgressBar, Banner, Thumbnail,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi, apiFetch } from '../hooks/useApi';

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
  const [shopStatus, setShopStatus] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    get('/imports');
    apiFetch<any>('/shop-status').then(r => setShopStatus(r.data)).catch(() => {});
  }, [get]);

  const handlePin = async (id: string) => { await post(`/imports/${id}/pin`, { reason: 'Pinned' }); get('/imports'); };
  const handleUnpin = async (id: string) => { await post(`/imports/${id}/unpin`); get('/imports'); };

  const items = imports || [];

  const rowMarkup = items.map((item: any, index: number) => {
    const perf = item.performance;
    const st = STATUS_MAP[item.status] || { tone: 'info', label: item.status };
    const imgUrl = item.candidate?.imageUrls?.[0] || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';

    return (
      <IndexTable.Row id={item.id} key={item.id} position={index} selected={selectedIds.has(item.id)}>
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center">
            <Thumbnail source={imgUrl} alt={item.importedTitle} size="small" />
            <BlockStack gap="0">
              <Text as="span" variant="bodyMd" fontWeight="semibold">{item.importedTitle}</Text>
              <Text as="span" variant="bodySm" tone="subdued">
                {item.shopifyStatus === 'MOCK' ? 'Local only' : `/${item.shopifyHandle || ''}`}
              </Text>
            </BlockStack>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span">${item.importedPrice?.toFixed(2) || '-'}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={st.tone}>{st.label}</Badge>
          {item.shopifyStatus === 'MOCK' && <Badge tone="warning">Not in Shopify</Badge>}
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
          <InlineStack gap="200">
            <Button size="slim" variant="primary" onClick={() => navigate(`/seo?product=${item.id}`)}>
              SEO
            </Button>
            {item.isPinned
              ? <Button size="slim" onClick={() => handleUnpin(item.id)}>Unpin</Button>
              : <Button size="slim" onClick={() => handlePin(item.id)}>Pin</Button>
            }
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Imported Products" subtitle={`${items.length} products`}>
      <BlockStack gap="400">
        {/* Shopify connection warning */}
        {shopStatus && !shopStatus.hasToken && (
          <Banner tone="critical" title="Products are NOT appearing in your Shopify store"
            action={{
              content: 'Connect to Shopify Now',
              onAction: () => {
                const url = `https://flexhunter-production.up.railway.app/api/connect-shopify?shop=${shopStatus.domain || ''}`;
                if (window.top) window.top.location.href = url; else window.location.href = url;
              },
            }}>
            <Text as="p">Click the button to connect FlexHunter with your Shopify store.</Text>
          </Banner>
        )}

        {shopStatus && shopStatus.hasToken && (
          <Banner tone="warning" title="Need to re-authorize?"
            action={{
              content: 'Re-Authorize App',
              onAction: () => {
                const url = `https://flexhunter-production.up.railway.app/api/auth?shop=${shopStatus.domain || ''}`;
                if (window.top) window.top.location.href = url; else window.location.href = url;
              },
            }}>
            <Text as="p">
              If imports fail with a "scope" error, click Re-Authorize to grant FlexHunter 
              permission to create products in your store.
            </Text>
          </Banner>
        )}

        {selectedIds.size > 0 && (
          <InlineStack gap="200">
            <Badge>{selectedIds.size} selected</Badge>
            <Button size="slim" variant="primary" onClick={() => {
              for (const id of selectedIds) navigate(`/seo?product=${id}`);
            }}>Optimize SEO</Button>
          </InlineStack>
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
                { title: 'Actions' },
              ]}
              selectable={true}
              selectedItemsCount={selectedIds.size}
              onSelectionChange={(type) => {
                if (type === 'page') {
                  selectedIds.size === items.length
                    ? setSelectedIds(new Set())
                    : setSelectedIds(new Set(items.map((i: any) => i.id)));
                } else {
                  setSelectedIds(new Set());
                }
              }}
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
