import { friendlyError } from '../utils/errors';
import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  IndexTable, EmptyState, ProgressBar, Banner, Thumbnail, Modal,
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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<'success' | 'critical'>('success');

  useEffect(() => {
    get('/imports');
    apiFetch<any>('/shop-status').then(r => setShopStatus(r.data)).catch(() => {});
  }, [get]);

  // Auto-dismiss message
  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 5000); return () => clearTimeout(t); }
  }, [message]);

  const handlePin = async (id: string) => { await post(`/imports/${id}/pin`, { reason: 'Pinned' }); get('/imports'); };
  const handleUnpin = async (id: string) => { await post(`/imports/${id}/unpin`); get('/imports'); };

  const handleDeleteOne = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await apiFetch<any>(`/imports/${deleteTarget}`, { method: 'DELETE' });
      setMessage(r.message || 'Product deleted.');
      setMsgTone('success');
    } catch (e: any) {
      setMessage(friendlyError(e.message));
      setMsgTone('critical');
    }
    setDeleting(false);
    setDeleteTarget(null);
    get('/imports');
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const r = await apiFetch<any>('/imports', { method: 'DELETE' });
      setMessage(r.message || 'All products deleted.');
      setMsgTone('success');
    } catch (e: any) {
      setMessage(friendlyError(e.message));
      setMsgTone('critical');
    }
    setDeleting(false);
    setDeleteAllOpen(false);
    get('/imports');
  };

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
          <InlineStack gap="100">
            <Badge tone={st.tone}>{st.label}</Badge>
            {item.shopifyStatus === 'MOCK' && <Badge tone="warning">Not in Shopify</Badge>}
          </InlineStack>
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
            <Button size="slim" variant="primary" onClick={() => navigate(`/seo?product=${item.id}`)}>SEO</Button>
            {item.isPinned
              ? <Button size="slim" onClick={() => handleUnpin(item.id)}>Unpin</Button>
              : <Button size="slim" onClick={() => handlePin(item.id)}>Pin</Button>
            }
            <Button size="slim" tone="critical" onClick={() => setDeleteTarget(item.id)}>Delete</Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Imported Products" subtitle={`${items.length} products`}
      secondaryActions={items.length > 0 ? [{ content: 'Delete All Imported', onAction: () => setDeleteAllOpen(true), destructive: true }] : []}
    >
      <BlockStack gap="400">
        {message && (
          <Banner tone={msgTone} onDismiss={() => setMessage(null)}>
            <Text as="p">{message}</Text>
          </Banner>
        )}

        {shopStatus && !shopStatus.hasToken && (
          <Banner tone="critical" title="Products are NOT appearing in your Shopify store"
            action={{ content: 'Setup Connection', onAction: () => navigate('/settings') }}>
            <Text as="p">Complete a quick 2-minute setup in Settings to connect FlexHunter to your store.</Text>
          </Banner>
        )}

        {items.length === 0 && !loading ? (
          <Card>
            <EmptyState heading="No products imported yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{ content: 'Go to Research', onAction: () => navigate('/candidates') }}
            >
              <Text as="p">Run AI research to discover and import winning products.</Text>
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
              selectable={false}
              loading={loading}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        )}

        {/* Delete One Modal */}
        <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Product"
          primaryAction={{ content: 'Delete Product', onAction: handleDeleteOne, destructive: true, loading: deleting }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setDeleteTarget(null) }]}
        >
          <Modal.Section>
            <Text as="p">This will permanently delete this product from FlexHunter and remove it from your Shopify store.</Text>
          </Modal.Section>
        </Modal>

        {/* Delete All Modal */}
        <Modal open={deleteAllOpen} onClose={() => setDeleteAllOpen(false)} title="Delete ALL Imported Products"
          primaryAction={{ content: `Delete All ${items.length} Products`, onAction: handleDeleteAll, destructive: true, loading: deleting }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setDeleteAllOpen(false) }]}
        >
          <Modal.Section>
            <BlockStack gap="200">
              <Text as="p">This will permanently delete ALL {items.length} imported products from FlexHunter and remove them from your Shopify store.</Text>
              <Text as="p" fontWeight="bold" tone="critical">This cannot be undone.</Text>
            </BlockStack>
          </Modal.Section>
        </Modal>

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
