import React, { useEffect, useState, useCallback } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  TextField, Banner, Spinner, DescriptionList, Divider,
  InlineGrid, Modal,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi, apiFetch } from '../hooks/useApi';

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  return <div style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.4s ease' }}>{children}</div>;
}

const GLOW_CSS = `
@keyframes dnaPulse { 0%,100% { box-shadow: 0 0 10px rgba(92,106,196,0.3); } 50% { box-shadow: 0 0 25px rgba(92,106,196,0.6); } }
@keyframes dnaOrbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes dotBlink { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`;

// ── AI Analysis Animation ──────────────────────
function AIAnalysisOverlay({ stage, progress }: { stage: string; progress: number }) {
  return (
    <FadeIn>
      <Card>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
          {/* Animated background */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            background: 'linear-gradient(135deg, #5C6AC4 0%, #8B5CF6 50%, #007ACE 100%)',
            backgroundSize: '400% 400%', animation: 'shimmer 3s ease infinite',
          }} />

          <BlockStack gap="400">
            {/* DNA Helix Animation */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
              <div style={{
                width: 70, height: 70, borderRadius: '50%', position: 'relative',
                background: 'linear-gradient(135deg, #5C6AC4, #8B5CF6)',
                animation: 'dnaPulse 2s ease-in-out infinite',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)',
                  animation: 'dnaOrbit 2s linear infinite', position: 'absolute',
                }} />
                <span style={{ fontSize: 28, zIndex: 1 }}>🧬</span>
              </div>
            </div>

            <BlockStack gap="100" align="center">
              <Text as="h2" variant="headingMd" alignment="center">AI is Analyzing Your Store</Text>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                Building your store's unique DNA profile with artificial intelligence...
              </Text>
            </BlockStack>

            {/* Progress Bar */}
            <div style={{ height: 10, borderRadius: 5, background: '#E4E5E7', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 5,
                background: progress >= 100
                  ? 'linear-gradient(90deg, #008060, #00B386)'
                  : 'linear-gradient(90deg, #5C6AC4, #8B5CF6, #007ACE, #5C6AC4)',
                backgroundSize: '300% 100%', animation: progress < 100 ? 'shimmer 1.5s linear infinite' : 'none',
                width: `${progress}%`, transition: 'width 0.5s ease',
              }} />
            </div>

            {/* Stage Display */}
            <InlineStack align="space-between">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5C6AC4', animation: 'dotBlink 1s ease-in-out infinite' }} />
                <Text as="p" variant="bodySm" tone="subdued">{stage}</Text>
              </div>
              <Text as="p" variant="bodySm" fontWeight="bold">{Math.round(progress)}%</Text>
            </InlineStack>
          </BlockStack>
        </div>
      </Card>
    </FadeIn>
  );
}

