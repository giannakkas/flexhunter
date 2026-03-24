import { friendlyError } from '../utils/errors';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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


// ═══════════════════════════════════════════════
// Module-level polling engine — survives component remounts
// ═══════════════════════════════════════════════
const _poll = {
  running: false,
  progress: 0,
  stage: '',
  active: false,       // is the polling loop alive?
  timer: null as ReturnType<typeof setInterval> | null,
  aborted: false,
  listeners: new Set<() => void>(),

  notify() { this.listeners.forEach(fn => fn()); },

  stop() {
    this.active = false;
    this.aborted = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },

  finish(stage: string, keepRunning = false) {
    this.stop();
    this.progress = 100;
    this.stage = stage;
    if (!keepRunning) setTimeout(() => { this.running = false; this.notify(); }, 2000);
    this.notify();
  },

  start(fromProgress: number) {
    if (this.active) return; // already polling
    this.stop();
    this.active = true;
    this.aborted = false;
    this.running = true;
    this.progress = fromProgress;
    this.notify();

    let prog = fromProgress;
    let tick = 0;
    const msgs = [
      '🔬 Scoring products for your store...',
      '⏳ Analyzing niche fit & margins...',
      '📊 Ranking by profit & trend potential...',
      '💾 Saving winning products...',
      '🎯 Finalizing scores...',
      '📈 Evaluating viral potential...',
      '🔍 Checking competition levels...',
      '🚚 Rating supplier quality...',
    ];

    this.timer = setInterval(() => {
      tick++;
      if (prog < 90) prog = Math.min(90, prog + Math.random() * 0.25 + 0.05);
      this.progress = prog;
      this.stage = msgs[Math.floor(tick / 8) % msgs.length];
      this.notify();
    }, 1000);

    // Async status polling
    (async () => {
      const startedAt = Date.now();
      const MAX_MS = 7 * 60 * 1000;

      for (let i = 0; i < 150; i++) {
        await new Promise(r => setTimeout(r, 3000));
        if (this.aborted || !this.active) return;

        if (Date.now() - startedAt > MAX_MS) {
          this.finish('⏱️ Research took too long — showing results found so far');
          return;
        }

        try {
          const s = await apiFetch<any>('/research/status');
          const j = s?.data;
          if (!j) continue;

          if (j.status === 'RUNNING' && j.createdAt) {
            const age = Date.now() - new Date(j.createdAt).getTime();
            if (age > MAX_MS) { this.finish('⏱️ Research completed'); return; }
          }
          if (j.status === 'COMPLETED') {
            this.finish(`✅ Found ${(j.result as any)?.totalSaved || 0} products!`);
            return;
          }
          if (j.status === 'FAILED') {
            this.finish(`❌ ${j.error || 'Research failed'}`, false);
            this.running = false; this.notify();
            return;
          }
        } catch {}
      }
      this.finish('Research timed out. Results shown below.');
    })();
  },
};

