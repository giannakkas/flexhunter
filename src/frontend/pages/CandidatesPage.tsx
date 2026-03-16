import { friendlyError } from '../utils/errors';
import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  EmptyState, Modal, Divider, Spinner, Banner, TextField,
  IndexTable, InlineGrid,
} from '@shopify/polaris';
import { useApi, apiFetch } from '../hooks/useApi';

const PLACEHOLDER = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
const GLOW_CSS = `
@keyframes greenGlow { 0%,100% { box-shadow: 0 0 6px rgba(0,128,96,0.4); } 50% { box-shadow: 0 0 16px rgba(0,128,96,0.7); } }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.8; } }
@keyframes orbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes dotPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
`;
const BTN = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 30, padding: '0 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s ease', whiteSpace: 'nowrap' as const };

function AutoDismiss({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [vis, setVis] = useState(true);
  useEffect(() => { const t = setTimeout(() => { setVis(false); setTimeout(onDismiss, 400); }, 5000); return () => clearTimeout(t); }, [onDismiss]);
  const isError = message.includes('Error') || message.includes('fail') || message.includes('unavailable') || message.includes('wrong') || message.includes('wait') || message.includes('expired') || message.includes('try again');
  return (
    <div style={{ opacity: vis ? 1 : 0, transition: 'opacity 0.4s', maxHeight: vis ? 200 : 0, overflow: 'hidden' }}>
      <Banner tone={isError ? 'warning' : 'success'} onDismiss={onDismiss}><Text as="p">{message}</Text></Banner>
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
      background: 'rgba(255,255,255,0.9)',
    }}>{Math.round(value)}</div>
  );
}

function ViralBadge({ score }: { score?: number }) {
  if (!score || score < 40) return null;
  let label: string, bg: string, color: string, icon: string;
  if (score >= 80) { icon = '🔥'; label = 'Early Viral'; bg = '#FEE2E2'; color = '#B91C1C'; }
  else if (score >= 65) { icon = '🚀'; label = 'Breakout'; bg = '#FFF7ED'; color = '#C2410C'; }
  else if (score >= 50) { icon = '📈'; label = 'Rising'; bg = '#FEF9C3'; color = '#A16207'; }
  else { icon = '📊'; label = 'Trending'; bg = '#EFF6FF'; color = '#1D4ED8'; }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: bg, color, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>{icon} {label}</span>
  );
}

function RecBadge({ score, fitScore }: { score: number; fitScore?: number }) {
  const fit = fitScore || score;
  let label: string, bg: string, color: string;
  if (fit < 30) { label = '⛔ Avoid'; bg = '#FEE2E2'; color = '#D72C0D'; }
  else if (score >= 80 && fit >= 70) { label = '🔥 Strong Buy'; bg = '#D1FAE5'; color = '#008060'; }
  else if (score >= 65 && fit >= 60) { label = '✅ Buy'; bg = '#E3F9ED'; color = '#008060'; }
  else if (score >= 50) { label = '🤔 Maybe'; bg = '#FFF8E6'; color = '#B98900'; }
  else { label = '⏭️ Skip'; bg = '#F6F6F7'; color = '#6D7175'; }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: bg, color, whiteSpace: 'nowrap' }}>{label}</span>
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

