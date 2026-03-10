import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  EmptyState, Modal, Divider, Tabs, Spinner, Banner, TextField,
  IndexTable, Thumbnail, InlineGrid, Checkbox,
} from '@shopify/polaris';
import { useApi, apiFetch } from '../hooks/useApi';

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

export function CandidatesPage() {
  const { data: candidates, get, loading } = useApi<any[]>();
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
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
    setActionLoading(null); setSelectedCandidate(null);
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

  const toggleSelect = (id: string) => setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const items = (candidates || []).filter((i: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return i.title.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q);
  });

  // ── Row Markup (compact) ─────────────────────
  const rowMarkup = items.map((item: any, idx: number) => {
    const s = item.score; const fs = s?.finalScore || 0;
    const sc = fs >= 70 ? '#008060' : fs >= 50 ? '#B98900' : '#D72C0D';
    const m = item.costPrice && item.suggestedPrice ? ((item.suggestedPrice - item.costPrice) / item.suggestedPrice * 100).toFixed(0) + '%' : '-';

    return (
      <IndexTable.Row id={item.id} key={item.id} position={idx} selected={selectedIds.has(item.id)}>
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center">
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${sc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{fs.toFixed(0)}</div>
            <Thumbnail source={item.imageUrls?.[0] || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'} alt="" size="small" />
            <BlockStack gap="0">
              <Button variant="plain" onClick={() => setSelectedCandidate(item)}>
                <Text as="span" variant="bodySm" fontWeight="semibold">{item.title.length > 40 ? item.title.slice(0, 40) + '...' : item.title}</Text>
              </Button>
              <Text as="span" variant="bodySm" tone="subdued">{item.category}</Text>
            </BlockStack>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="0">
            <Text as="span" variant="bodySm" fontWeight="semibold">${item.suggestedPrice?.toFixed(2)}</Text>
            <Text as="span" variant="bodySm" tone="subdued">Cost ${item.costPrice?.toFixed(2)}</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell><Text as="span" tone="success" fontWeight="semibold">{m}</Text></IndexTable.Cell>
        <IndexTable.Cell><Text as="span" variant="bodySm">{item.shippingDays}d</Text></IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
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
        const sc = fs >= 70 ? '#008060' : fs >= 50 ? '#B98900' : '#D72C0D';
        const m = item.costPrice && item.suggestedPrice ? ((item.suggestedPrice - item.costPrice) / item.suggestedPrice * 100).toFixed(0) : '-';
        return (
          <Card key={item.id}>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="start">
                <InlineStack gap="300" blockAlign="start">
                  <Thumbnail source={item.imageUrls?.[0] || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'} alt="" size="medium" />
                  <BlockStack gap="100">
                    <Button variant="plain" onClick={() => setSelectedCandidate(item)}>
                      <Text as="span" variant="headingSm">{item.title}</Text>
                    </Button>
                    <Badge tone="info">{item.category || 'General'}</Badge>
                  </BlockStack>
                </InlineStack>
                <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${sc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{fs.toFixed(0)}</div>
              </InlineStack>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, background: '#FAFBFC', borderRadius: 8, padding: '10px 12px' }}>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Sell</div><div style={{ fontWeight: 600, fontSize: 14 }}>${item.suggestedPrice?.toFixed(2)}</div></div>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Cost</div><div style={{ fontWeight: 600, fontSize: 14 }}>${item.costPrice?.toFixed(2)}</div></div>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Margin</div><div style={{ fontWeight: 600, fontSize: 14, color: '#008060' }}>{m}%</div></div>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Ships</div><div style={{ fontWeight: 600, fontSize: 14 }}>{item.shippingDays}d</div></div>
              </div>
              {s?.fitReasons?.length > 0 && <InlineStack gap="200" wrap>{s.fitReasons.slice(0, 2).map((r: string, i: number) => <Badge key={i} tone="success">{r}</Badge>)}</InlineStack>}
              <Divider />
              <InlineStack gap="200" align="end">
                <Button size="slim" tone="critical" variant="plain" onClick={() => handleDelete(item.id)}>Delete</Button>
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

  return (
    <Page title="Product Candidates" subtitle={`${items.length} products`}
      primaryAction={{ content: 'Run Research', onAction: async () => {
        setMessage('Running...'); await apiFetch('/research/start', { method: 'POST' });
        await get('/candidates?status=CANDIDATE&sort=score'); setSelectedTab(0); setMessage('Done!');
      }}}
      secondaryActions={[{ content: 'Clear All', onAction: handleResetAll, destructive: true }]}
    >
      <BlockStack gap="400">
        {message && <Banner tone="success" onDismiss={() => setMessage(null)}><Text as="p">{message}</Text></Banner>}

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

        <TextField label="" labelHidden value={searchQuery} onChange={setSearchQuery} placeholder="Search..." autoComplete="off" clearButton onClearButtonClick={() => setSearchQuery('')} />

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
              headings={[{ title: 'Product' }, { title: 'Price' }, { title: 'Margin' }, { title: 'Ship' }, { title: '' }]}
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

        {selectedCandidate && (
          <Modal open onClose={() => setSelectedCandidate(null)} title={selectedCandidate.title} size="large"
            primaryAction={selectedCandidate.status !== 'APPROVED' ? { content: 'Import', onAction: () => handleApprove(selectedCandidate.id), loading: actionLoading === selectedCandidate.id } : undefined}
            secondaryActions={[{ content: 'Close', onAction: () => setSelectedCandidate(null) }]}
          ><Modal.Section><BlockStack gap="400">
            <Text as="p">{selectedCandidate.description}</Text>
            <InlineStack gap="300">
              {selectedCandidate.reviewCount && <Badge>{selectedCandidate.reviewRating} ({selectedCandidate.reviewCount.toLocaleString()} reviews)</Badge>}
              {selectedCandidate.orderVolume && <Badge>{selectedCandidate.orderVolume.toLocaleString()} orders</Badge>}
              <Badge>{selectedCandidate.sourceName || selectedCandidate.providerType}</Badge>
            </InlineStack>
            {selectedCandidate.score && <><Divider /><Text as="h3" variant="headingMd">Score Breakdown</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <ScoreBar label="Domain Fit" value={selectedCandidate.score.domainFit} color="#5C6AC4" />
                <ScoreBar label="Store Fit" value={selectedCandidate.score.storeFit} color="#5C6AC4" />
                <ScoreBar label="Audience" value={selectedCandidate.score.audienceFit} color="#007ACE" />
                <ScoreBar label="Trend" value={selectedCandidate.score.trendFit} color="#007ACE" />
                <ScoreBar label="Virality" value={selectedCandidate.score.visualVirality} color="#9C6ADE" />
                <ScoreBar label="Novelty" value={selectedCandidate.score.novelty} color="#9C6ADE" />
                <ScoreBar label="Price" value={selectedCandidate.score.priceFit} color="#008060" />
                <ScoreBar label="Margin" value={selectedCandidate.score.marginFit} color="#008060" />
                <ScoreBar label="Shipping" value={selectedCandidate.score.shippingFit} color="#B98900" />
                <ScoreBar label="Saturation" value={selectedCandidate.score.saturationInverse} color="#B98900" />
              </div>
              {selectedCandidate.score.explanation && <div style={{ padding: '12px 16px', borderRadius: 8, background: '#F0F5FF', border: '1px solid #B4D5FE' }}>
                <Text as="p" variant="bodySm">{selectedCandidate.score.explanation}</Text></div>}
            </>}
          </BlockStack></Modal.Section></Modal>
        )}

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
