import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  EmptyState, Modal, Divider, Tabs, Spinner, Banner, TextField,
  IndexTable, Thumbnail, InlineGrid, Checkbox,
} from '@shopify/polaris';
import { useApi, apiFetch } from '../hooks/useApi';

const PLACEHOLDER_IMG = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';

function AutoDismissBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 400); }, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease', maxHeight: visible ? 200 : 0, overflow: 'hidden' }}>
      <Banner tone={message.includes('Error') || message.includes('failed') ? 'critical' : 'success'} onDismiss={onDismiss}>
        <Text as="p">{message}</Text>
      </Banner>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm">{label}</Text>
        <Text as="span" variant="bodySm" fontWeight="semibold">{Math.round(value)}</Text>
      </InlineStack>
      <div style={{ height: 5, borderRadius: 3, background: '#E4E5E7', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${Math.min(100, value)}%` }} />
      </div>
    </BlockStack>
  );
}

function ImgWithFallback({ src, size = 40 }: { src?: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  const url = (!src || errored) ? PLACEHOLDER_IMG : src;
  return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'cover', borderRadius: 6, background: '#f0f0f0' }} onError={() => setErrored(true)} />;
}

export function CandidatesPage() {
  const { data: candidates, get, loading } = useApi<any[]>();
  const [selectedTab, setSelectedTab] = useState(0);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'rows' | 'cards'>('rows');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; body: string; action: () => void }>({
    open: false, title: '', body: '', action: () => {},
  });

  const tabs = [
    { id: 'CANDIDATE', content: 'New' },
    { id: 'APPROVED', content: 'Imported' },
    { id: 'REJECTED', content: 'Skipped' },
  ];
  const statusFilter = tabs[selectedTab].id;

  useEffect(() => {
    get(`/candidates?status=${statusFilter}&sort=score`);
    setSelectedIds(new Set());
  }, [get, statusFilter]);

  const doAction = async (fn: () => Promise<void>) => { try { await fn(); } catch {} await get(`/candidates?status=${statusFilter}&sort=score`); };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try { const r = await apiFetch<any>(`/candidates/${id}/approve`, { method: 'POST' }); setMessage(r.message || 'Imported!'); }
    catch (e: any) { setMessage(`Error: ${e.message}`); }
    await get(`/candidates?status=${statusFilter}&sort=score`);
    setActionLoading(null); setPreviewItem(null);
  };

  const handleReject = (id: string) => doAction(async () => { setActionLoading(id); await apiFetch(`/candidates/${id}/reject`, { method: 'POST' }); setActionLoading(null); });

  const handleDelete = (id: string) => {
    setConfirmModal({ open: true, title: 'Delete Candidate', body: 'Permanently delete this candidate?', action: async () => {
      setConfirmModal(p => ({ ...p, open: false })); await apiFetch(`/candidates/${id}`, { method: 'DELETE' });
      await get(`/candidates?status=${statusFilter}&sort=score`);
    }});
  };

  const handleBulkDelete = () => {
    if (!selectedIds.size) return;
    setConfirmModal({ open: true, title: `Delete ${selectedIds.size} items`, body: `Permanently delete ${selectedIds.size} candidates?`, action: async () => {
      setConfirmModal(p => ({ ...p, open: false }));
      for (const id of selectedIds) await apiFetch(`/candidates/${id}`, { method: 'DELETE' }).catch(() => {});
      setSelectedIds(new Set()); await get(`/candidates?status=${statusFilter}&sort=score`); setMessage(`Deleted`);
    }});
  };

  const handleBulkApprove = async () => {
    if (!selectedIds.size) return;
    for (const id of selectedIds) await apiFetch(`/candidates/${id}/approve`, { method: 'POST' }).catch(() => {});
    setSelectedIds(new Set()); await get(`/candidates?status=${statusFilter}&sort=score`); setMessage(`Imported ${selectedIds.size} products`);
  };

  const handleResetAll = () => {
    setConfirmModal({ open: true, title: 'Clear All', body: 'Delete ALL non-imported candidates?', action: async () => {
      setConfirmModal(p => ({ ...p, open: false })); await apiFetch('/candidates/reset', { method: 'POST' });
      await get(`/candidates?status=${statusFilter}&sort=score`); setMessage('Cleared.');
    }});
  };

  const items = (candidates || []).filter((i: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return i.title.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q) || (i.sourceName || '').toLowerCase().includes(q);
  });

  const profit = (item: any) => {
    if (!item.costPrice || !item.suggestedPrice) return null;
    return item.suggestedPrice - item.costPrice;
  };
  const margin = (item: any) => {
    if (!item.costPrice || !item.suggestedPrice) return null;
    return ((item.suggestedPrice - item.costPrice) / item.suggestedPrice * 100);
  };

  // ── Row Markup ──────────────────────────────
  const rowMarkup = items.map((item: any, idx: number) => {
    const s = item.score; const fs = s?.finalScore || 0;
    const sc = fs >= 80 ? '#008060' : fs >= 65 ? '#47B881' : fs >= 50 ? '#B98900' : fs >= 35 ? '#DE6E1E' : '#D72C0D';
    const m = margin(item);

    return (
      <IndexTable.Row id={item.id} key={item.id} position={idx} selected={selectedIds.has(item.id)}>
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center">
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${sc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{fs.toFixed(0)}</div>
            <ImgWithFallback src={item.imageUrls?.[0]} size={40} />
            <BlockStack gap="0">
              <button onClick={() => setPreviewItem(item)} style={{ all: 'unset', cursor: 'pointer', color: '#2C6ECB', fontWeight: 600, fontSize: 13 }}>
                {item.title.length > 42 ? item.title.slice(0, 42) + '...' : item.title}
              </button>
              <InlineStack gap="100">
                <Text as="span" variant="bodySm" tone="subdued">{item.category || 'General'}</Text>
                <Text as="span" variant="bodySm" tone="subdued">·</Text>
                <Text as="span" variant="bodySm" tone="subdued">{item.sourceName || item.providerType}</Text>
              </InlineStack>
            </BlockStack>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="0">
            <Text as="span" variant="bodySm" fontWeight="semibold">${item.suggestedPrice?.toFixed(2)}</Text>
            <Text as="span" variant="bodySm" tone="subdued">Cost ${item.costPrice?.toFixed(2)}</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell><Text as="span" tone="success" fontWeight="semibold">{m !== null ? m.toFixed(0) + '%' : '-'}</Text></IndexTable.Cell>
        <IndexTable.Cell><Text as="span" variant="bodySm">{item.shippingDays}d</Text></IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
            <Button size="micro" onClick={() => setPreviewItem(item)}>View</Button>
            {item.sourceUrl && <Button size="micro" url={item.sourceUrl} external>Source</Button>}
            {item.status === 'CANDIDATE' && <>
              <Button size="micro" variant="primary" onClick={() => handleApprove(item.id)} loading={actionLoading === item.id}>Import</Button>
              <Button size="micro" onClick={() => handleReject(item.id)}>Skip</Button>
            </>}
            {item.status === 'REJECTED' && <Button size="micro" variant="primary" onClick={() => handleApprove(item.id)}>Restore</Button>}
            <Button size="micro" tone="critical" variant="plain" onClick={() => handleDelete(item.id)}>Del</Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  // ── Card Markup ──────────────────────────────
  const cardMarkup = (
    <InlineGrid columns={2} gap="400">
      {items.map((item: any) => {
        const s = item.score; const fs = s?.finalScore || 0;
        const sc = fs >= 80 ? '#008060' : fs >= 65 ? '#47B881' : fs >= 50 ? '#B98900' : fs >= 35 ? '#DE6E1E' : '#D72C0D';
        const m = margin(item);
        const p = profit(item);
        return (
          <Card key={item.id}>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="start">
                <InlineStack gap="300" blockAlign="start">
                  <ImgWithFallback src={item.imageUrls?.[0]} size={56} />
                  <BlockStack gap="100">
                    <button onClick={() => setPreviewItem(item)} style={{ all: 'unset', cursor: 'pointer', color: '#2C6ECB', fontWeight: 600, fontSize: 14 }}>
                      {item.title}
                    </button>
                    <InlineStack gap="100">
                      <Badge tone="info">{item.category || 'General'}</Badge>
                      <Badge>{item.sourceName || item.providerType}</Badge>
                    </InlineStack>
                  </BlockStack>
                </InlineStack>
                <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${sc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{fs.toFixed(0)}</div>
              </InlineStack>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, background: '#FAFBFC', borderRadius: 8, padding: '10px 12px' }}>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Sell</div><div style={{ fontWeight: 600, fontSize: 14 }}>${item.suggestedPrice?.toFixed(2)}</div></div>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Cost</div><div style={{ fontWeight: 600, fontSize: 14 }}>${item.costPrice?.toFixed(2)}</div></div>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Margin</div><div style={{ fontWeight: 600, fontSize: 14, color: '#008060' }}>{m !== null ? m.toFixed(0) : '-'}%</div></div>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Profit</div><div style={{ fontWeight: 600, fontSize: 14, color: '#008060' }}>${p !== null ? p.toFixed(2) : '-'}</div></div>
              </div>
              {s?.fitReasons?.length > 0 && <InlineStack gap="200" wrap>{s.fitReasons.slice(0, 2).map((r: string, i: number) => <Badge key={i} tone="success">{r}</Badge>)}</InlineStack>}
              <Divider />
              <InlineStack gap="200" align="end">
                <Button size="slim" tone="critical" variant="plain" onClick={() => handleDelete(item.id)}>Delete</Button>
                {item.sourceUrl && <Button size="slim" url={item.sourceUrl} external>Source</Button>}
                {item.status === 'CANDIDATE' && <>
                  <Button size="slim" onClick={() => handleReject(item.id)}>Skip</Button>
                  <Button size="slim" variant="primary" onClick={() => handleApprove(item.id)} loading={actionLoading === item.id}>Import</Button>
                </>}
                {item.status === 'REJECTED' && <Button size="slim" variant="primary" onClick={() => handleApprove(item.id)}>Restore</Button>}
              </InlineStack>
            </BlockStack>
          </Card>
        );
      })}
    </InlineGrid>
  );

  // ── Preview Modal ──────────────────────────────
  const previewModal = previewItem && (
    <Modal open onClose={() => setPreviewItem(null)} title={previewItem.title} size="large"
      primaryAction={previewItem.status === 'CANDIDATE' ? { content: 'Import to Store', onAction: () => handleApprove(previewItem.id), loading: actionLoading === previewItem.id } : undefined}
      secondaryActions={[
        ...(previewItem.sourceUrl ? [{ content: 'View on Source', onAction: () => window.open(previewItem.sourceUrl, '_blank'), external: true }] : []),
        { content: 'Close', onAction: () => setPreviewItem(null) },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Images */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {(previewItem.imageUrls || []).length > 0 ? (
              previewItem.imageUrls.map((url: string, i: number) => (
                <ImgWithFallback key={i} src={url} size={120} />
              ))
            ) : (
              <ImgWithFallback size={120} />
            )}
          </div>

          {/* Pricing Card */}
          <div style={{ background: '#F0F5FF', borderRadius: 10, padding: '16px 20px', border: '1px solid #B4D5FE' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#6D7175', marginBottom: 2 }}>Selling Price</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>${previewItem.suggestedPrice?.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6D7175', marginBottom: 2 }}>Cost Price</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>${previewItem.costPrice?.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6D7175', marginBottom: 2 }}>Profit</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#008060' }}>${profit(previewItem)?.toFixed(2) || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6D7175', marginBottom: 2 }}>Margin</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#008060' }}>{margin(previewItem)?.toFixed(0) || '-'}%</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6D7175', marginBottom: 2 }}>Shipping</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{previewItem.shippingDays}d</div>
              </div>
            </div>
          </div>

          {/* Description */}
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">Description</Text>
            <Text as="p" variant="bodySm">{previewItem.description || 'No description available.'}</Text>
          </BlockStack>

          {/* Metadata */}
          <InlineStack gap="200" wrap>
            <Badge>{previewItem.sourceName || previewItem.providerType}</Badge>
            <Badge tone="info">{previewItem.category || 'General'}</Badge>
            {previewItem.subcategory && <Badge>{previewItem.subcategory}</Badge>}
            {previewItem.warehouseCountry && <Badge>Ships from {previewItem.warehouseCountry}</Badge>}
            {previewItem.shippingSpeed && <Badge>{previewItem.shippingSpeed}</Badge>}
            {previewItem.reviewCount > 0 && <Badge tone="success">{previewItem.reviewRating?.toFixed(1)} ({previewItem.reviewCount.toLocaleString()} reviews)</Badge>}
            {previewItem.orderVolume > 0 && <Badge>{previewItem.orderVolume.toLocaleString()} orders</Badge>}
          </InlineStack>

          {/* Score Breakdown */}
          {previewItem.score && <>
            <Divider />
            <Text as="h3" variant="headingSm">Score Breakdown (Overall: {previewItem.score.finalScore?.toFixed(0)}/100)</Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ScoreBar label="Domain Fit" value={previewItem.score.domainFit} color="#5C6AC4" />
              <ScoreBar label="Store Fit" value={previewItem.score.storeFit} color="#5C6AC4" />
              <ScoreBar label="Audience" value={previewItem.score.audienceFit} color="#007ACE" />
              <ScoreBar label="Trend" value={previewItem.score.trendFit} color="#007ACE" />
              <ScoreBar label="Virality" value={previewItem.score.visualVirality} color="#9C6ADE" />
              <ScoreBar label="Novelty" value={previewItem.score.novelty} color="#9C6ADE" />
              <ScoreBar label="Price Fit" value={previewItem.score.priceFit} color="#008060" />
              <ScoreBar label="Margin Fit" value={previewItem.score.marginFit} color="#008060" />
              <ScoreBar label="Shipping" value={previewItem.score.shippingFit} color="#B98900" />
              <ScoreBar label="Low Saturation" value={previewItem.score.saturationInverse} color="#B98900" />
            </div>
            {previewItem.score.explanation && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: '#F0F5FF', border: '1px solid #B4D5FE' }}>
                <Text as="p" variant="bodySm">{previewItem.score.explanation}</Text>
              </div>
            )}
            {previewItem.score.fitReasons?.length > 0 && (
              <InlineStack gap="200" wrap>
                {previewItem.score.fitReasons.map((r: string, i: number) => <Badge key={i} tone="success">{r}</Badge>)}
              </InlineStack>
            )}
            {previewItem.score.concerns?.length > 0 && (
              <InlineStack gap="200" wrap>
                {previewItem.score.concerns.map((r: string, i: number) => <Badge key={i} tone="warning">{r}</Badge>)}
              </InlineStack>
            )}
          </>}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );

  return (
    <Page title="Product Candidates" subtitle={`${items.length} products`}
      primaryAction={{ content: 'Run Research', onAction: async () => {
        setMessage('Running...'); await apiFetch('/research/start', { method: 'POST' });
        await get('/candidates?status=CANDIDATE&sort=score'); setSelectedTab(0); setMessage('Done!');
      }}}
      secondaryActions={[{ content: 'Clear All', onAction: handleResetAll, destructive: true }]}
    >
      <BlockStack gap="400">
        {message && <AutoDismissBanner message={message} onDismiss={() => setMessage(null)} />}

        <InlineStack align="space-between">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={i => { setSelectedTab(i); setSearchQuery(''); setSelectedIds(new Set()); }} fitted />
          <InlineStack gap="200">
            {selectedIds.size > 0 && <>
              <Badge>{selectedIds.size} selected</Badge>
              {statusFilter === 'CANDIDATE' && <Button size="slim" variant="primary" onClick={handleBulkApprove}>Import All</Button>}
              <Button size="slim" tone="critical" onClick={handleBulkDelete}>Delete</Button>
            </>}
            <Button size="slim" pressed={viewMode === 'rows'} onClick={() => setViewMode('rows')}>Rows</Button>
            <Button size="slim" pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}>Cards</Button>
          </InlineStack>
        </InlineStack>

        <TextField label="" labelHidden value={searchQuery} onChange={setSearchQuery} placeholder="Search products, categories, sources..." autoComplete="off" clearButton onClearButtonClick={() => setSearchQuery('')} />

        {loading && <Card><div style={{ textAlign: 'center', padding: 20 }}><Spinner /></div></Card>}

        {!loading && items.length === 0 && (
          <Card><EmptyState heading="No products" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            action={statusFilter === 'CANDIDATE' ? { content: 'Run Research', onAction: async () => {
              await apiFetch('/research/start', { method: 'POST' }); await get('/candidates?status=CANDIDATE&sort=score');
            }} : undefined}><Text as="p">Run research to discover products.</Text></EmptyState></Card>
        )}

        {!loading && items.length > 0 && viewMode === 'rows' && (
          <Card>
            <IndexTable resourceName={{ singular: 'product', plural: 'products' }} itemCount={items.length}
              headings={[{ title: 'Product' }, { title: 'Price' }, { title: 'Margin' }, { title: 'Ship' }, { title: 'Actions' }]}
              selectable={true} selectedItemsCount={selectedIds.size}
              onSelectionChange={t => { if (t === 'page') { selectedIds.size === items.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(items.map((i: any) => i.id))); } else setSelectedIds(new Set()); }}
            >{rowMarkup}</IndexTable>
          </Card>
        )}

        {!loading && items.length > 0 && viewMode === 'cards' && cardMarkup}

        <Modal open={confirmModal.open} onClose={() => setConfirmModal(p => ({ ...p, open: false }))} title={confirmModal.title}
          primaryAction={{ content: 'Confirm', onAction: confirmModal.action, destructive: true }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmModal(p => ({ ...p, open: false })) }]}
        ><Modal.Section><Text as="p">{confirmModal.body}</Text></Modal.Section></Modal>

        {previewModal}

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