// ── Mini Score Panel (shown on Score click) ──────
function ScorePanel({ item, onClose }: { item: any; onClose: () => void }) {
  const s = item.score;
  if (!s) return null;
  const fs = s.finalScore || 0;
  const grade = fs >= 80 ? 'Excellent' : fs >= 65 ? 'Good' : fs >= 50 ? 'Fair' : fs >= 35 ? 'Weak' : 'Poor';
  const gradeColor = fs >= 80 ? '#008060' : fs >= 65 ? '#47B881' : fs >= 50 ? '#B98900' : fs >= 35 ? '#DE6E1E' : '#D72C0D';

  return (
    <Modal open onClose={onClose} title="AI Score Analytics" size="small"
      secondaryActions={[{ content: 'Close', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Overall */}
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <ScoreCircle value={fs} size={64} />
            <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, color: gradeColor }}>{grade} Match</div>
            <Text as="p" variant="bodySm" tone="subdued">{item.title}</Text>
          </div>

          {/* Score Bars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <ScoreBar label="🎯 Domain Fit" value={s.domainFit} color="#5C6AC4" />
            <ScoreBar label="🏪 Store Fit" value={s.storeFit} color="#5C6AC4" />
            <ScoreBar label="👥 Audience" value={s.audienceFit} color="#007ACE" />
            <ScoreBar label="📈 Trend" value={s.trendFit} color="#007ACE" />
            <ScoreBar label="🔥 Viral Potential" value={s.visualVirality} color="#DC2626" />
            <ScoreBar label="✨ Novelty" value={s.novelty} color="#9C6ADE" />
            <ScoreBar label="💰 Price Fit" value={s.priceFit} color="#008060" />
            <ScoreBar label="📊 Margin Fit" value={s.marginFit} color="#008060" />
            <ScoreBar label="🚚 Shipping" value={s.shippingFit} color="#B98900" />
            <ScoreBar label="🔒 Low Saturation" value={s.saturationInverse} color="#B98900" />
          </div>

          {/* AI Explanation */}
          {s.explanation && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F0F5FF', border: '1px solid #B4D5FE' }}>
              <Text as="p" variant="bodySm">💡 {s.explanation}</Text>
            </div>
          )}

          {/* Fit & Concerns */}
          {s.fitReasons?.length > 0 && (
            <InlineStack gap="100" wrap>
              {s.fitReasons.map((r: string, i: number) => <Badge key={i} tone="success">✓ {r}</Badge>)}
            </InlineStack>
          )}
          {s.concerns?.length > 0 && (
            <InlineStack gap="100" wrap>
              {s.concerns.map((r: string, i: number) => <Badge key={i} tone="warning">⚠ {r}</Badge>)}
            </InlineStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

export function CandidatesPage() {
  const { data: candidates, get, loading, setData } = useApi<any[]>();
  const [preview, setPreview] = useState<any>(null);
  const [scoreItem, setScoreItem] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'rows'>('grid');
  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; title: string; body: string; fn: () => void }>({ open: false, title: '', body: '', fn: () => {} });

  // Research animation state
  const [researchRunning, setResearchRunning] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [researchStage, setResearchStage] = useState('');

  useEffect(() => { get('/candidates?status=CANDIDATE&sort=score'); }, [get]);

  // Auto-detect if research is already running (e.g., user navigated away and came back)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await apiFetch<any>('/research/status');
        const job = status?.data;
        if (!job || job.status !== 'RUNNING' || cancelled) return;
        
        // Research is running — resume progress UI
        setResearchRunning(true);
        setResearchProgress(50);
        setResearchStage('⏳ Research in progress — resuming...');

        // Start polling
        for (let i = 0; i < 160; i++) {
          if (cancelled) return;
          await new Promise(r => setTimeout(r, 3000));
          try {
            const s = await apiFetch<any>('/research/status');
            const j = s?.data;
            if (!j) continue;

            // Update stage message
            const msgs = [
              '🔬 AI is scoring products...',
              '⏳ DeepSeek analyzing your niche...',
              '📊 Ranking by fit, profit & trend...',
              '💾 Saving winning products...',
            ];
            setResearchStage(msgs[i % msgs.length]);
            setResearchProgress(Math.min(95, 50 + i * 0.5));

            if (j.status === 'COMPLETED') {
              setResearchProgress(100);
              const saved = (j.result as any)?.totalSaved || 0;
              setResearchStage(`✅ Research complete! Found ${saved} products.`);
              await get('/candidates?status=CANDIDATE&sort=score');
              setTimeout(() => { if (!cancelled) setResearchRunning(false); }, 2000);
              return;
            }
            if (j.status === 'FAILED') {
              setResearchRunning(false);
              await get('/candidates?status=CANDIDATE&sort=score');
              return;
            }
            // Periodically load products
            if (i % 10 === 0) await get('/candidates?status=CANDIDATE&sort=score');
          } catch {}
        }
        if (!cancelled) { setResearchRunning(false); await get('/candidates?status=CANDIDATE&sort=score'); }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const handleResearch = async () => {
    setResearchRunning(true);
    setResearchProgress(1);
    setResearchStage('🔑 Starting AI Research Engine...');
    setData([]);

    const stages = [
      { at: 2, text: '🗑️ Clearing old results...' },
      { at: 5, text: '🧬 Step 1/6 — Building store DNA profile...' },
      { at: 12, text: '🔑 Step 2/6 — AI generating niche keywords...' },
      { at: 20, text: '🌐 Step 3/6 — Searching AliExpress & CJ Dropshipping...' },
      { at: 35, text: '📦 Step 3/6 — Fetching products from suppliers...' },
      { at: 45, text: '🤖 Step 4/6 — AI filtering relevant products...' },
      { at: 55, text: '🎯 Step 5/6 — DeepSeek V3 scoring products...' },
      { at: 65, text: '💰 Step 5/6 — Analyzing margins & trends...' },
      { at: 75, text: '📈 Step 5/6 — Viral prediction engine running...' },
      { at: 85, text: '💾 Step 6/6 — Saving winning products...' },
      { at: 95, text: '✅ Almost done...' },
    ];

    // Start progress timer IMMEDIATELY (don't wait for API calls)
    let prog = 1;
    let tickCount = 0;
    const interval = setInterval(() => {
      tickCount++;
      if (prog < 95) {
        prog += Math.random() * 0.8 + 0.2;
        if (prog > 95) prog = 95;
      }
      setResearchProgress(prog);
      const stage = [...stages].reverse().find(s => prog >= s.at);
      if (stage && prog < 95) setResearchStage(stage.text);
      
      // After 95%, show time-based messages so user knows it's not stuck
      if (prog >= 95) {
        const messages = [
          '✅ Almost done — AI is finalizing scores...',
          '⏳ DeepSeek is analyzing products — this takes 2-4 minutes...',
          '🔬 Still working — scoring products against your store DNA...',
          '📊 Ranking products by fit, profit, and viral potential...',
          '💾 Writing results to database...',
        ];
        setResearchStage(messages[Math.floor(tickCount / 8) % messages.length]);
      }
    }, 1000);

    // Clear old candidates (fire and forget — don't block)
    apiFetch('/candidates/reset', { method: 'POST' }).catch(() => {});

    setResearchStage('🔑 Starting AI Research Engine...');

    try {
      // Start research — returns immediately
      await apiFetch<any>('/research/start', { method: 'POST' });

      // Poll for completion every 3 seconds (max 8 minutes)
      const pollForResults = async () => {
        for (let i = 0; i < 160; i++) { // max 8 minutes
          await new Promise(r => setTimeout(r, 3000));
          try {
            const status = await apiFetch<any>('/research/status');
            const job = status.data;
            if (!job) continue;

            if (job.status === 'COMPLETED') {
              clearInterval(interval);
              setResearchProgress(100);
              const saved = (job.result as any)?.totalSaved || 0;
              setResearchStage(`✅ Research complete! Found ${saved} winning products.`);
              await get('/candidates?status=CANDIDATE&sort=score');
              setTimeout(() => { setResearchRunning(false); }, 2000);
              return;
            }
            if (job.status === 'FAILED') {
              clearInterval(interval);
              setResearchRunning(false);
              // Still try to load any products that were saved before failure
              await get('/candidates?status=CANDIDATE&sort=score');
              setMsg(friendlyError(job.error || 'Research failed — some products may still have been found'));
              return;
            }
            
            // Still running — periodically check if products were saved already
            if (i > 0 && i % 10 === 0) {
              await get('/candidates?status=CANDIDATE&sort=score');
            }
          } catch {}
        }
        // Timeout — load whatever was saved
        clearInterval(interval);
        setResearchRunning(false);
        await get('/candidates?status=CANDIDATE&sort=score');
        setMsg('Research is taking longer than expected. Products found so far are shown below.');
      };

      pollForResults();
    } catch (err: any) {
      clearInterval(interval);
      setResearchRunning(false);
      setMsg(friendlyError(err.message));
    }
  };

  const selectProduct = async (id: string) => {
    setBusy(id);
    try { const r = await apiFetch<any>(`/candidates/${id}/select`, { method: 'POST' }); setMsg(r.message || 'Selected!'); }
    catch (e: any) { setMsg(friendlyError(e.message)); }
    await get('/candidates?status=CANDIDATE&sort=score');
    setBusy(null); setPreview(null);
  };
  const del = (id: string) => setConfirmDlg({ open: true, title: 'Delete', body: 'Permanently delete this product?', fn: async () => { setConfirmDlg(p => ({ ...p, open: false })); await apiFetch(`/candidates/${id}`, { method: 'DELETE' }); get('/candidates?status=CANDIDATE&sort=score'); } });
  const bulkDel = () => { if (!selIds.size) return; setConfirmDlg({ open: true, title: `Delete ${selIds.size}`, body: `Delete ${selIds.size} products?`, fn: async () => { setConfirmDlg(p => ({ ...p, open: false })); for (const id of selIds) await apiFetch(`/candidates/${id}`, { method: 'DELETE' }).catch(() => {}); setSelIds(new Set()); get('/candidates?status=CANDIDATE&sort=score'); setMsg('Deleted'); } }); };
  const bulkSelect = async () => { if (!selIds.size) return; for (const id of selIds) await apiFetch(`/candidates/${id}/select`, { method: 'POST' }).catch(() => {}); setSelIds(new Set()); get('/candidates?status=CANDIDATE&sort=score'); setMsg(`Selected ${selIds.size} products`); };
  const resetAll = () => setConfirmDlg({ open: true, title: 'Clear & Re-Research', body: 'Clear all current results and run fresh AI research?', fn: async () => {
    setConfirmDlg(p => ({ ...p, open: false }));
    await apiFetch('/candidates/reset', { method: 'POST' }).catch(() => {});
    await get('/candidates?status=CANDIDATE&sort=score');
    handleResearch();
  } });

  const items = (candidates || []).filter((i: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.title.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q) || (i.sourceName || '').toLowerCase().includes(q);
  });

  const profit = (i: any) => i.costPrice && i.suggestedPrice ? i.suggestedPrice - i.costPrice : null;
  const margin = (i: any) => i.costPrice && i.suggestedPrice ? (i.suggestedPrice - i.costPrice) / i.suggestedPrice * 100 : null;

  // ── Grid ──────────────────────────────
  const gridMarkup = (
    <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
      {items.map((item: any) => {
        const s = item.score; const fs = s?.finalScore || 0;
        const m = margin(item); const p = profit(item);
        const imgs = (item.imageUrls || []).filter((u: string) => u);
        return (
          <div key={item.id} style={{
            borderRadius: 14, border: '1px solid #E4E5E7', background: 'white', overflow: 'hidden',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
          >
            {/* Image */}
            <div style={{ position: 'relative', height: 180, background: '#f5f5f5', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setPreview(item)}>
              <img src={imgs[0] || PLACEHOLDER} alt="" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: 10, left: 10 }}><ScoreCircle value={fs} size={38} /></div>
              <div style={{ position: 'absolute', top: 10, right: 10 }}><Badge tone="info">{item.sourceName || item.providerType}</Badge></div>
              {imgs.length > 1 && (
                <div style={{ position: 'absolute', bottom: 8, right: 10, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                  📷 {imgs.length} photos
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
                    <RecBadge score={fs} fitScore={s?.domainFit} />
                    <ViralBadge score={s?.visualVirality} />
                  </InlineStack>
                </BlockStack>

                {/* Pricing */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, background: '#FAFBFC', borderRadius: 10, padding: '10px 8px' }}>
                  {[
                    { label: 'Sell For', val: `$${item.suggestedPrice?.toFixed(2)}` },
                    { label: 'Est. Cost', val: `$${item.costPrice?.toFixed(2)}` },
                    { label: 'Profit', val: `$${p?.toFixed(2) || '-'}`, green: true },
                    { label: 'Margin', val: `${m?.toFixed(0) || '-'}%`, green: true },
                  ].map(c => (
                    <div key={c.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#6D7175', textTransform: 'uppercase', fontWeight: 600 }}>{c.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: c.green ? '#008060' : '#202223' }}>{c.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: '#8C9196', textAlign: 'center', marginTop: -4 }}>⚠️ Prices are estimates — verify on source before selling</div>

                {/* Reviews + Shipping */}
                <InlineStack gap="200" wrap>
                  {item.reviewCount > 0 && <Badge tone="success">⭐ {item.reviewRating?.toFixed(1)} ({item.reviewCount?.toLocaleString()})</Badge>}
                  {item.orderVolume > 0 && <Badge>🔥 {item.orderVolume?.toLocaleString()} sold</Badge>}
                  <Badge>🚚 {item.shippingDays}d{item.shippingSpeed === 'EXPRESS' ? ' ⚡' : ''}</Badge>
                </InlineStack>

                {s?.fitReasons?.length > 0 && (
                  <InlineStack gap="100" wrap>
                    {s.fitReasons.slice(0, 3).map((r: string, i: number) => (
                      <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#E3F9ED', color: '#008060', fontWeight: 500 }}>{r}</span>
                    ))}
                  </InlineStack>
                )}

                <Divider />

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setPreview(item)} style={{ ...BTN, borderColor: '#C9CCCF', background: '#F6F6F7', color: '#202223' }}>View</button>
                    <button onClick={() => setScoreItem(item)} style={{ ...BTN, borderColor: '#5C6AC4', background: '#F0F0FF', color: '#5C6AC4' }}>📊 Score</button>
                    {item.sourceUrl && <button onClick={() => window.open(item.sourceUrl, '_blank')} style={{ ...BTN, borderColor: '#C9CCCF', background: '#F6F6F7', color: '#202223' }}>Source</button>}
                  </div>
                  <button onClick={() => selectProduct(item.id)} disabled={busy === item.id} style={{
                    ...BTN, borderColor: '#008060', background: '#008060', color: 'white',
                    animation: 'greenGlow 2s ease-in-out infinite', opacity: busy === item.id ? 0.6 : 1,
                    minWidth: 70,
                  }}>{busy === item.id ? '...' : '✓ Select'}</button>
                </div>
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
            <Text as="span" variant="bodySm" tone="subdued">Est. Cost ${item.costPrice?.toFixed(2)}</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell><Text as="span" tone="success" fontWeight="semibold">{m ? m.toFixed(0) + '%' : '-'}</Text></IndexTable.Cell>
        <IndexTable.Cell>
          {item.reviewCount > 0
            ? <Text as="span" variant="bodySm">⭐ {item.reviewRating?.toFixed(1)} ({item.reviewCount?.toLocaleString()})</Text>
            : <Text as="span" variant="bodySm" tone="subdued">-</Text>}
        </IndexTable.Cell>
        <IndexTable.Cell><Text as="span" variant="bodySm">{item.shippingDays}d</Text></IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPreview(item)} style={{ ...BTN, borderColor: '#C9CCCF', background: '#F6F6F7', color: '#202223', height: 26, fontSize: 11, padding: '0 8px' }}>View</button>
            <button onClick={() => setScoreItem(item)} style={{ ...BTN, borderColor: '#5C6AC4', background: '#F0F0FF', color: '#5C6AC4', height: 26, fontSize: 11, padding: '0 8px' }}>Score</button>
            {item.sourceUrl && <button onClick={() => window.open(item.sourceUrl, '_blank')} style={{ ...BTN, borderColor: '#C9CCCF', background: '#F6F6F7', color: '#202223', height: 26, fontSize: 11, padding: '0 8px' }}>Source</button>}
            <button onClick={() => del(item.id)} style={{ ...BTN, borderColor: '#E4E5E7', background: 'white', color: '#D72C0D', height: 26, fontSize: 11, padding: '0 8px' }}>✕</button>
            <button onClick={() => selectProduct(item.id)} disabled={busy === item.id} style={{
              ...BTN, borderColor: '#008060', background: '#008060', color: 'white', height: 26, fontSize: 11, padding: '0 10px',
              animation: 'greenGlow 2s ease-in-out infinite', opacity: busy === item.id ? 0.6 : 1,
            }}>{busy === item.id ? '...' : 'Select'}</button>
          </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  // ── Preview Modal ──────────────────────
  const previewModal = preview && (
    <Modal open onClose={() => setPreview(null)} title={preview.title} size="large"
      primaryAction={{ content: 'Select Product', onAction: () => selectProduct(preview.id), loading: busy === preview.id }}
      secondaryActions={[
        ...(preview.sourceUrl ? [{ content: 'View on Source', onAction: () => window.open(preview.sourceUrl, '_blank') }] : []),
        { content: 'Close', onAction: () => setPreview(null) },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {(preview.imageUrls || []).length > 0
              ? preview.imageUrls.map((url: string, i: number) => <Img key={i} src={url} size={130} />)
              : <Img size={130} />}
          </div>

          <div style={{ background: 'linear-gradient(135deg, #F0F5FF, #E8F4FF)', borderRadius: 12, padding: '18px 24px', border: '1px solid #B4D5FE' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, textAlign: 'center' }}>
              {[
                { label: 'Sell Price', val: `$${preview.suggestedPrice?.toFixed(2)}`, color: '#202223' },
                { label: 'Est. Cost', val: `$${preview.costPrice?.toFixed(2)}`, color: '#202223' },
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
          <div style={{ fontSize: 11, color: '#8C9196', textAlign: 'center', marginTop: -8 }}>⚠️ Prices are estimates from supplier API — always verify on source before setting your final price</div>

          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">Description</Text>
            <Text as="p" variant="bodySm">{preview.description || 'No description.'}</Text>
          </BlockStack>

          <InlineStack gap="200" wrap>
            <Badge>{preview.sourceName || preview.providerType}</Badge>
            <Badge tone="info">{preview.category || 'General'}</Badge>
            {preview.subcategory && <Badge>{preview.subcategory}</Badge>}
            {preview.warehouseCountry && <Badge>Ships from {preview.warehouseCountry}</Badge>}
            {preview.shippingSpeed && <Badge>{preview.shippingSpeed}</Badge>}
            {preview.reviewCount > 0 && <Badge tone="success">⭐ {preview.reviewRating?.toFixed(1)} ({preview.reviewCount?.toLocaleString()} reviews)</Badge>}
            {preview.orderVolume > 0 && <Badge>🔥 {preview.orderVolume?.toLocaleString()} orders</Badge>}
          </InlineStack>

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
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#F0F5FF', border: '1px solid #B4D5FE' }}>
                <Text as="p" variant="bodySm">💡 {preview.score.explanation}</Text>
              </div>
            )}
            {preview.score.fitReasons?.length > 0 && <InlineStack gap="200" wrap>{preview.score.fitReasons.map((r: string, i: number) => <Badge key={i} tone="success">✓ {r}</Badge>)}</InlineStack>}
            {preview.score.concerns?.length > 0 && <InlineStack gap="200" wrap>{preview.score.concerns.map((r: string, i: number) => <Badge key={i} tone="warning">⚠ {r}</Badge>)}</InlineStack>}
          </>}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );

  return (
    <Page title="Product Research" subtitle={`${items.length} products discovered`}
      primaryAction={{ content: researchRunning ? 'Researching...' : '🔬 Run AI Research', onAction: handleResearch, loading: researchRunning, disabled: researchRunning }}
      secondaryActions={[]}
    >
      <style>{GLOW_CSS}</style>
      <BlockStack gap="400">
        {msg && <AutoDismiss message={msg} onDismiss={() => setMsg(null)} />}

        {/* ── Research Animation Overlay ── */}
        {researchRunning && (
          <Card>
            <div style={{ padding: '20px 0' }}>
              <BlockStack gap="400">
                {/* AI Brain animation */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%', position: 'relative',
                    background: 'linear-gradient(135deg, #5C6AC4, #8B5CF6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'pulse 2s ease-in-out infinite',
                    boxShadow: '0 0 30px rgba(92,106,196,0.4)',
                  }}>
                    <div style={{
                      position: 'absolute', inset: -6, borderRadius: '50%',
                      border: '2px dashed rgba(92,106,196,0.4)',
                      animation: 'orbit 3s linear infinite',
                    }} />
                    <span style={{ fontSize: 36, zIndex: 1 }}>🔬</span>
                  </div>
                </div>

                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd" alignment="center">AI Research in Progress</Text>
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    Searching live suppliers and scoring products for your store...
                  </Text>
                </BlockStack>

                {/* Progress bar */}
                <div style={{ height: 12, borderRadius: 6, background: '#E4E5E7', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 6,
                    background: researchProgress >= 100
                      ? 'linear-gradient(90deg, #008060, #00B386)'
                      : 'linear-gradient(90deg, #5C6AC4, #8B5CF6, #007ACE, #5C6AC4)',
                    backgroundSize: '300% 100%',
                    animation: researchProgress < 100 ? 'shimmer 1.5s linear infinite' : 'none',
                    width: `${researchProgress}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>

                <InlineStack align="space-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5C6AC4', animation: 'dotPulse 1s ease-in-out infinite' }} />
                    <Text as="p" variant="bodySm" tone="subdued">{researchStage}</Text>
                  </div>
                  <Text as="p" variant="bodySm" fontWeight="bold">{Math.round(researchProgress)}%</Text>
                </InlineStack>
              </BlockStack>
            </div>
          </Card>
        )}

        <InlineStack align="space-between">
          <InlineStack gap="200">
            {selIds.size > 0 && <>
              <Badge>{selIds.size} selected</Badge>
              <Button size="slim" variant="primary" onClick={bulkSelect}>Select All</Button>
              <Button size="slim" tone="critical" onClick={bulkDel}>Delete</Button>
            </>}
          </InlineStack>
          <InlineStack gap="200">
            <Button size="slim" pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</Button>
            <Button size="slim" pressed={view === 'rows'} onClick={() => setView('rows')}>Rows</Button>
          </InlineStack>
        </InlineStack>

        <TextField label="" labelHidden value={search} onChange={setSearch} placeholder="Search products, categories, sources..." autoComplete="off" clearButton onClearButtonClick={() => setSearch('')} />

        {loading && <Card><div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div></Card>}

        {!loading && items.length === 0 && (
          <Card><EmptyState heading="No products yet" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            action={{ content: '🔬 Run AI Research', onAction: handleResearch }}><Text as="p">Run AI research to discover winning products for your store.</Text></EmptyState></Card>
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

        <Modal open={confirmDlg.open} onClose={() => setConfirmDlg(p => ({ ...p, open: false }))} title={confirmDlg.title}
          primaryAction={{ content: 'Confirm', onAction: confirmDlg.fn, destructive: true }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmDlg(p => ({ ...p, open: false })) }]}
        ><Modal.Section><Text as="p">{confirmDlg.body}</Text></Modal.Section></Modal>

        {previewModal}
        {scoreItem && <ScorePanel item={scoreItem} onClose={() => setScoreItem(null)} />}
        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