// ── Editable DNA Field ────────────────────────
function DNAField({ label, icon, color, value, onSave, type = 'text', helpText }: {
  label: string; icon: string; color: string; value: string; onSave: (v: string) => void;
  type?: 'text' | 'tags' | 'textarea'; helpText?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const save = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  return (
    <div style={{
      padding: '14px 18px', borderRadius: 12, border: `1px solid ${color}30`,
      background: `${color}08`, transition: 'all 0.2s ease',
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = `${color}60`)}
    onMouseLeave={e => (e.currentTarget.style.borderColor = `${color}30`)}
    >
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <span style={{ fontSize: 16 }}>{icon}</span>
            <Text as="span" variant="bodySm" fontWeight="bold" tone="subdued">{label}</Text>
          </InlineStack>
          {!editing && (
            <button onClick={() => setEditing(true)} style={{
              all: 'unset', cursor: 'pointer', fontSize: 11, color: color,
              fontWeight: 600, padding: '2px 8px', borderRadius: 4,
              border: `1px solid ${color}40`, transition: 'all 0.15s ease',
            }}>Edit</button>
          )}
        </InlineStack>

        {editing ? (
          <BlockStack gap="200">
            {type === 'textarea' ? (
              <TextField label="" labelHidden value={draft} onChange={setDraft} multiline={3} autoComplete="off" />
            ) : (
              <TextField label="" labelHidden value={draft} onChange={setDraft} autoComplete="off"
                helpText={helpText || (type === 'tags' ? 'Comma separated values' : undefined)} />
            )}
            <InlineStack gap="200">
              <Button size="micro" variant="primary" onClick={save}>Save</Button>
              <Button size="micro" onClick={cancel}>Cancel</Button>
            </InlineStack>
          </BlockStack>
        ) : (
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {value || <span style={{ color: '#8C9196', fontStyle: 'italic' }}>Not set — click Edit</span>}
          </Text>
        )}
      </BlockStack>
    </div>
  );
}

// ── Main Page ─────────────────────────────────
export function ResearchPage() {
  const navigate = useNavigate();
  const { data: dna, get: getDna, loading: dnaLoading } = useApi<any>();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeStage, setAnalyzeStage] = useState('');
  const [domainPreview, setDomainPreview] = useState<any>(null);
  const [domainInput, setDomainInput] = useState('');
  const [savedDomains, setSavedDomains] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [shopConnected, setShopConnected] = useState<boolean | null>(null);

  useEffect(() => {
    getDna('/store-dna');
    apiFetch<any>('/shop-status').then(r => setShopConnected(r.data?.hasToken || false)).catch(() => {});
    const saved = localStorage.getItem('fh_domains');
    if (saved) setSavedDomains(JSON.parse(saved));
  }, [getDna]);

  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 4000); return () => clearTimeout(t); }
  }, [message]);

  const handleAnalyzeStore = async () => {
    setAnalyzing(true);
    setAnalyzeProgress(0);
    setAnalyzeStage('Connecting to your store...');

    const stages = [
      { at: 8, text: '🔍 Reading store configuration...' },
      { at: 18, text: '🧬 Extracting domain intent signals...' },
      { at: 30, text: '🤖 AI analyzing brand personality...' },
      { at: 42, text: '👥 Mapping target audience segments...' },
      { at: 55, text: '📊 Evaluating category fit & gaps...' },
      { at: 68, text: '💡 Generating niche keyword clusters...' },
      { at: 80, text: '🎯 Computing price positioning strategy...' },
      { at: 90, text: '✨ Finalizing store DNA profile...' },
      { at: 97, text: '💾 Saving results...' },
    ];

    let prog = 0;
    const interval = setInterval(() => {
      prog += Math.random() * 2.5 + 0.8;
      if (prog > 97) prog = 97;
      setAnalyzeProgress(prog);
      const stage = [...stages].reverse().find(s => prog >= s.at);
      if (stage) setAnalyzeStage(stage.text);
    }, 400);

    try {
      await apiFetch('/store-dna/analyze', { method: 'POST' });
      clearInterval(interval);
      setAnalyzeProgress(100);
      setAnalyzeStage('✅ Store DNA analysis complete!');
      await getDna('/store-dna');
      setMessage('Store DNA updated successfully!');
      setTimeout(() => { setAnalyzing(false); setAnalyzeProgress(0); }, 1800);
    } catch (err: any) {
      clearInterval(interval);
      setAnalyzing(false);
      setAnalyzeProgress(0);
      setMessage('Analysis failed: ' + err.message);
    }
  };

  const handleSaveDNAField = async (key: string, value: string) => {
    // For array fields, split by comma
    const arrayFields = ['nicheKeywords', 'audienceSegments', 'toneAttributes', 'catalogGaps', 'catalogStrengths', 'topCategories'];
    const data: any = {};
    if (arrayFields.includes(key)) {
      data[key] = value.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      data[key] = value;
    }

    try {
      await apiFetch('/store-dna', { method: 'PUT', body: JSON.stringify(data) });
      await getDna('/store-dna');
      setMessage(`${key} updated!`);
    } catch (err: any) {
      setMessage(`Failed to save: ${err.message}`);
    }
  };

  const handlePreviewDomain = async (domain: string) => {
    try {
      const result = await apiFetch<any>('/domain/analyze', { method: 'POST', body: JSON.stringify({ domain }) });
      setDomainPreview(result.data);
    } catch {}
  };

  const addDomain = () => {
    if (domainInput.trim() && !savedDomains.includes(domainInput.trim())) {
      const updated = [...savedDomains, domainInput.trim()];
      setSavedDomains(updated);
      localStorage.setItem('fh_domains', JSON.stringify(updated));
      handlePreviewDomain(domainInput.trim());
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
    <Page title="Store DNA" subtitle="Your store's unique identity drives AI-powered product discovery">
      <style>{GLOW_CSS}</style>
      <BlockStack gap="500">
        {message && (
          <FadeIn>
            <Banner tone={message.includes('fail') || message.includes('Error') ? 'critical' : 'success'} onDismiss={() => setMessage(null)}>
              <Text as="p">{message}</Text>
            </Banner>
          </FadeIn>
        )}

        {/* Connection Status */}
        {shopConnected !== null && (
          <FadeIn>
            <InlineStack gap="200">
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: shopConnected ? '#008060' : '#D72C0D',
                boxShadow: shopConnected ? '0 0 6px #008060' : '0 0 6px #D72C0D',
              }} />
              <Text as="span" variant="bodySm" tone={shopConnected ? 'success' : 'critical'}>
                {shopConnected ? 'Shopify Connected' : 'Shopify Not Connected — go to Settings'}
              </Text>
            </InlineStack>
          </FadeIn>
        )}

        {/* AI Analysis Animation */}
        {analyzing && <AIAnalysisOverlay stage={analyzeStage} progress={analyzeProgress} />}

        {/* ── Store DNA Profile ─────────────── */}
        <FadeIn delay={100}>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <div style={{
                    width: 42, height: 42, borderRadius: 10,
                    background: 'linear-gradient(135deg, #5C6AC4, #8B5CF6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(92,106,196,0.3)',
                  }}>
                    <span style={{ fontSize: 22 }}>🧬</span>
                  </div>
                  <BlockStack gap="0">
                    <Text as="h2" variant="headingMd">Store DNA Profile</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Click any field to edit · AI uses this to find your perfect products</Text>
                  </BlockStack>
                </InlineStack>
                <InlineStack gap="200">
                  {dna && <Badge tone="success">Analyzed</Badge>}
                  <Button variant="primary" onClick={handleAnalyzeStore} loading={analyzing} disabled={analyzing}>
                    {dna ? '🤖 Re-Analyze with AI' : '🤖 Analyze My Store'}
                  </Button>
                </InlineStack>
              </InlineStack>

              {dnaLoading && <div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div>}

              {dna && !analyzing && (
                <FadeIn delay={150}>
                  <InlineGrid columns={2} gap="300">
                    <DNAField label="Brand Vibe" icon="✨" color="#5C6AC4" value={dna.brandVibe || ''} onSave={v => handleSaveDNAField('brandVibe', v)} />
                    <DNAField label="Domain" icon="🌐" color="#007ACE" value={dna.domain || ''} onSave={v => handleSaveDNAField('domain', v)} />
                    <DNAField label="Description" icon="📝" color="#9C6ADE" value={dna.description || ''} onSave={v => handleSaveDNAField('description', v)} type="textarea" />
                    <DNAField label="Price Positioning" icon="💰" color="#008060" value={dna.pricePositioning || ''} onSave={v => handleSaveDNAField('pricePositioning', v)} helpText="e.g. budget, mid, premium" />
                    <DNAField label="Niche Keywords" icon="🔑" color="#B98900" value={(dna.nicheKeywords || []).join(', ')} onSave={v => handleSaveDNAField('nicheKeywords', v)} type="tags" />
                    <DNAField label="Target Audience" icon="👥" color="#D72C0D" value={(dna.audienceSegments || []).join(', ')} onSave={v => handleSaveDNAField('audienceSegments', v)} type="tags" />
                    <DNAField label="Tone & Style" icon="🎨" color="#9C6ADE" value={(dna.toneAttributes || []).join(', ')} onSave={v => handleSaveDNAField('toneAttributes', v)} type="tags" />
                    <DNAField label="Top Categories" icon="📦" color="#007ACE" value={(dna.topCategories || []).join(', ')} onSave={v => handleSaveDNAField('topCategories', v)} type="tags" />
                    <DNAField label="Catalog Strengths" icon="💪" color="#008060" value={(dna.catalogStrengths || []).join(', ')} onSave={v => handleSaveDNAField('catalogStrengths', v)} type="tags" />
                    <DNAField label="Catalog Gaps" icon="🔍" color="#DE6E1E" value={(dna.catalogGaps || []).join(', ')} onSave={v => handleSaveDNAField('catalogGaps', v)} type="tags" />
                  </InlineGrid>
                </FadeIn>
              )}

              {!dna && !dnaLoading && !analyzing && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <BlockStack gap="300" align="center">
                    <div style={{ fontSize: 48, opacity: 0.5 }}>🧬</div>
                    <Text as="h3" variant="headingMd">No Store DNA Yet</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Complete onboarding first, then click Analyze to build your store's DNA profile.</Text>
                    <Button variant="primary" size="large" onClick={handleAnalyzeStore}>🤖 Analyze My Store</Button>
                  </BlockStack>
                </div>
              )}
            </BlockStack>
          </Card>
        </FadeIn>

        {/* ── Domain Intent Engine ─────────── */}
        <FadeIn delay={250}>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="300" blockAlign="center">
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: 'linear-gradient(135deg, #007ACE, #00B4D8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,122,206,0.3)',
                }}>
                  <span style={{ fontSize: 22 }}>🔗</span>
                </div>
                <BlockStack gap="0">
                  <Text as="h2" variant="headingMd">Domain Intent Engine</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Analyze any domain to understand its brand signals and audience fit
                  </Text>
                </BlockStack>
              </InlineStack>

              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField label="" labelHidden value={domainInput} onChange={setDomainInput}
                    placeholder="Enter a domain (e.g., coolstuff.co)" autoComplete="off" />
                </div>
                <Button variant="primary" onClick={addDomain} disabled={!domainInput.trim()}>Analyze</Button>
              </InlineStack>

              {savedDomains.length > 0 && (
                <InlineStack gap="200" wrap>
                  {savedDomains.map(d => (
                    <div key={d} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '5px 14px', borderRadius: 20,
                      background: 'linear-gradient(135deg, #F0F5FF, #E8F0FE)',
                      border: '1px solid #B4D5FE', fontSize: 13, cursor: 'pointer',
                      transition: 'all 0.2s ease', fontWeight: 500,
                    }}>
                      <span onClick={() => handlePreviewDomain(d)}>{d}</span>
                      <span onClick={() => removeDomain(d)} style={{ color: '#D72C0D', fontWeight: 700, marginLeft: 4, cursor: 'pointer', fontSize: 14 }}>×</span>
                    </div>
                  ))}
                </InlineStack>
              )}

              {domainPreview && (
                <FadeIn>
                  <div style={{
                    padding: 18, borderRadius: 12,
                    background: 'linear-gradient(135deg, #FAFBFC 0%, #F0F5FF 100%)',
                    border: '1px solid #B4D5FE',
                  }}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text as="h3" variant="headingSm">{domainPreview.domain}</Text>
                        <Badge tone="info">Analyzed</Badge>
                      </InlineStack>
                      <InlineGrid columns={3} gap="300">
                        {[
                          { label: 'Words', value: domainPreview.extractedWords?.join(', '), icon: '📖', color: '#5C6AC4' },
                          { label: 'Slang', value: domainPreview.detectedSlang?.join(', ') || 'None', icon: '🗣️', color: '#9C6ADE' },
                          { label: 'Age Group', value: domainPreview.inferredAgeGroup || 'General', icon: '👤', color: '#007ACE' },
                          { label: 'Tone', value: domainPreview.inferredTone?.join(', ') || 'Neutral', icon: '🎨', color: '#B98900' },
                          { label: 'Category Bias', value: domainPreview.categoryBias?.join(', ') || 'None', icon: '📦', color: '#008060' },
                          { label: 'Psychographic', value: domainPreview.psychographicHints?.join(', ') || 'None', icon: '🧠', color: '#D72C0D' },
                        ].map(f => (
                          <div key={f.label} style={{ padding: '8px 12px', borderRadius: 8, background: `${f.color}08`, border: `1px solid ${f.color}20` }}>
                            <Text as="p" variant="bodySm" tone="subdued">{f.icon} {f.label}</Text>
                            <Text as="p" variant="bodySm" fontWeight="semibold">{f.value}</Text>
                          </div>
                        ))}
                      </InlineGrid>
                      {domainPreview.vibeScore && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {Object.entries(domainPreview.vibeScore).map(([key, val]) => {
                            const v = val as number;
                            const color = v >= 60 ? '#008060' : v >= 40 ? '#B98900' : '#8C9196';
                            return (
                              <div key={key} style={{
                                padding: '3px 10px', borderRadius: 20, fontSize: 12,
                                background: v >= 60 ? '#E3F9ED' : v >= 40 ? '#FFF8E6' : '#F6F6F7',
                                border: `1px solid ${color}30`, fontWeight: 600, color,
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

        {/* ── How DNA Powers Research ──────── */}
        <FadeIn delay={350}>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="300" blockAlign="center">
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: 'linear-gradient(135deg, #008060, #00B386)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,128,96,0.3)',
                }}>
                  <span style={{ fontSize: 22 }}>⚡</span>
                </div>
                <BlockStack gap="0">
                  <Text as="h2" variant="headingMd">How Your DNA Powers Research</Text>
                  <Text as="p" variant="bodySm" tone="subdued">When you run research from Candidates, here's what happens</Text>
                </BlockStack>
              </InlineStack>

              <InlineGrid columns={3} gap="300">
                {[
                  { step: '01', title: 'AI Keywords', desc: 'GPT generates targeted search queries from your DNA', color: '#5C6AC4', icon: '🤖' },
                  { step: '02', title: 'Multi-Source Fetch', desc: 'Searches 8 suppliers & trend platforms simultaneously', color: '#007ACE', icon: '🌐' },
                  { step: '03', title: 'AI Curation', desc: 'GPT selects the best 20 products for your store', color: '#9C6ADE', icon: '🎯' },
                  { step: '04', title: 'Deep Scoring', desc: 'Each product scored on 11 dimensions + AI analysis', color: '#008060', icon: '📊' },
                  { step: '05', title: 'Blend & Rank', desc: '50% AI + 50% algorithm for final ranking', color: '#B98900', icon: '⚖️' },
                  { step: '06', title: 'Ready to Import', desc: 'Top candidates saved with full explanations', color: '#D72C0D', icon: '🏆' },
                ].map((s, i) => (
                  <FadeIn key={s.step} delay={400 + i * 60}>
                    <div style={{
                      padding: '16px 18px', borderRadius: 12, position: 'relative',
                      background: `${s.color}06`, border: `1px solid ${s.color}20`,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${s.color}20`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      <div style={{
                        position: 'absolute', top: -10, left: 14, padding: '2px 8px',
                        borderRadius: 10, background: s.color, color: 'white',
                        fontSize: 10, fontWeight: 700, letterSpacing: 1,
                      }}>STEP {s.step}</div>
                      <div style={{ marginTop: 6 }}>
                        <Text as="p" variant="bodyMd" fontWeight="bold">{s.icon} {s.title}</Text>
                        <Text as="p" variant="bodySm" tone="subdued">{s.desc}</Text>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </InlineGrid>

              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                <Button variant="primary" size="large" onClick={() => navigate('/candidates')}>
                  Go to Candidates to Run Research →
                </Button>
              </div>
            </BlockStack>
          </Card>
        </FadeIn>

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
