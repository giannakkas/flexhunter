import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  EmptyState, Modal, Divider, Tabs, Spinner, Banner, TextField,
  IndexTable, Thumbnail, Checkbox, InlineGrid,
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
    { id: 'CANDIDATE', content: 'New Candidates' },
    { id: 'APPROVED', content: 'Imported' },
    { id: 'REJECTED', content: 'Skipped' },
  ];
  const statusFilter = tabs[selectedTab].id;

  useEffect(() => {
    get(`/candidates?status=${statusFilter}&sort=score`);
    setSelectedIds(new Set());
  }, [get, statusFilter]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const result = await apiFetch<any>(`/candidates/${id}/approve`, { method: 'POST' });
      setMessage(result.message || 'Imported!');
    } catch (err: any) { setMessage(`Error: ${err.message}`); }
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
    setConfirmModal({ open: true, title: 'Delete Candidate', body: 'Permanently delete this candidate?', action: async () => {
      setConfirmModal(p => ({ ...p, open: false }));
      setActionLoading(id);
      await apiFetch(`/candidates/${id}`, { method: 'DELETE' });
      await get(`/candidates?status=${statusFilter}&sort=score`);
      setActionLoading(null);
    }});
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({ open: true, title: `Delete ${selectedIds.size} candidates`, body: `Permanently delete ${selectedIds.size} selected candidates?`, action: async () => {
      setConfirmModal(p => ({ ...p, open: false }));
      for (const id of selectedIds) { await apiFetch(`/candidates/${id}`, { method: 'DELETE' }); }
      setSelectedIds(new Set());
      await get(`/candidates?status=${statusFilter}&sort=score`);
      setMessage(`Deleted ${selectedIds.size} candidates`);
    }});
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    let count = 0;
    for (const id of selectedIds) {
      try { await apiFetch(`/candidates/${id}/approve`, { method: 'POST' }); count++; } catch {}
    }
    setSelectedIds(new Set());
    await get(`/candidates?status=${statusFilter}&sort=score`);
    setMessage(`Imported ${count} products`);
  };

  const handleResetAll = () => {
    setConfirmModal({ open: true, title: 'Clear All Candidates', body: 'Delete ALL non-imported candidates? Cannot be undone.', action: async () => {
      setConfirmModal(p => ({ ...p, open: false }));
      await apiFetch('/candidates/reset', { method: 'POST' });
      await get(`/candidates?status=${statusFilter}&sort=score`);
      setMessage('All candidates cleared.');
    }});
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i: any) => i.id)));
  };

  const items = (candidates || []).filter((item: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return item.title.toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q);
  });

  // ── Row View ─────────────────────────────────
  const rowMarkup = items.map((item: any, index: number) => {
    const score = item.score;
    const finalScore = score?.finalScore || 0;
    const scoreColor = finalScore >= 70 ? '#008060' : finalScore >= 50 ? '#B98900' : '#D72C0D';
    const margin = item.costPrice && item.suggestedPrice ? ((item.suggestedPrice - item.costPrice) / item.suggestedPrice * 100).toFixed(0) : '-';

    return (
      <IndexTable.Row id={item.id} key={item.id} position={index} selected={selectedIds.has(item.id)}>
        <IndexTable.Cell>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2.5px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>
            {finalScore.toFixed(0)}
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Thumbnail source={item.imageUrls?.[0] || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'} alt={item.title} size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="100">
            <Button variant="plain" onClick={() => setSelectedCandidate(item)}>
              <Text as="span" variant="bodyMd" fontWeight="semibold">{item.title}</Text>
            </Button>
            <Text as="span" variant="bodySm" tone="subdued">{item.category || 'General'}</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell><Text as="span" fontWeight="semibold">${item.suggestedPrice?.toFixed(2) || '-'}</Text></IndexTable.Cell>
        <IndexTable.Cell><Text as="span" tone="subdued">${item.costPrice?.toFixed(2) || '-'}</Text></IndexTable.Cell>
        <IndexTable.Cell><Text as="span" tone="success" fontWeight="semibold">{margin}%</Text></IndexTable.Cell>
        <IndexTable.Cell><Text as="span">{item.shippingDays || '-'}d</Text></IndexTable.Cell>
        <IndexTable.Cell>{score?.fitReasons?.[0] && <Badge tone="success">{score.fitReasons[0]}</Badge>}</IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            {item.status === 'CANDIDATE' && (
              <>
                <Button size="slim" variant="primary" onClick={() => handleApprove(item.id)} loading={actionLoading === item.id}>Import</Button>
                <Button size="slim" onClick={() => handleReject(item.id)} loading={actionLoading === item.id}>Skip</Button>
              </>
            )}
            {item.status === 'REJECTED' && <Button size="slim" variant="primary" onClick={() => handleApprove(item.id)} loading={actionLoading === item.id}>Restore</Button>}
            <Button size="slim" tone="critical" variant="plain" onClick={() => handleDelete(item.id)}>Delete</Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  // ── Card View ────────────────────────────────
  const cardMarkup = (
    <InlineGrid columns={2} gap="400">
      {items.map((item: any) => {
        const score = item.score;
        const finalScore = score?.finalScore || 0;
        const scoreColor = finalScore >= 70 ? '#008060' : finalScore >= 50 ? '#B98900' : '#D72C0D';
        const margin = item.costPrice && item.suggestedPrice ? ((item.suggestedPrice - item.costPrice) / item.suggestedPrice * 100).toFixed(0) : '-';

        return (
          <Card key={item.id}>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="start">
                <InlineStack gap="300" blockAlign="start">
                  <div style={{ position: 'relative' }}>
                    <Checkbox label="" labelHidden checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} />
                  </div>
                  <Thumbnail source={item.imageUrls?.[0] || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'} alt={item.title} size="medium" />
                  <BlockStack gap="100">
                    <Button variant="plain" onClick={() => setSelectedCandidate(item)}>
                      <Text as="span" variant="headingSm">{item.title}</Text>
                    </Button>
                    <InlineStack gap="200">
                      <Badge tone="info">{item.category || 'General'}</Badge>
                    </InlineStack>
                  </BlockStack>
                </InlineStack>
                <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "monospace", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                  {finalScore.toFixed(0)}
                </div>
              </InlineStack>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, background: '#FAFBFC', borderRadius: 8, padding: '10px 12px' }}>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Sell</div><div style={{ fontWeight: 600, fontSize: 14 }}>${item.suggestedPrice?.toFixed(2) || '-'}</div></div>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Cost</div><div style={{ fontWeight: 600, fontSize: 14 }}>${item.costPrice?.toFixed(2) || '-'}</div></div>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Margin</div><div style={{ fontWeight: 600, fontSize: 14, color: '#008060' }}>{margin}%</div></div>
                <div><div style={{ fontSize: 10, color: '#6D7175' }}>Ships</div><div style={{ fontWeight: 600, fontSize: 14 }}>{item.shippingDays || '-'}d</div></div>
              </div>
              {score?.fitReasons?.length > 0 && (
                <InlineStack gap="200" wrap>{score.fitReasons.slice(0, 3).map((r: string, i: number) => <Badge key={i} tone="success">{r}</Badge>)}</InlineStack>
              )}
              <Divider />
              <InlineStack gap="200" align="end">
                <Button size="slim" tone="critical" variant="plain" onClick={() => handleDelete(item.id)}>Delete</Button>
                {item.status === 'CANDIDATE' && (
                  <>
                    <Button size="slim" onClick={() => handleReject(item.id)}>Skip</Button>
                    <Button size="slim" variant="primary" onClick={() => handleApprove(item.id)} loading={actionLoading === item.id}>Import</Button>
                  </>
                )}
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
      primaryAction={{ content: 'Run New Research', onAction: async () => {
        setMessage('Running research...'); await apiFetch('/research/start', { method: 'POST' });
        await get('/candidates?status=CANDIDATE&sort=score'); setSelectedTab(0); setMessage('Research complete!');
      }}}
      secondaryActions={[{ content: 'Clear All', onAction: handleResetAll, destructive: true }]}
    >
      <BlockStack gap="400">
        {message && <Banner tone="success" onDismiss={() => setMessage(null)}><Text as="p">{message}</Text></Banner>}

        {/* Controls Bar */}
        <InlineStack align="space-between">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={(i) => { setSelectedTab(i); setSearchQuery(''); setSelectedIds(new Set()); }} fitted />
          <InlineStack gap="200">
            {selectedIds.size > 0 && (
              <>
                <Badge>{selectedIds.size} selected</Badge>
                {statusFilter === 'CANDIDATE' && <Button size="slim" variant="primary" onClick={handleBulkApprove}>Import Selected</Button>}
                <Button size="slim" tone="critical" onClick={handleBulkDelete}>Delete Selected</Button>
              </>
            )}
            <Button size="slim" pressed={viewMode === 'rows'} onClick={() => setViewMode('rows')}>Rows</Button>
            <Button size="slim" pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}>Cards</Button>
          </InlineStack>
        </InlineStack>

        <TextField label="" labelHidden value={searchQuery} onChange={setSearchQuery}
          placeholder="Search by title or category..." autoComplete="off" clearButton onClearButtonClick={() => setSearchQuery('')} />

        {loading && <Card><div style={{ textAlign: 'center', padding: 20 }}><Spinner /></div></Card>}

        {!loading && items.length === 0 && (
          <Card>
            <EmptyState heading={statusFilter === 'CANDIDATE' ? 'No candidates' : `No ${tabs[selectedTab].content.toLowerCase()}`}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={statusFilter === 'CANDIDATE' ? { content: 'Run Research', onAction: async () => {
                await apiFetch('/research/start', { method: 'POST' }); await get('/candidates?status=CANDIDATE&sort=score');
              }} : undefined}
            ><Text as="p">{statusFilter === 'CANDIDATE' ? 'Run research to find products.' : 'Products appear here as you review.'}</Text></EmptyState>
          </Card>
        )}

        {/* Row View */}
        {!loading && items.length > 0 && viewMode === 'rows' && (
          <Card>
            <IndexTable resourceName={{ singular: 'product', plural: 'products' }} itemCount={items.length}
              headings={[{ title: 'Score' }, { title: '' }, { title: 'Product' }, { title: 'Price' }, { title: 'Cost' }, { title: 'Margin' }, { title: 'Ships' }, { title: 'Fit' }, { title: 'Actions' }]}
              selectable={true} selectedItemsCount={selectedIds.size} onSelectionChange={(selType) => {
                if (selType === 'page') toggleAll(); else setSelectedIds(new Set());
              }}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        )}

        {/* Card View */}
        {!loading && items.length > 0 && viewMode === 'cards' && cardMarkup}

        {/* Confirm Modal */}
        <Modal open={confirmModal.open} onClose={() => setConfirmModal(p => ({ ...p, open: false }))} title={confirmModal.title}
          primaryAction={{ content: 'Confirm', onAction: confirmModal.action, destructive: true }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmModal(p => ({ ...p, open: false })) }]}
        ><Modal.Section><Text as="p">{confirmModal.body}</Text></Modal.Section></Modal>

        {/* Detail Modal */}
        {selectedCandidate && (
          <Modal open onClose={() => setSelectedCandidate(null)} title={selectedCandidate.title} size="large"
            primaryAction={selectedCandidate.status !== 'APPROVED' ? { content: 'Import', onAction: () => handleApprove(selectedCandidate.id), loading: actionLoading === selectedCandidate.id } : undefined}
            secondaryActions={[{ content: 'Close', onAction: () => setSelectedCandidate(null) }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <Text as="p">{selectedCandidate.description}</Text>
                <InlineStack gap="300">
                  {selectedCandidate.reviewCount && <Badge>Rating {selectedCandidate.reviewRating} ({selectedCandidate.reviewCount.toLocaleString()})</Badge>}
                  {selectedCandidate.orderVolume && <Badge>{selectedCandidate.orderVolume.toLocaleString()} orders</Badge>}
                  <Badge>Source: {selectedCandidate.sourceName || selectedCandidate.providerType}</Badge>
                </InlineStack>
                {selectedCandidate.score && (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingMd">Score Breakdown</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                    </div>
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

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
