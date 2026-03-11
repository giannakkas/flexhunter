import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Button, Banner, Spinner,
  InlineStack, Badge, Divider, DescriptionList, TextField,
  InlineGrid, Modal, ProgressBar,
} from '@shopify/polaris';
import { useApi, apiFetch } from '../hooks/useApi';
import { useNavigate } from 'react-router-dom';

// ── Animated entrance wrapper ──────────────────
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity 0.4s ease, transform 0.4s ease',
    }}>{children}</div>
  );
}

export function ResearchPage() {
  const navigate = useNavigate();
  const { data: dna, get: getDna, loading: dnaLoading } = useApi<any>();
  const { data: status, get: getStatus } = useApi<any>();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [domainPreview, setDomainPreview] = useState<any>(null);
  const [domainInput, setDomainInput] = useState('');
  const [savedDomains, setSavedDomains] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [supplierStates, setSupplierStates] = useState<Record<string, boolean>>({});
  const [supplierLive, setSupplierLive] = useState<Record<string, boolean>>({});
  const [shopConnected, setShopConnected] = useState<boolean | null>(null);
  const [researchRunning, setResearchRunning] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [researchStage, setResearchStage] = useState('');

  const toggleSupplier = async (name: string) => {
    const current = supplierStates[name] !== false;
    setSupplierStates(prev => ({ ...prev, [name]: !current }));
    try { await apiFetch('/suppliers/toggle', { method: 'POST', body: JSON.stringify({ name, enabled: !current }) }); } catch {}
  };

  useEffect(() => {
    getDna('/store-dna');
    getStatus('/research/status');
    apiFetch<any>('/shop-status').then(r => setShopConnected(r.data?.hasToken || false)).catch(() => {});
    apiFetch<any>('/suppliers').then(r => {
      if (r.data) {
        const live: Record<string, boolean> = {};
        const states: Record<string, boolean> = {};
        for (const s of r.data) { live[s.name] = s.live; states[s.name] = s.enabled; }
        setSupplierLive(live);
        setSupplierStates(states);
      }
    }).catch(() => {});
    const saved = localStorage.getItem('fh_domains');
    if (saved) setSavedDomains(JSON.parse(saved));
  }, [getDna, getStatus]);

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [message]);

  const handleStartResearch = async () => {
    setResearchRunning(true);
    setResearchProgress(0);
    setResearchStage('Initializing research pipeline...');

    const stages = [
      { at: 4, text: '🧬 Building store DNA profile...' },
      { at: 10, text: '🔍 Analyzing domain intent and audience signals...' },
      { at: 16, text: '🤖 AI generating targeted search queries...' },
      { at: 22, text: '🌐 Connecting to AliExpress, CJ, and 6 more sources...' },
      { at: 30, text: '📦 Fetching products from 8 suppliers...' },
      { at: 38, text: '🔄 Deduplicating and filtering banned categories...' },
      { at: 44, text: '📊 Running 11-dimension code-based scoring...' },
      { at: 52, text: '🤖 AI deep-analyzing top candidates for audience fit...' },
      { at: 60, text: '🤖 AI evaluating trend momentum and virality...' },
      { at: 68, text: '🤖 AI scoring product-market novelty...' },
      { at: 75, text: '⚖️ Blending AI scores with algorithmic analysis...' },
      { at: 82, text: '💰 Calculating profit margins and shipping scores...' },
      { at: 88, text: '🏆 Final ranking by weighted AI-enhanced score...' },
      { at: 93, text: '💾 Saving top candidates to database...' },
      { at: 97, text: '✅ Finalizing research results...' },
    ];

    // Animate progress over ~45 seconds
    let prog = 0;
    const interval = setInterval(() => {
      prog += Math.random() * 1.2 + 0.3;
      if (prog > 97) prog = 97;
      setResearchProgress(prog);
      const stage = [...stages].reverse().find(s => prog >= s.at);
      if (stage) setResearchStage(stage.text);
    }, 600);

    try {
      await apiFetch('/research/start', { method: 'POST' });
      clearInterval(interval);
      setResearchProgress(100);
      setResearchStage('Research complete! Redirecting to candidates...');
      await getStatus('/research/status');
      setTimeout(() => {
        setResearchRunning(false);
        navigate('/candidates');
      }, 1500);
    } catch (err: any) {
      clearInterval(interval);
      setResearchRunning(false);
      setMessage('Research failed: ' + err.message);
    }
  };

  const handleAnalyzeStore = async () => {
    setAnalyzing(true);
    setAnalyzeProgress(0);
    const interval = setInterval(() => {
      setAnalyzeProgress(p => {
        if (p >= 92) return 92;
        return p + Math.random() * 2 + 0.5;
      });
    }, 600);

    try {
      await apiFetch('/store-dna/analyze', { method: 'POST' });
      clearInterval(interval);
      setAnalyzeProgress(100);
      await getDna('/store-dna');
      setMessage('Store DNA updated.');
      setTimeout(() => { setAnalyzing(false); setAnalyzeProgress(0); }, 1500);
    } catch (err: any) {
      clearInterval(interval);
      setAnalyzing(false);
      setAnalyzeProgress(0);
      setMessage('Analysis failed: ' + err.message);
    }
  };

  const handlePreviewDomain = async (domain: string) => {
    try {
      const result = await apiFetch<any>('/domain/analyze', {
        method: 'POST',
        body: JSON.stringify({ domain }),
      });
      setDomainPreview(result.data);
    } catch {}
  };

  const addDomain = () => {
    if (domainInput.trim() && !savedDomains.includes(domainInput.trim())) {
      const updated = [...savedDomains, domainInput.trim()];
      setSavedDomains(updated);
      localStorage.setItem('fh_domains', JSON.stringify(updated));
      setDomainInput('');
    }
  };

  const removeDomain = (d: string) => {
    const updated = savedDomains.filter(x => x !== d);
    setSavedDomains(updated);
    localStorage.setItem('fh_domains', JSON.stringify(updated));
    if (domainPreview?.domain === d) setDomainPreview(null);
  };

  return (
    <Page
      title="Research Console"
      subtitle="Deep product research powered by your store's DNA"
      primaryAction={{ content: researchRunning ? 'Researching...' : 'Start Research', onAction: handleStartResearch, loading: researchRunning, disabled: researchRunning }}
      secondaryActions={[{ content: analyzing ? 'Analyzing...' : 'Re-Analyze Store', onAction: handleAnalyzeStore, loading: analyzing }]}
    >
      <BlockStack gap="500">
        {/* Auto-dismiss message */}
        {message && (
          <div style={{ animation: 'fadeIn 0.3s ease', transition: 'opacity 0.5s ease' }}>
            <Banner tone={message.includes('fail') ? 'critical' : 'success'} onDismiss={() => setMessage(null)}>
              <Text as="p">{message}</Text>
            </Banner>
          </div>
        )}

        {/* Connection status */}
        {shopConnected !== null && (
          <FadeIn>
            <InlineStack gap="200">
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: shopConnected ? '#008060' : '#D72C0D',
                boxShadow: shopConnected ? '0 0 6px #008060' : '0 0 6px #D72C0D',
              }} />
              <Text as="span" variant="bodySm" tone={shopConnected ? 'success' : 'critical'}>
                {shopConnected ? 'Shopify Connected' : 'Shopify Not Connected — imports won\'t appear in store'}
              </Text>
            </InlineStack>
          </FadeIn>
        )}

        {/* Research Progress Overlay */}
        {researchRunning && (
          <FadeIn>
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #5C6AC4, #8B5CF6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}>
                    <span style={{ fontSize: 20 }}>🔬</span>
                  </div>
                  <BlockStack gap="0">
                    <Text as="h2" variant="headingMd">AI Research in Progress</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Finding winning products for your store...</Text>
                  </BlockStack>
                </InlineStack>

                <div style={{ position: 'relative' }}>
                  <div style={{ height: 12, borderRadius: 6, background: '#E4E5E7', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 6,
                      background: researchProgress >= 100
                        ? 'linear-gradient(90deg, #008060, #00B386)'
                        : 'linear-gradient(90deg, #5C6AC4, #8B5CF6, #5C6AC4)',
                      backgroundSize: '200% 100%',
                      animation: researchProgress < 100 ? 'shimmer 2s ease-in-out infinite' : 'none',
                      width: `${researchProgress}%`,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
                </div>

                <InlineStack align="space-between">
                  <Text as="p" variant="bodySm" tone="subdued">{researchStage}</Text>
                  <Text as="p" variant="bodySm" fontWeight="bold">{Math.round(researchProgress)}%</Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </FadeIn>
        )}

        {/* Analyze Progress */}
        {analyzing && (
          <FadeIn>
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingSm">Re-Analyzing Store DNA...</Text>
                  <Text as="span" variant="bodySm" fontWeight="bold">{Math.round(analyzeProgress)}%</Text>
                </InlineStack>
                <div style={{ height: 8, borderRadius: 4, background: '#E4E5E7', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: analyzeProgress >= 100
                      ? 'linear-gradient(90deg, #008060, #00B386)'
                      : 'linear-gradient(90deg, #007ACE, #5C6AC4)',
                    width: `${analyzeProgress}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </BlockStack>
            </Card>
          </FadeIn>
        )}

        {/* ── Store DNA ───────────────────────── */}
        <FadeIn delay={100}>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Store DNA</Text>
                <InlineStack gap="200">
                  {dna && <Badge tone="success">Analyzed</Badge>}
                  <Button size="slim" onClick={handleAnalyzeStore} loading={analyzing}>Re-Analyze</Button>
                </InlineStack>
              </InlineStack>

              {dnaLoading && <div style={{ textAlign: 'center', padding: 20 }}><Spinner /></div>}

              {dna && (
                <div style={{ animation: 'fadeIn 0.5s ease' }}>
                  <DescriptionList items={[
                    { term: 'Brand Vibe', description: dna.brandVibe || 'Not analyzed' },
                    { term: 'Domain', description: dna.domain },
                    { term: 'Niche Keywords', description: (dna.nicheKeywords || []).join(', ') },
                    { term: 'Audience', description: (dna.audienceSegments || []).join(', ') },
                    { term: 'Tone', description: (dna.toneAttributes || []).join(', ') },
                    { term: 'Price Position', description: dna.pricePositioning },
                    { term: 'Catalog Gaps', description: (dna.catalogGaps || []).join(', ') },
                    { term: 'Catalog Strengths', description: (dna.catalogStrengths || []).join(', ') },
                  ]} />
                </div>
              )}

              {!dna && !dnaLoading && (
                <BlockStack gap="200">
                  <Text as="p" tone="subdued">No store DNA yet. Complete onboarding or click Re-Analyze.</Text>
                  <Button variant="primary" onClick={handleAnalyzeStore} loading={analyzing}>Analyze My Store</Button>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </FadeIn>

        {/* ── Domain Intent Engine ────────────── */}
        <FadeIn delay={200}>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">Domain Intent Engine</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Your domain name carries meaning. FlexHunter analyzes it to understand your brand's vibe,
                  target audience, and product fit. Add competitor or alternative domains to compare how
                  they score against different products.
                </Text>
              </BlockStack>

              {/* Add domain */}
              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField label="" labelHidden value={domainInput} onChange={setDomainInput}
                    placeholder="Enter a domain to analyze (e.g., coolstuff.co)" autoComplete="off" />
                </div>
                <Button onClick={addDomain} disabled={!domainInput.trim()}>Add & Analyze</Button>
              </InlineStack>

              {/* Domain chips */}
              {savedDomains.length > 0 && (
                <InlineStack gap="200" wrap>
                  {savedDomains.map(d => (
                    <div key={d} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 12px', borderRadius: 20, background: '#F0F5FF',
                      border: '1px solid #B4D5FE', fontSize: 13, cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}>
                      <span onClick={() => handlePreviewDomain(d)} style={{ fontWeight: 500 }}>{d}</span>
                      <span onClick={() => removeDomain(d)} style={{ color: '#D72C0D', fontWeight: 700, marginLeft: 4, cursor: 'pointer' }}>x</span>
                    </div>
                  ))}
                </InlineStack>
              )}

              {/* Domain analysis result */}
              {domainPreview && (
                <FadeIn>
                  <div style={{ padding: 16, background: '#FAFBFC', borderRadius: 10, border: '1px solid #E4E5E7' }}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text as="h3" variant="headingSm">{domainPreview.domain}</Text>
                        <Badge tone="info">Analyzed</Badge>
                      </InlineStack>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div><Text as="p" variant="bodySm" tone="subdued">Words</Text><Text as="p" variant="bodySm" fontWeight="semibold">{domainPreview.extractedWords?.join(', ')}</Text></div>
                        <div><Text as="p" variant="bodySm" tone="subdued">Slang</Text><Text as="p" variant="bodySm" fontWeight="semibold">{domainPreview.detectedSlang?.join(', ') || 'None'}</Text></div>
                        <div><Text as="p" variant="bodySm" tone="subdued">Age Group</Text><Text as="p" variant="bodySm" fontWeight="semibold">{domainPreview.inferredAgeGroup || 'General'}</Text></div>
                        <div><Text as="p" variant="bodySm" tone="subdued">Tone</Text><Text as="p" variant="bodySm" fontWeight="semibold">{domainPreview.inferredTone?.join(', ') || 'Neutral'}</Text></div>
                        <div><Text as="p" variant="bodySm" tone="subdued">Category Bias</Text><Text as="p" variant="bodySm" fontWeight="semibold">{domainPreview.categoryBias?.join(', ') || 'None'}</Text></div>
                        <div><Text as="p" variant="bodySm" tone="subdued">Psychographic</Text><Text as="p" variant="bodySm" fontWeight="semibold">{domainPreview.psychographicHints?.join(', ') || 'None'}</Text></div>
                      </div>
                      {domainPreview.vibeScore && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {Object.entries(domainPreview.vibeScore).map(([key, val]) => {
                            const v = val as number;
                            const color = v >= 60 ? '#008060' : v >= 40 ? '#B98900' : '#8C9196';
                            return (
                              <div key={key} style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 12,
                                background: v >= 60 ? '#F1F8F5' : v >= 40 ? '#FFF8E6' : '#F6F6F7',
                                border: `1px solid ${color}20`, fontWeight: 600, color,
                              }}>
                                {key}: {v}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </BlockStack>
                  </div>
                </FadeIn>
              )}
            </BlockStack>
          </Card>
        </FadeIn>

        {/* ── Connected Suppliers ─────────────── */}
        <FadeIn delay={300}>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">Product Sources & Trend Signals</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  FlexHunter aggregates products and trends from multiple platforms.
                  Active sources are searched during research. Request new sources below.
                </Text>
              </BlockStack>

              <InlineGrid columns={3} gap="300">
                {[
                  { name: 'AliExpress', icon: '🛒', type: 'Supplier', desc: 'Real-time product search via API.' },
                  { name: 'CJ Dropshipping', icon: '📦', type: 'Supplier', desc: 'Fast US/EU shipping. Live API.' },
                  { name: 'Zendrop', icon: '🚀', type: 'Supplier', desc: 'US warehouses. Quality focused.' },
                  { name: 'Spocket', icon: '💎', type: 'Supplier', desc: 'Premium US/EU suppliers.' },
                  { name: 'Alibaba', icon: '🏭', type: 'Supplier', desc: 'Wholesale & bulk research.' },
                  { name: 'Temu Trends', icon: '🔥', type: 'Trends', desc: 'Trending product signals.' },
                  { name: 'TikTok Trends', icon: '📱', type: 'Trends', desc: 'Viral product signals.' },
                  { name: 'Amazon Trends', icon: '📊', type: 'Trends', desc: 'Bestseller & movers signals.' },
                ].map((s, i) => (
                  <FadeIn key={s.name} delay={350 + i * 50}>
                    <div style={{
                      padding: '14px 16px', borderRadius: 10,
                      border: '1px solid #E4E5E7', background: 'white',
                      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                    >
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <span style={{ fontSize: 20 }}>{s.icon}</span>
                            <Text as="span" variant="bodySm" fontWeight="bold">{s.name}</Text>
                          </InlineStack>
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone={supplierLive[s.name] ? 'success' : 'info'}>{supplierLive[s.name] ? 'LIVE' : 'Mock'}</Badge>
                            <div
                              onClick={() => toggleSupplier(s.name)}
                              style={{
                                width: 38, height: 20, borderRadius: 10, cursor: 'pointer',
                                background: supplierStates[s.name] !== false ? '#008060' : '#D0D5DD',
                                position: 'relative', transition: 'background 0.2s ease',
                              }}
                            >
                              <div style={{
                                width: 16, height: 16, borderRadius: '50%', background: 'white',
                                position: 'absolute', top: 2,
                                left: supplierStates[s.name] !== false ? 20 : 2,
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              }} />
                            </div>
                          </InlineStack>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">{s.desc}</Text>
                        <Badge>{s.type}</Badge>
                      </BlockStack>
                    </div>
                  </FadeIn>
                ))}
              </InlineGrid>
            </BlockStack>
          </Card>
        </FadeIn>

        {/* ── Request a Provider ──────────────── */}
        <FadeIn delay={600}>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Request a New Source</Text>
              <Text as="p" tone="subdued">
                Want a specific supplier or marketplace integrated? Let us know.
              </Text>
              <ProviderRequestForm />
            </BlockStack>
          </Card>
        </FadeIn>

        {/* ── How It Works ────────────────────── */}
        <FadeIn delay={700}>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">How Research Works</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { step: '01', title: 'Store Context', desc: 'Loads your DNA, domain, and settings', color: '#5C6AC4' },
                  { step: '02', title: 'Product Fetch', desc: 'Searches all active providers', color: '#007ACE' },
                  { step: '03', title: 'Normalize', desc: 'Standardizes multi-source data', color: '#9C6ADE' },
                  { step: '04', title: '11-D Scoring', desc: 'Domain, audience, trend, margin fit', color: '#008060' },
                  { step: '05', title: 'AI Enrich', desc: 'Visual virality & novelty analysis', color: '#B98900' },
                  { step: '06', title: 'Rank & Save', desc: 'Top candidates saved for review', color: '#D72C0D' },
                ].map((s, i) => (
                  <FadeIn key={s.step} delay={750 + i * 80}>
                    <div style={{
                      padding: '14px 16px', borderRadius: 10, borderLeft: `4px solid ${s.color}`,
                      background: '#FAFBFC',
                    }}>
                      <Text as="p" variant="bodySm" tone="subdued">STEP {s.step}</Text>
                      <Text as="p" variant="bodyMd" fontWeight="bold">{s.title}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">{s.desc}</Text>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </BlockStack>
          </Card>
        </FadeIn>

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}

function ProviderRequestForm() {
  const [provider, setProvider] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    try {
      await apiFetch('/provider-request', { method: 'POST', body: JSON.stringify({ provider, details }) });
    } catch {}
    setSubmitted(true);
    setProvider('');
    setDetails('');
  };

  if (submitted) {
    return <Banner tone="success" onDismiss={() => setSubmitted(false)}><Text as="p">Request submitted! We'll review it.</Text></Banner>;
  }

  return (
    <BlockStack gap="300">
      <TextField label="Provider Name" value={provider} onChange={setProvider}
        placeholder="e.g., DSers, Oberlo, AutoDS, Doba..." autoComplete="off" />
      <TextField label="Why? (optional)" value={details} onChange={setDetails}
        placeholder="Better shipping, niche products..." multiline={2} autoComplete="off" />
      <Button variant="primary" onClick={handleSubmit} disabled={!provider.trim()}>Submit Request</Button>
    </BlockStack>
  );
}
