import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Button, Banner, Spinner,
  InlineStack, Badge, Divider, DescriptionList, TextField,
  InlineGrid, Modal, ProgressBar,
} from '@shopify/polaris';
import { useApi, apiFetch } from '../hooks/useApi';

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
  const { data: dna, get: getDna, loading: dnaLoading } = useApi<any>();
  const { data: status, get: getStatus } = useApi<any>();
  const { post: startResearch, loading: researchLoading } = useApi();
  const [analyzing, setAnalyzing] = useState(false);
  const [domainPreview, setDomainPreview] = useState<any>(null);
  const [domainInput, setDomainInput] = useState('');
  const [savedDomains, setSavedDomains] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [supplierStates, setSupplierStates] = useState<Record<string, boolean>>({});

  const toggleSupplier = async (name: string) => {
    const newState = supplierStates[name] === false ? true : false;
    setSupplierStates(prev => ({ ...prev, [name]: !newState ? false : true }));
    try { await apiFetch('/suppliers/toggle', { method: 'POST', body: JSON.stringify({ name, enabled: !newState ? false : true }) }); } catch {}
  };

  useEffect(() => {
    getDna('/store-dna');
    getStatus('/research/status');
    // Load saved domains from localStorage
    const saved = localStorage.getItem('fh_domains');
    if (saved) setSavedDomains(JSON.parse(saved));
  }, [getDna, getStatus]);

  const handleStartResearch = async () => {
    await startResearch('/research/start');
    setTimeout(() => getStatus('/research/status'), 1000);
  };

  const handleAnalyzeStore = async () => {
    setAnalyzing(true);
    try {
      await apiFetch('/store-dna/analyze', { method: 'POST' });
      setMessage('Store analysis started! Refreshing...');
      setTimeout(async () => {
        await getDna('/store-dna');
        setAnalyzing(false);
        setMessage('Store DNA updated.');
      }, 3000);
    } catch (err: any) {
      setMessage('Analysis failed: ' + err.message);
      setAnalyzing(false);
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
      primaryAction={{ content: 'Start Research', onAction: handleStartResearch, loading: researchLoading }}
      secondaryActions={[{ content: 'Re-Analyze Store', onAction: handleAnalyzeStore, loading: analyzing }]}
    >
      <BlockStack gap="500">
        {message && <Banner tone="success" onDismiss={() => setMessage(null)}><Text as="p">{message}</Text></Banner>}

        {status && status.status === 'RUNNING' && (
          <Banner title="Research in Progress" tone="info">
            <InlineStack gap="200" blockAlign="center">
              <Spinner size="small" />
              <Text as="p">Pipeline running. Results will appear in Candidates.</Text>
            </InlineStack>
          </Banner>
        )}

        {status && status.status === 'COMPLETED' && (
          <FadeIn>
            <Banner title="Last Research Complete" tone="success">
              <Text as="p">
                Completed at {new Date(status.completedAt).toLocaleString()}.
                {status.result?.totalSaved && ` Found ${status.result.totalSaved} new candidates.`}
              </Text>
            </Banner>
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
                  { name: 'AliExpress', icon: '🛒', status: 'Active', tone: 'success' as const, type: 'Supplier', desc: 'Mock catalog (V1). Real API in V2.' },
                  { name: 'CJ Dropshipping', icon: '📦', status: 'Ready', tone: 'info' as const, type: 'Supplier', desc: 'Fast US/EU shipping. API key required.' },
                  { name: 'Zendrop', icon: '🚀', status: 'Ready', tone: 'info' as const, type: 'Supplier', desc: 'US warehouses. API key required.' },
                  { name: 'Spocket', icon: '💎', status: 'Ready', tone: 'info' as const, type: 'Supplier', desc: 'Premium suppliers. API key required.' },
                  { name: 'Alibaba', icon: '🏭', status: 'Ready', tone: 'info' as const, type: 'Supplier', desc: 'Wholesale research. API key required.' },
                  { name: 'Temu Trends', icon: '🔥', status: 'Active', tone: 'success' as const, type: 'Trends', desc: 'Trending product signals.' },
                  { name: 'TikTok Trends', icon: '📱', status: 'Active', tone: 'success' as const, type: 'Trends', desc: 'Viral product signals.' },
                  { name: 'Amazon Trends', icon: '📊', status: 'Active', tone: 'success' as const, type: 'Trends', desc: 'Bestseller & movers signals.' },
                  { name: 'Shopify Signals', icon: '🏪', status: 'Active', tone: 'success' as const, type: 'Trends', desc: 'Competitor & market signals.' },
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
                            <Badge tone={s.tone}>{s.status}</Badge>
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
