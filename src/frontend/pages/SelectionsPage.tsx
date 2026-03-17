import { friendlyError } from '../utils/errors';
import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  EmptyState, Modal, Divider, Spinner, Banner, InlineGrid,
  TextField,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi, apiFetch } from '../hooks/useApi';

const PLACEHOLDER = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
const GLOW = `@keyframes importGlow { 0%,100% { box-shadow: 0 0 6px rgba(0,128,96,0.4); } 50% { box-shadow: 0 0 16px rgba(0,128,96,0.7); } }`;

function ScoreCircle({ value, size = 34 }: { value: number; size?: number }) {
  const c = value >= 80 ? '#008060' : value >= 65 ? '#47B881' : value >= 50 ? '#B98900' : value >= 35 ? '#DE6E1E' : '#D72C0D';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', border: `3px solid ${c}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', fontWeight: 700, fontSize: size * 0.35, color: c, flexShrink: 0, background: 'rgba(255,255,255,0.9)',
    }}>{Math.round(value)}</div>
  );
}

export function SelectionsPage() {
  const navigate = useNavigate();
  const { data: candidates, get, loading, setData } = useApi<any[]>();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Pre-import edit modal state
  const [editItem, setEditItem] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Post-import SEO modal
  const [seoModal, setSeoModal] = useState<{ open: boolean; importedId: string; title: string }>({ open: false, importedId: '', title: '' });

  // Confirm dialog
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; title: string; body: string; fn: () => void }>({ open: false, title: '', body: '', fn: () => {} });

  useEffect(() => { get('/candidates?status=APPROVED&sort=score'); }, [get]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 5000); return () => clearTimeout(t); } }, [msg]);

  const items = (candidates || []).filter((i: any) => !i.importedProduct);

  // Open pre-import editor
  const openEditModal = (item: any) => {
    setEditItem(item);
    setEditTitle(item.title);
    setEditPrice(item.suggestedPrice?.toFixed(2) || '');
    setEditDesc(item.description?.slice(0, 500) || '');
  };

  // Confirm import with edits
  const confirmImport = async () => {
    if (!editItem) return;
    const importingId = editItem.id;
    setBusy(importingId);
    setEditItem(null);
    try {
      const r = await apiFetch<any>(`/candidates/${importingId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          customTitle: editTitle || undefined,
          customPrice: editPrice ? parseFloat(editPrice) : undefined,
          customDescription: editDesc || undefined,
        }),
      });
      if (r.shopifyError) {
        setMsg(`Warning: ${r.shopifyError}`);
      } else if (r.importedProductId) {
        setSeoModal({ open: true, importedId: r.importedProductId, title: editTitle || '' });
      } else {
        setMsg(r.message || 'Imported!');
      }
    } catch (e: any) {
      setMsg(friendlyError(e.message));
    }
    setBusy(null);
    // Remove imported item from UI immediately
    setData((candidates || []).filter((i: any) => i.id !== importingId));
  };

  const importAll = async () => {
    let lastImportedId = '';
    let count = 0;
    for (const item of items) {
      try {
        const r = await apiFetch<any>(`/candidates/${item.id}/approve`, { method: 'POST' });
        if (r.importedProductId) lastImportedId = r.importedProductId;
        count++;
      } catch {}
    }
    setMsg(`Imported ${count} products!`);
    setData([]); // Clear all from UI
    if (lastImportedId) {
      setTimeout(() => setSeoModal({ open: true, importedId: lastImportedId, title: `${count} products` }), 500);
    }
  };

  const unselect = async (id: string) => {
    // Remove from UI immediately
    setData((items || []).filter((i: any) => i.id !== id));
    try {
      await apiFetch(`/candidates/${id}/unselect`, { method: 'POST' });
    } catch {
      // Reload if API failed
      get('/candidates?status=APPROVED&sort=score');
    }
  };

  const profit = (i: any) => i.costPrice && i.suggestedPrice ? i.suggestedPrice - i.costPrice : null;
  const margin = (i: any) => i.costPrice && i.suggestedPrice ? (i.suggestedPrice - i.costPrice) / i.suggestedPrice * 100 : null;

  return (
    <Page title="Candidates" subtitle={`${items.length} products selected for your store`}
      primaryAction={items.length > 0 ? {
        content: `🚀 Import All ${items.filter(i => !i.importedProduct).length} to Shopify`,
        onAction: () => setConfirmDlg({
          open: true, title: 'Import All to Shopify',
          body: `This will create ${items.filter(i => !i.importedProduct).length} products in your Shopify store. Continue?`,
          fn: async () => { setConfirmDlg(p => ({ ...p, open: false })); await importAll(); },
        }),
        disabled: items.every(i => i.importedProduct),
      } : undefined}
    >
      <style>{GLOW}</style>
      <BlockStack gap="400">
        {msg && <Banner tone={msg.includes('Error') || msg.includes('Warning') ? 'warning' : 'success'} onDismiss={() => setMsg(null)}><Text as="p">{msg}</Text></Banner>}

        {loading && <Card><div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div></Card>}

        {!loading && items.length === 0 && (
          <Card>
            <EmptyState heading="No candidates selected" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{ content: 'Go to Research', onAction: () => navigate('/candidates') }}>
              <Text as="p">Select products from Research to add them here.</Text>
            </EmptyState>
          </Card>
        )}

        {!loading && items.length > 0 && (
          <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
            {items.map((item: any) => {
              const s = item.score; const fs = s?.finalScore || 0;
              const m = margin(item); const p = profit(item);
              const imgs = (item.imageUrls || []).filter((u: string) => u);
              const alreadyImported = !!item.importedProduct;

              return (
                <div key={item.id} style={{
                  borderRadius: 14, border: alreadyImported ? '2px solid #008060' : '1px solid #E4E5E7',
                  background: 'white', overflow: 'hidden', transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                >
                  <div style={{ position: 'relative', height: 160, background: '#f5f5f5', overflow: 'hidden' }}>
                    <img src={imgs[0] || PLACEHOLDER} alt="" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: 8, left: 8 }}><ScoreCircle value={fs} size={34} /></div>
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      {alreadyImported ? <Badge tone="success">✓ In Shopify</Badge> : <Badge tone="attention">Selected</Badge>}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px' }}>
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="bold">
                        {item.title.length > 50 ? item.title.slice(0, 50) + '...' : item.title}
                      </Text>

                      <InlineStack gap="100">
                        <Badge>{item.category || 'General'}</Badge>
                        <Badge tone="info">{item.sourceName}</Badge>
                      </InlineStack>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, background: '#FAFBFC', borderRadius: 8, padding: '8px 6px' }}>
                        {[
                          { l: 'Price', v: `$${item.suggestedPrice?.toFixed(2)}` },
                          { l: 'Cost', v: `$${item.costPrice?.toFixed(2)}` },
                          { l: 'Profit', v: `$${p?.toFixed(2) || '-'}`, g: true },
                          { l: 'Margin', v: `${m?.toFixed(0) || '-'}%`, g: true },
                        ].map(c => (
                          <div key={c.l} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 9, color: '#6D7175', textTransform: 'uppercase', fontWeight: 600 }}>{c.l}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: c.g ? '#008060' : '#202223' }}>{c.v}</div>
                          </div>
                        ))}
                      </div>

                      <Divider />

                      <InlineStack gap="200" align="space-between">
                        <Button size="slim" onClick={() => unselect(item.id)}>Remove</Button>
                        {alreadyImported ? (
                          <InlineStack gap="200">
                            <Badge tone="success">In Shopify ✓</Badge>
                            <button onClick={() => {
                              const impId = item.importedProduct?.id;
                              if (impId) navigate(`/seo?product=${impId}`);
                              else navigate('/seo');
                            }} style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              height: 28, padding: '0 12px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                              border: '1px solid #5C6AC4', background: '#5C6AC4', color: 'white', cursor: 'pointer',
                            }}>SEO Optimize</button>
                          </InlineStack>
                        ) : (
                          <button onClick={() => openEditModal(item)} disabled={busy === item.id} style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            height: 30, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                            border: '1px solid #008060', background: '#008060', color: 'white',
                            cursor: 'pointer', animation: 'importGlow 2s ease-in-out infinite',
                            opacity: busy === item.id ? 0.6 : 1,
                          }}>{busy === item.id ? 'Importing...' : '🚀 Import to Shopify'}</button>
                        )}
                      </InlineStack>
                    </BlockStack>
                  </div>
                </div>
              );
            })}
          </InlineGrid>
        )}

        {/* ── Pre-Import Edit Modal ── */}
        <Modal open={!!editItem} onClose={() => setEditItem(null)}
          title="Review & Edit Before Import"
          primaryAction={{ content: '🚀 Confirm Import', onAction: confirmImport }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setEditItem(null) }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Banner tone="info">
                <Text as="p" variant="bodySm">Customize your product before it goes live in Shopify. You can always edit later.</Text>
              </Banner>

              {editItem && (
                <div style={{ display: 'flex', gap: 16, padding: 12, background: '#F9FAFB', borderRadius: 10 }}>
                  <img src={editItem.imageUrls?.[0] || PLACEHOLDER} alt=""
                    style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
                  <div>
                    <Text as="p" variant="bodySm" tone="subdued">Original from {editItem.sourceName}</Text>
                    <Text as="p" variant="bodySm">Cost: ${editItem.costPrice?.toFixed(2)} · Score: {editItem.score?.finalScore || 0}/100</Text>
                    <InlineStack gap="100">
                      <Badge>{editItem.category || 'General'}</Badge>
                      {editItem.orderVolume > 0 && <Badge tone="success">{editItem.orderVolume.toLocaleString()} sold</Badge>}
                    </InlineStack>
                  </div>
                </div>
              )}

              <TextField label="Product Title" value={editTitle} onChange={setEditTitle} autoComplete="off"
                helpText="This is what customers see. Make it clear and compelling." />

              <TextField label="Selling Price ($)" value={editPrice} onChange={setEditPrice} autoComplete="off" type="number"
                helpText={editItem ? `Cost: $${editItem.costPrice?.toFixed(2)} · Margin: ${editPrice ? ((1 - editItem.costPrice / parseFloat(editPrice)) * 100).toFixed(0) : '-'}%` : ''} />

              <TextField label="Description" value={editDesc} onChange={setEditDesc} autoComplete="off" multiline={4}
                helpText="You can optimize this with SEO after import." />
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* ── Post-Import SEO Modal ── */}
        <Modal open={seoModal.open} onClose={() => setSeoModal({ open: false, importedId: '', title: '' })}
          title="✅ Product Imported Successfully!"
          primaryAction={{ content: '🚀 Optimize SEO Now', onAction: () => { navigate(`/seo?product=${seoModal.importedId}`); setSeoModal({ open: false, importedId: '', title: '' }); } }}
          secondaryActions={[{ content: 'Later', onAction: () => setSeoModal({ open: false, importedId: '', title: '' }) }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                <strong>"{seoModal.title}"</strong> is now live in Shopify! There's one more step that makes a big difference...
              </Text>
              <div style={{ padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #F0F5FF, #E8F4FF)', border: '1px solid #B4D5FE' }}>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Why SEO Optimization Matters</Text>
                  <Text as="p" variant="bodySm">Products with optimized titles and descriptions get <strong>2-5x more organic traffic</strong> from Google Shopping and search. Our AI will:</Text>
                  {['✓ Rewrite your title with high-ranking keywords', '✓ Create a conversion-focused description', '✓ Generate meta title & description for Google', '✓ Suggest URL handle & tags', '✓ Apply changes directly to Shopify'].map((t, i) => (
                    <Text key={i} as="p" variant="bodySm" fontWeight="semibold">{t}</Text>
                  ))}
                </BlockStack>
              </div>
              <Text as="p" variant="bodySm" tone="subdued">Takes about 10 seconds.</Text>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Confirm dialog */}
        <Modal open={confirmDlg.open} onClose={() => setConfirmDlg(p => ({ ...p, open: false }))} title={confirmDlg.title}
          primaryAction={{ content: 'Import All', onAction: confirmDlg.fn }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmDlg(p => ({ ...p, open: false })) }]}
        ><Modal.Section><Text as="p">{confirmDlg.body}</Text></Modal.Section></Modal>

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
