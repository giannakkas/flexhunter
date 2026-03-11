import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  EmptyState, Modal, Divider, Tabs, Spinner, Banner, TextField,
  IndexTable, InlineGrid,
} from '@shopify/polaris';
import { useApi, apiFetch } from '../hooks/useApi';

const PLACEHOLDER = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';

function AutoDismiss({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [vis, setVis] = useState(true);
  useEffect(() => { const t = setTimeout(() => { setVis(false); setTimeout(onDismiss, 400); }, 3500); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div style={{ opacity: vis ? 1 : 0, transition: 'opacity 0.4s', maxHeight: vis ? 200 : 0, overflow: 'hidden' }}>
      <Banner tone={message.includes('Error') || message.includes('fail') ? 'critical' : 'success'} onDismiss={onDismiss}><Text as="p">{message}</Text></Banner>
    </div>
  );
}

function Img({ src, size = 48 }: { src?: string; size?: number }) {
  const [err, setErr] = useState(false);
  return <img src={!src || err ? PLACEHOLDER : src} alt="" onError={() => setErr(true)}
    style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8, background: '#f0f0f0', flexShrink: 0 }} />;
}

function ScoreCircle({ value, size = 40 }: { value: number; size?: number }) {
  const c = value >= 80 ? '#008060' : value >= 65 ? '#47B881' : value >= 50 ? '#B98900' : value >= 35 ? '#DE6E1E' : '#D72C0D';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', border: `3px solid ${c}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', fontWeight: 700, fontSize: size * 0.35, color: c, flexShrink: 0,
    }}>{Math.round(value)}</div>
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
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${Math.min(100, value)}%`, transition: 'width 0.5s ease' }} />
      </div>
    </BlockStack>
  );
}

export function CandidatesPage() {
  const { data: candidates, get, loading } = useApi<any[]>();
  const [tab, setTab] = useState(0);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'rows'>('grid');
  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ open: boolean; title: string; body: string; fn: () => void }>({ open: false, title: '', body: '', fn: () => {} });

  const tabs = [{ id: 'CANDIDATE', content: 'New' }, { id: 'APPROVED', content: 'Imported' }, { id: 'REJECTED', content: 'Skipped' }];
  const status = tabs[tab].id;

  useEffect(() => { get(`/candidates?status=${status}&sort=score`); setSelIds(new Set()); }, [get, status]);

  const approve = async (id: string) => {
    setBusy(id);
    try { const r = await apiFetch<any>(`/candidates/${id}/approve`, { method: 'POST' }); setMsg(r.message || 'Imported!'); }
    catch (e: any) { setMsg(`Error: ${e.message}`); }
    await get(`/candidates?status=${status}&sort=score`);
    setBusy(null); setPreview(null);
  };
  const reject = async (id: string) => { setBusy(id); await apiFetch(`/candidates/${id}/reject`, { method: 'POST' }).catch(() => {}); setBusy(null); await get(`/candidates?status=${status}&sort=score`); };
  const del = (id: string) => setConfirm({ open: true, title: 'Delete', body: 'Permanently delete this product?', fn: async () => { setConfirm(p => ({ ...p, open: false })); await apiFetch(`/candidates/${id}`, { method: 'DELETE' }); get(`/candidates?status=${status}&sort=score`); } });
  const bulkDel = () => { if (!selIds.size) return; setConfirm({ open: true, title: `Delete ${selIds.size}`, body: `Delete ${selIds.size} products?`, fn: async () => { setConfirm(p => ({ ...p, open: false })); for (const id of selIds) await apiFetch(`/candidates/${id}`, { method: 'DELETE' }).catch(() => {}); setSelIds(new Set()); get(`/candidates?status=${status}&sort=score`); setMsg('Deleted'); } }); };
  const bulkApprove = async () => { if (!selIds.size) return; for (const id of selIds) await apiFetch(`/candidates/${id}/approve`, { method: 'POST' }).catch(() => {}); setSelIds(new Set()); get(`/candidates?status=${status}&sort=score`); setMsg(`Imported ${selIds.size} products`); };
  const resetAll = () => setConfirm({ open: true, title: 'Clear All', body: 'Delete ALL non-imported candidates?', fn: async () => { setConfirm(p => ({ ...p, open: false })); await apiFetch('/candidates/reset', { method: 'POST' }); get(`/candidates?status=${status}&sort=score`); setMsg('Cleared.'); } });

  const items = (candidates || []).filter((i: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.title.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q) || (i.sourceName || '').toLowerCase().includes(q);
  });

  const profit = (i: any) => i.costPrice && i.suggestedPrice ? i.suggestedPrice - i.costPrice : null;
  const margin = (i: any) => i.costPrice && i.suggestedPrice ? (i.suggestedPrice - i.costPrice) / i.suggestedPrice * 100 : null;

  // ── Grid Card ──────────────────────────
  const gridMarkup = (
    <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
      {items.map((item: any) => {
        const s = item.score; const fs = s?.finalScore || 0;
        const m = margin(item); const p = profit(item);
        const imgs = (item.imageUrls || []).filter((u: string) => u);
        return (
          <div key={item.id} style={{
            borderRadius: 14, border: '1px solid #E4E5E7', background: 'white', overflow: 'hidden',
            transition: 'all 0.2s ease', cursor: 'default',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
          >
            {/* Image */}
            <div style={{ position: 'relative', height: 180, background: '#f5f5f5', overflow: 'hidden' }}>
              <img src={imgs[0] || PLACEHOLDER} alt="" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: 10, left: 10 }}>
                <ScoreCircle value={fs} size={38} />
              </div>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Badge tone="info">{item.sourceName || item.providerType}</Badge>
              </div>
              {imgs.length > 1 && (
                <div style={{ position: 'absolute', bottom: 8, right: 10, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                  +{imgs.length - 1} photos
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: '14px 16px' }}>
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <button onClick={() => setPreview(item)} style={{ all: 'unset', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#202223', lineHeight: '18px' }}>
                    {item.title.length > 55 ? item.title.slice(0, 55) + '...' : item.title}
                  </button>
                  <InlineStack gap="100">
                    <Badge>{item.category || 'General'}</Badge>
                    {item.warehouseCountry && <Badge tone="info">{item.warehouseCountry}</Badge>}
                  </InlineStack>
                </BlockStack>

                {/* Pricing Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, background: '#FAFBFC', borderRadius: 10, padding: '10px 8px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#6D7175', textTransform: 'uppercase', fontWeight: 600 }}>Price</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>${item.suggestedPrice?.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#6D7175', textTransform: 'uppercase', fontWeight: 600 }}>Cost</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>${item.costPrice?.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#6D7175', textTransform: 'uppercase', fontWeight: 600 }}>Profit</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#008060' }}>${p?.toFixed(2) || '-'}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#6D7175', textTransform: 'uppercase', fontWeight: 600 }}>Margin</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#008060' }}>{m?.toFixed(0) || '-'}%</div>
                  </div>
                </div>

                {/* Reviews + Shipping */}
                <InlineStack gap="200" wrap>
                  {item.reviewCount > 0 && <Badge tone="success">⭐ {item.reviewRating?.toFixed(1)} ({item.reviewCount?.toLocaleString()})</Badge>}
                  {item.orderVolume > 0 && <Badge>🔥 {item.orderVolume?.toLocaleString()} sold</Badge>}
                  <Badge>🚚 {item.shippingDays}d {item.shippingSpeed === 'EXPRESS' ? '⚡' : ''}</Badge>
                </InlineStack>

                {/* Fit Reasons */}
                {s?.fitReasons?.length > 0 && (
                  <InlineStack gap="100" wrap>
                    {s.fitReasons.slice(0, 3).map((r: string, i: number) => (
                      <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#E3F9ED', color: '#008060', fontWeight: 500 }}>{r}</span>
                    ))}
                  </InlineStack>
                )}

                <Divider />

                {/* Actions */}
                <InlineStack gap="200" align="space-between">
                  <InlineStack gap="100">
                    <Button size="slim" onClick={() => setPreview(item)}>View</Button>
                    {item.sourceUrl && <Button size="slim" url={item.sourceUrl} external>Source</Button>}
                  </InlineStack>
                  <InlineStack gap="100">
                    {item.status === 'CANDIDATE' && <>
                      <Button size="slim" onClick={() => reject(item.id)}>Skip</Button>
                      <Button size="slim" variant="primary" onClick={() => approve(item.id)} loading={busy === item.id}>Import</Button>
                    </>}
                    {item.status === 'REJECTED' && <Button size="slim" variant="primary" onClick={() => approve(item.id)}>Restore</Button>}
                    <Button size="slim" tone="critical" variant="plain" onClick={() => del(item.id)}>✕</Button>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </div>
          </div>
        );
      })}
    </InlineGrid>
  );

  // ── Rows ──────────────────────────────
  const rowMarkup = items.map((item: any, idx: number) => {
    const s = item.score; const fs = s?.finalScore || 0;
    const m = margin(item);
    return (
      <IndexTable.Row id={item.id} key={item.id} position={idx} selected={selIds.has(item.id)}>
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center">
            <ScoreCircle value={fs} size={34} />
            <Img src={item.imageUrls?.[0]} size={44} />
            <BlockStack gap="0">
              <button onClick={() => setPreview(item)} style={{ all: 'unset', cursor: 'pointer', color: '#2C6ECB', fontWeight: 600, fontSize: 13 }}>
                {item.title.length > 45 ? item.title.slice(0, 45) + '...' : item.title}
              </button>
              <Text as="span" variant="bodySm" tone="subdued">{item.category} · {item.sourceName}</Text>
            </BlockStack>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="0">
            <Text as="span" variant="bodySm" fontWeight="semibold">${item.suggestedPrice?.toFixed(2)}</Text>
            <Text as="span" variant="bodySm" tone="subdued">Cost ${item.costPrice?.toFixed(2)}</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell><Text as="span" tone="success" fontWeight="semibold">{m ? m.toFixed(0) + '%' : '-'}</Text></IndexTable.Cell>
        <IndexTable.Cell>
          {item.reviewCount > 0
            ? <Text as="span" variant="bodySm">⭐ {item.reviewRating?.toFixed(1)} ({item.reviewCount?.toLocaleString()})</Text>
            : <Text as="span" variant="bodySm" tone="subdued">-</Text>
          }
        </IndexTable.Cell>
        <IndexTable.Cell><Text as="span" variant="bodySm">{item.shippingDays}d</Text></IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
            <Button size="micro" onClick={() => setPreview(item)}>View</Button>
            {item.sourceUrl && <Button size="micro" url={item.sourceUrl} external>Source</Button>}
            {item.status === 'CANDIDATE' && <Button size="micro" variant="primary" onClick={() => approve(item.id)} loading={busy === item.id}>Import</Button>}
            {item.status === 'CANDIDATE' && <Button size="micro" onClick={() => reject(item.id)}>Skip</Button>}
            {item.status === 'REJECTED' && <Button size="micro" variant="primary" onClick={() => approve(item.id)}>Restore</Button>}
            <Button size="micro" tone="critical" variant="plain" onClick={() => del(item.id)}>Del</Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  // ── Preview Modal ──────────────────────
  const previewModal = preview && (
    <Modal open onClose={() => setPreview(null)} title={preview.title} size="large"
      primaryAction={preview.status === 'CANDIDATE' ? { content: 'Import to Store', onAction: () => approve(preview.id), loading: busy === preview.id } : undefined}
      secondaryActions={[
        ...(preview.sourceUrl ? [{ content: 'View on Source', onAction: () => window.open(preview.sourceUrl, '_blank') }] : []),
        { content: 'Close', onAction: () => setPreview(null) },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Images */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {(preview.imageUrls || []).length > 0
              ? preview.imageUrls.map((url: string, i: number) => <Img key={i} src={url} size={130} />)
              : <Img size={130} />
            }
          </div>

          {/* Pricing */}
          <div style={{ background: 'linear-gradient(135deg, #F0F5FF, #E8F4FF)', borderRadius: 12, padding: '18px 24px', border: '1px solid #B4D5FE' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, textAlign: 'center' }}>
              {[
                { label: 'Sell Price', val: `$${preview.suggestedPrice?.toFixed(2)}`, color: '#202223' },
                { label: 'Cost', val: `$${preview.costPrice?.toFixed(2)}`, color: '#202223' },
                { label: 'Profit', val: `$${profit(preview)?.toFixed(2) || '-'}`, color: '#008060' },
                { label: 'Margin', val: `${margin(preview)?.toFixed(0) || '-'}%`, color: '#008060' },
                { label: 'Shipping', val: `${preview.shippingDays}d`, color: '#202223' },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 11, color: '#6D7175', marginBottom: 4, fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: f.color }}>{f.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">Description</Text>
            <Text as="p" variant="bodySm">{preview.description || 'No description.'}</Text>
          </BlockStack>

          {/* Metadata Badges */}
          <InlineStack gap="200" wrap>
            <Badge>{preview.sourceName || preview.providerType}</Badge>
            <Badge tone="info">{preview.category || 'General'}</Badge>
            {preview.subcategory && <Badge>{preview.subcategory}</Badge>}
            {preview.warehouseCountry && <Badge>Ships from {preview.warehouseCountry}</Badge>}
            {preview.shippingSpeed && <Badge>{preview.shippingSpeed}</Badge>}
            {preview.reviewCount > 0 && <Badge tone="success">⭐ {preview.reviewRating?.toFixed(1)} ({preview.reviewCount?.toLocaleString()} reviews)</Badge>}
            {preview.orderVolume > 0 && <Badge>🔥 {preview.orderVolume?.toLocaleString()} orders</Badge>}
          </InlineStack>

          {/* Score Breakdown */}
          {preview.score && <>
            <Divider />
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingSm">AI Score Breakdown</Text>
              <ScoreCircle value={preview.score.finalScore} size={48} />
            </InlineStack>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ScoreBar label="Domain Fit" value={preview.score.domainFit} color="#5C6AC4" />
              <ScoreBar label="Store Fit" value={preview.score.storeFit} color="#5C6AC4" />
              <ScoreBar label="Audience" value={preview.score.audienceFit} color="#007ACE" />
              <ScoreBar label="Trend" value={preview.score.trendFit} color="#007ACE" />
              <ScoreBar label="Virality" value={preview.score.visualVirality} color="#9C6ADE" />
              <ScoreBar label="Novelty" value={preview.score.novelty} color="#9C6ADE" />
              <ScoreBar label="Price Fit" value={preview.score.priceFit} color="#008060" />
              <ScoreBar label="Margin Fit" value={preview.score.marginFit} color="#008060" />
              <ScoreBar label="Shipping" value={preview.score.shippingFit} color="#B98900" />
              <ScoreBar label="Low Saturation" value={preview.score.saturationInverse} color="#B98900" />
            </div>
            {preview.score.explanation && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #F0F5FF, #E8F0FE)', border: '1px solid #B4D5FE' }}>
                <Text as="p" variant="bodySm">💡 {preview.score.explanation}</Text>
              </div>
            )}
            {preview.score.fitReasons?.length > 0 && (
              <InlineStack gap="200" wrap>
                {preview.score.fitReasons.map((r: string, i: number) => <Badge key={i} tone="success">✓ {r}</Badge>)}
              </InlineStack>
            )}
            {preview.score.concerns?.length > 0 && (
              <InlineStack gap="200" wrap>
                {preview.score.concerns.map((r: string, i: number) => <Badge key={i} tone="warning">⚠ {r}</Badge>)}
              </InlineStack>
            )}
          </>}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );

  return (
    <Page title="Product Research" subtitle={`${items.length} products discovered`}
      primaryAction={{ content: '🔬 Run AI Research', onAction: async () => {
        setMsg('Running AI research...'); await apiFetch('/research/start', { method: 'POST' });
        await get('/candidates?status=CANDIDATE&sort=score'); setTab(0); setMsg('Research complete!');
      }}}
      secondaryActions={[{ content: 'Clear All', onAction: resetAll, destructive: true }]}
    >
      <BlockStack gap="400">
        {msg && <AutoDismiss message={msg} onDismiss={() => setMsg(null)} />}

        <InlineStack align="space-between">
          <Tabs tabs={tabs} selected={tab} onSelect={i => { setTab(i); setSearch(''); setSelIds(new Set()); }} fitted />
          <InlineStack gap="200">
            {selIds.size > 0 && <>
              <Badge>{selIds.size} selected</Badge>
              {status === 'CANDIDATE' && <Button size="slim" variant="primary" onClick={bulkApprove}>Import All</Button>}
              <Button size="slim" tone="critical" onClick={bulkDel}>Delete</Button>
            </>}
            <Button size="slim" pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</Button>
            <Button size="slim" pressed={view === 'rows'} onClick={() => setView('rows')}>Rows</Button>
          </InlineStack>
        </InlineStack>

        <TextField label="" labelHidden value={search} onChange={setSearch} placeholder="Search products, categories, sources..." autoComplete="off" clearButton onClearButtonClick={() => setSearch('')} />

        {loading && <Card><div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div></Card>}

        {!loading && items.length === 0 && (
          <Card><EmptyState heading="No products yet" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            action={status === 'CANDIDATE' ? { content: '🔬 Run AI Research', onAction: async () => {
              setMsg('Running...'); await apiFetch('/research/start', { method: 'POST' }); await get('/candidates?status=CANDIDATE&sort=score'); setMsg('Done!');
            }} : undefined}><Text as="p">Run AI research to discover winning products for your store.</Text></EmptyState></Card>
        )}

        {!loading && items.length > 0 && view === 'grid' && gridMarkup}

        {!loading && items.length > 0 && view === 'rows' && (
          <Card>
            <IndexTable resourceName={{ singular: 'product', plural: 'products' }} itemCount={items.length}
              headings={[{ title: 'Product' }, { title: 'Price' }, { title: 'Margin' }, { title: 'Reviews' }, { title: 'Ship' }, { title: 'Actions' }]}
              selectable selectedItemsCount={selIds.size}
              onSelectionChange={t => { if (t === 'page') { selIds.size === items.length ? setSelIds(new Set()) : setSelIds(new Set(items.map((i: any) => i.id))); } else setSelIds(new Set()); }}
            >{rowMarkup}</IndexTable>
          </Card>
        )}

        <Modal open={confirm.open} onClose={() => setConfirm(p => ({ ...p, open: false }))} title={confirm.title}
          primaryAction={{ content: 'Confirm', onAction: confirm.fn, destructive: true }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirm(p => ({ ...p, open: false })) }]}
        ><Modal.Section><Text as="p">{confirm.body}</Text></Modal.Section></Modal>

        {previewModal}
        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
