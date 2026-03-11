import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  EmptyState, Modal, Divider, Spinner, Banner, IndexTable,
  InlineGrid,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi, apiFetch } from '../hooks/useApi';

const PLACEHOLDER = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
const GLOW = `@keyframes importGlow { 0%,100% { box-shadow: 0 0 6px rgba(0,128,96,0.4); } 50% { box-shadow: 0 0 16px rgba(0,128,96,0.7); } }`;

function Img({ src, size = 48 }: { src?: string; size?: number }) {
  const [err, setErr] = useState(false);
  return <img src={!src || err ? PLACEHOLDER : src} alt="" onError={() => setErr(true)}
    style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8, background: '#f0f0f0', flexShrink: 0 }} />;
}

function ScoreCircle({ value, size = 36 }: { value: number; size?: number }) {
  const c = value >= 80 ? '#008060' : value >= 65 ? '#47B881' : value >= 50 ? '#B98900' : value >= 35 ? '#DE6E1E' : '#D72C0D';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', border: `3px solid ${c}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', fontWeight: 700, fontSize: size * 0.35, color: c, flexShrink: 0,
    }}>{Math.round(value)}</div>
  );
}

export function SelectionsPage() {
  const navigate = useNavigate();
  const { data: candidates, get, loading } = useApi<any[]>();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; title: string; body: string; fn: () => void }>({ open: false, title: '', body: '', fn: () => {} });

  useEffect(() => { get('/candidates?status=APPROVED&sort=score'); }, [get]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t); } }, [msg]);

  const items = candidates || [];

  const importToShopify = async (id: string) => {
    setBusy(id);
    try {
      const r = await apiFetch<any>(`/candidates/${id}/approve`, { method: 'POST' });
      setMsg(r.shopifyError ? `Warning: ${r.shopifyError}` : (r.message || 'Imported to Shopify!'));
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setBusy(null);
    get('/candidates?status=APPROVED&sort=score');
  };

  const importAll = async () => {
    for (const item of items) {
      if (!item.importedProduct) {
        await apiFetch(`/candidates/${item.id}/approve`, { method: 'POST' }).catch(() => {});
      }
    }
    setMsg(`Imported ${items.length} products to Shopify!`);
    get('/candidates?status=APPROVED&sort=score');
  };

  const unselect = async (id: string) => {
    await apiFetch(`/candidates/${id}/unselect`, { method: 'POST' }).catch(() => {});
    get('/candidates?status=APPROVED&sort=score');
  };

  const profit = (i: any) => i.costPrice && i.suggestedPrice ? i.suggestedPrice - i.costPrice : null;
  const margin = (i: any) => i.costPrice && i.suggestedPrice ? (i.suggestedPrice - i.costPrice) / i.suggestedPrice * 100 : null;

  return (
    <Page title="Candidates" subtitle={`${items.length} products selected for your store`}
      primaryAction={items.length > 0 ? {
        content: `🚀 Import All ${items.length} to Shopify`,
        onAction: () => setConfirmDlg({
          open: true, title: 'Import All to Shopify',
          body: `This will create ${items.length} real products in your Shopify store. Continue?`,
          fn: async () => { setConfirmDlg(p => ({ ...p, open: false })); await importAll(); },
        }),
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
                  {/* Image */}
                  <div style={{ position: 'relative', height: 160, background: '#f5f5f5', overflow: 'hidden' }}>
                    <img src={imgs[0] || PLACEHOLDER} alt="" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: 8, left: 8 }}><ScoreCircle value={fs} size={34} /></div>
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      {alreadyImported ? <Badge tone="success">✓ In Shopify</Badge> : <Badge tone="attention">Selected</Badge>}
                    </div>
                  </div>

                  {/* Content */}
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
                          <Badge tone="success">Imported ✓</Badge>
                        ) : (
                          <button onClick={() => importToShopify(item.id)} disabled={busy === item.id} style={{
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

        <Modal open={confirmDlg.open} onClose={() => setConfirmDlg(p => ({ ...p, open: false }))} title={confirmDlg.title}
          primaryAction={{ content: 'Import All', onAction: confirmDlg.fn }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmDlg(p => ({ ...p, open: false })) }]}
        ><Modal.Section><Text as="p">{confirmDlg.body}</Text></Modal.Section></Modal>

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