export function CandidatesPage() {
  const navigate = useNavigate();
  const { data: candidates, get, loading, setData } = useApi<any[]>();
  const [preview, setPreview] = useState<any>(null);
  const [scoreItem, setScoreItem] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'rows'>('grid');
  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; title: string; body: string; fn: () => void }>({ open: false, title: '', body: '', fn: () => {} });
  const [diagResults, setDiagResults] = useState<any>(null);

  // Subscribe to module-level polling state
  const [researchRunning, setResearchRunning] = useState(_poll.running);
  const [researchProgress, setResearchProgress] = useState(_poll.progress);
  const [researchStage, setResearchStage] = useState(_poll.stage);

  useEffect(() => {
    const sync = () => {
      setResearchRunning(_poll.running);
      setResearchProgress(_poll.progress);
      setResearchStage(_poll.stage);
    };
    _poll.listeners.add(sync);
    sync(); // sync immediately on mount
    return () => { _poll.listeners.delete(sync); };
  }, []);

  // Only load candidates when NOT researching
  useEffect(() => { if (!researchRunning) get('/candidates?status=CANDIDATE&sort=score'); }, [get, researchRunning]);

  // On mount: check if research is running on server, resume polling if so (but only if not already polling)
  useEffect(() => {
    if (_poll.active) return; // Already polling from a previous mount — don't restart
    (async () => {
      try {
        const s = await apiFetch<any>('/research/status');
        const job = s?.data;
        if (job?.status === 'RUNNING') {
          const ageMs = Date.now() - new Date(job.createdAt).getTime();
          if (ageMs < 7 * 60 * 1000) {
            const est = Math.min(85, Math.round((ageMs / (5 * 60 * 1000)) * 90));
            _poll.start(Math.max(est, 10));
          } else {
            _poll.running = false; _poll.progress = 0; _poll.notify();
          }
        } else if (_poll.running) {
          // Server says not running but we thought it was
          _poll.running = false; _poll.progress = 0; _poll.notify();
        }
      } catch {}
    })();
  }, []); // eslint-disable-line

  const [billingError, setBillingError] = useState<string | null>(null);

  const handleResearch = async () => {
    setBillingError(null);
    _poll.stop();
    setData([]);
    _poll.running = true; _poll.progress = 2; _poll.stage = '🔑 Starting research...'; _poll.notify();

    apiFetch('/candidates/reset', { method: 'POST' }).catch(() => {});

    try {
      const result = await apiFetch<any>('/research/start', { method: 'POST' });
      
      // Check for billing limit or other server-side rejections
      if (result.success === false && result.error) {
        _poll.running = false; _poll.notify();
        setBillingError(result.error);
        return;
      }
      
      // Check for "no Store DNA" response
      if (result.data?.totalFetched === 0 && result.message?.includes('Store DNA')) {
        _poll.running = false; _poll.notify();
        setMsg(result.message);
        return;
      }
      
      _poll.start(5);
    } catch (err: any) {
      _poll.running = false; _poll.notify();
      setMsg(friendlyError(err.message));
    }
  };

  const runDiagnose = async () => {
    setDiagResults({ loading: true });
    try {
      const r = await apiFetch<any>('/research/diagnose', { method: 'POST' });
      setDiagResults(r.data || r);
    } catch (e: any) {
      setDiagResults({ error: e.message });
    }
  };

  const runDryRun = async () => {
    setDiagResults({ loading: true });
    try {
      const r = await apiFetch<any>('/research/dry-run', { method: 'POST' });
      setDiagResults(r.data || r);
    } catch (e: any) {
      setDiagResults({ error: e.message });
    }
  };

  const [clearing, setClearing] = useState(false);

  const forceClear = async () => {
    setClearing(true);
    try {
      const r = await apiFetch<any>('/candidates/force-clear', { method: 'POST' });
      setMsg(r.message || 'Cleared all products');
      setData([]);
      // Wait for cache to expire then reload
      await new Promise(r => setTimeout(r, 500));
      await get('/candidates?status=CANDIDATE&sort=score');
    } catch (e: any) {
      setMsg(friendlyError(e.message));
    }
    setClearing(false);
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
      secondaryActions={[{ content: '🔍 Diagnose', onAction: runDiagnose }, { content: '🧪 Dry Run', onAction: runDryRun }, { content: clearing ? '⏳ Clearing...' : '🗑️ Clear All', onAction: forceClear, destructive: true, loading: clearing, disabled: clearing }]}
    >
      <style>{GLOW_CSS}</style>
      <BlockStack gap="400">
        {msg && <AutoDismiss message={msg} onDismiss={() => setMsg(null)} />}

        {/* Billing Limit Banner */}
        {billingError && (
          <Banner tone="warning" onDismiss={() => setBillingError(null)}>
            <BlockStack gap="200">
              <Text as="p" fontWeight="semibold">{billingError}</Text>
              <InlineStack gap="200">
                <Button onClick={() => navigate('/plans')} size="slim">View Plans & Upgrade</Button>
              </InlineStack>
            </BlockStack>
          </Banner>
        )}

        {/* Diagnose Results */}
        {diagResults && !diagResults.loading && (
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingSm">🔍 Pipeline Diagnostic</Text>
                <Button size="slim" onClick={() => setDiagResults(null)}>Dismiss</Button>
              </InlineStack>
              {diagResults.error ? (
                <Text as="p" tone="critical">{diagResults.error}</Text>
              ) : (
                <BlockStack gap="100">
                  {(diagResults.steps || []).map((s: any, i: number) => (
                    <div key={i} style={{ padding: '4px 8px', borderRadius: 6, background: s.ok === false ? '#FEF2F2' : '#F0FDF4', fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>{s.ok === false ? '❌' : '✅'} {s.step}:</span>{' '}
                      {s.error || s.result || s.description || (s.count !== undefined ? `${s.count} found` : '') || s.status || JSON.stringify(s).slice(0, 120)}
                    </div>
                  ))}
                  {diagResults.errors?.length > 0 && (
                    <Banner tone="critical"><Text as="p" variant="bodySm">{diagResults.errors.join(' | ')}</Text></Banner>
                  )}
                  {diagResults.summary && (
                    <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', fontWeight: 700, fontSize: 13 }}>
                      📊 {diagResults.summary}
                    </div>
                  )}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        )}
        {diagResults?.loading && <Card><div style={{ textAlign: 'center', padding: 20 }}><Spinner size="small" /> Running diagnostics...</div></Card>}

        {clearing && (
          <Card>
            <div style={{ padding: '20px 0' }}>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd" alignment="center">Clearing All Products...</Text>
                <Text as="p" variant="bodySm" alignment="center" tone="subdued">Removing candidates, imports, scores, and cached data</Text>
                <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden', margin: '0 20px' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #EF4444, #F97316)', width: '100%', animation: 'shimmer 1s linear infinite' }} />
                </div>
              </BlockStack>
            </div>
          </Card>
        )}

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
                  <Text as="h2" variant="headingMd" alignment="center">Research in Progress</Text>
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    Our AI Agents are Deep Searching for the best results
                  </Text>
                </BlockStack>

                {/* Animated discovery messages */}
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
