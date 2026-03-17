import { friendlyError } from '../utils/errors';
import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  EmptyState, Banner, Modal, InlineGrid, Spinner,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi, apiFetch } from '../hooks/useApi';

const STATUS_MAP: Record<string, { tone: any; label: string; icon: string }> = {
  TESTING: { tone: 'attention', label: 'Testing', icon: '🧪' },
  WINNER: { tone: 'success', label: 'Winner', icon: '🏆' },
  WEAK: { tone: 'critical', label: 'Weak', icon: '⚠️' },
  PINNED: { tone: 'info', label: 'Pinned', icon: '📌' },
  REPLACEMENT_SUGGESTED: { tone: 'warning', label: 'Replace?', icon: '🔄' },
  AUTO_REPLACED: { tone: 'subdued', label: 'Replaced', icon: '♻️' },
  ARCHIVED: { tone: 'subdued', label: 'Archived', icon: '📦' },
};

export function ImportsPage() {
  const navigate = useNavigate();
  const { data: imports, get, loading } = useApi<any[]>();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<'success' | 'critical'>('success');

  useEffect(() => { get('/imports'); }, [get]);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 5000); return () => clearTimeout(t); } }, [message]);

  const handlePin = async (id: string) => { await apiFetch(`/imports/${id}/pin`, { method: 'POST', body: JSON.stringify({ reason: 'Pinned' }) }).catch(() => {}); get('/imports'); };
  const handleUnpin = async (id: string) => { await apiFetch(`/imports/${id}/unpin`, { method: 'POST' }).catch(() => {}); get('/imports'); };

  const handleDeleteOne = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch<any>(`/imports/${deleteTarget}`, { method: 'DELETE' });
      setMessage('Product deleted.'); setMsgTone('success');
    } catch (e: any) { setMessage(friendlyError(e.message)); setMsgTone('critical'); }
    setDeleting(false); setDeleteTarget(null); get('/imports');
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await apiFetch<any>('/imports', { method: 'DELETE' });
      setMessage('All products deleted.'); setMsgTone('success');
    } catch (e: any) { setMessage(friendlyError(e.message)); setMsgTone('critical'); }
    setDeleting(false); setDeleteAllOpen(false); get('/imports');
  };

  const items = imports || [];

  return (
    <Page title="Imported Products" subtitle={`${items.length} products`}
      secondaryActions={items.length > 0 ? [{ content: 'Delete All Imported', onAction: () => setDeleteAllOpen(true), destructive: true }] : []}
    >
      <BlockStack gap="400">
        {message && <Banner tone={msgTone} onDismiss={() => setMessage(null)}><Text as="p">{message}</Text></Banner>}

        {loading && <Card><div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div></Card>}

        {items.length === 0 && !loading ? (
          <Card>
            <EmptyState heading="No products imported yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{ content: 'Go to Research', onAction: () => navigate('/candidates') }}>
              <Text as="p">Run AI research to discover and import winning products.</Text>
            </EmptyState>
          </Card>
        ) : (
          <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
            {items.map((item: any) => {
              const st = STATUS_MAP[item.status] || { tone: 'info', label: item.status, icon: '📦' };
              const imgUrl = item.candidate?.imageUrls?.[0] || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
              const perf = item.performance;
              const cost = item.candidate?.costPrice || 0;
              const price = item.importedPrice || 0;
              const profit = price - cost;
              const margin = price > 0 ? ((price - cost) / price * 100) : 0;

              return (
                <div key={item.id} style={{
                  background: 'white', borderRadius: 12, overflow: 'hidden',
                  border: item.status === 'WINNER' ? '2px solid #10B981' : item.status === 'WEAK' ? '2px solid #EF4444' : '1px solid #E5E7EB',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}>
                  {/* Image */}
                  <div style={{ position: 'relative', height: 180, background: '#F9FAFB', overflow: 'hidden' }}>
                    <img src={imgUrl} alt={item.importedTitle}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(e: any) => { e.target.src = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'; }}
                    />
                    {/* Status badge */}
                    <div style={{ position: 'absolute', top: 8, left: 8 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: item.status === 'WINNER' ? '#D1FAE5' : item.status === 'WEAK' ? '#FEE2E2' : item.status === 'PINNED' ? '#DBEAFE' : '#F3F4F6',
                        color: item.status === 'WINNER' ? '#065F46' : item.status === 'WEAK' ? '#991B1B' : item.status === 'PINNED' ? '#1E40AF' : '#374151',
                      }}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                    {/* Price */}
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800,
                        background: 'rgba(0,0,0,0.75)', color: 'white',
                      }}>${price.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ padding: 14 }}>
                    <BlockStack gap="200">
                      <Text as="h3" variant="bodyMd" fontWeight="bold">
                        {(item.importedTitle || '').slice(0, 60)}{item.importedTitle?.length > 60 ? '...' : ''}
                      </Text>

                      {/* Metrics row */}
                      {cost > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280' }}>
                          <span>Cost: <b style={{ color: '#374151' }}>${cost.toFixed(2)}</b></span>
                          <span>Profit: <b style={{ color: profit > 10 ? '#059669' : '#D97706' }}>${profit.toFixed(2)}</b></span>
                          <span>Margin: <b style={{ color: margin > 50 ? '#059669' : '#D97706' }}>{margin.toFixed(0)}%</b></span>
                        </div>
                      )}

                      {/* Health bar */}
                      {perf && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                            <span style={{ color: '#6B7280' }}>Health Score</span>
                            <span style={{ fontWeight: 700, color: perf.healthScore >= 60 ? '#059669' : perf.healthScore >= 30 ? '#D97706' : '#DC2626' }}>{perf.healthScore}/100</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 3, width: `${perf.healthScore}%`,
                              background: perf.healthScore >= 60 ? '#10B981' : perf.healthScore >= 30 ? '#F59E0B' : '#EF4444',
                            }} />
                          </div>
                        </div>
                      )}

                      {/* Shopify status */}
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {item.shopifyStatus === 'MOCK' ? '⚠️ Not in Shopify — mock import' : item.shopifyHandle ? `/${item.shopifyHandle}` : 'In Shopify'}
                      </div>

                      {/* Actions */}
                      <InlineStack gap="200">
                        <Button size="slim" variant="primary" onClick={() => navigate(`/seo?product=${item.id}`)}>SEO</Button>
                        {item.isPinned
                          ? <Button size="slim" onClick={() => handleUnpin(item.id)}>Unpin</Button>
                          : <Button size="slim" onClick={() => handlePin(item.id)}>Pin</Button>
                        }
                        <Button size="slim" tone="critical" onClick={() => setDeleteTarget(item.id)}>Delete</Button>
                      </InlineStack>
                    </BlockStack>
                  </div>
                </div>
              );
            })}
          </InlineGrid>
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
              <Text as="p">This will permanently delete ALL {items.length} imported products.</Text>
              <Text as="p" fontWeight="bold" tone="critical">This cannot be undone.</Text>
            </BlockStack>
          </Modal.Section>
        </Modal>

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
