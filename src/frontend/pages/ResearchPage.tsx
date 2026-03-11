import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  TextField, Banner, Spinner, Divider, InlineGrid, Modal,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi, apiFetch } from '../hooks/useApi';

const GLOW = `
@keyframes dnaPulse { 0%,100% { box-shadow: 0 0 10px rgba(92,106,196,0.3); } 50% { box-shadow: 0 0 25px rgba(92,106,196,0.6); } }
@keyframes orbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes dotBlink { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`;

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  return <div style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.4s ease' }}>{children}</div>;
}

export function ResearchPage() {
  const navigate = useNavigate();
  const { data: dna, get: getDna, loading: dnaLoading } = useApi<any>();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeStage, setAnalyzeStage] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Simple 3-field form
  const [storeDesc, setStoreDesc] = useState('');
  const [audience, setAudience] = useState('');
  const [priceRange, setPriceRange] = useState('$10-$50');
  const [aiSuggesting, setAiSuggesting] = useState(false);

  useEffect(() => { getDna('/store-dna'); }, [getDna]);

  // Pre-fill from existing DNA
  useEffect(() => {
    if (dna) {
      if (dna.description) setStoreDesc(dna.description);
      if (dna.audienceSegments?.length) setAudience(dna.audienceSegments.join(', '));
      if (dna.pricePositioning) {
        const p = dna.pricePositioning;
        setPriceRange(p === 'budget' ? '$5-$25' : p === 'mid' ? '$10-$50' : p === 'premium' ? '$30-$100' : '$10-$50');
      }
    }
  }, [dna]);

  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 5000); return () => clearTimeout(t); }
  }, [message]);

  // AI helps user describe their store
  const handleAiSuggest = async () => {
    if (!storeDesc.trim()) { setMessage('Please describe your store first, even briefly.'); return; }
    setAiSuggesting(true);
    try {
      const result = await apiFetch<any>('/store-dna/ai-suggest', {
        method: 'POST',
        body: JSON.stringify({ description: storeDesc, audience, priceRange }),
      });
      if (result.data) {
        if (result.data.description) setStoreDesc(result.data.description);
        if (result.data.audience) setAudience(result.data.audience);
        if (result.data.priceRange) setPriceRange(result.data.priceRange);
        setMessage('AI enhanced your store profile!');
      }
    } catch (e: any) {
      setMessage(`AI suggestion failed: ${e.message}`);
    }
    setAiSuggesting(false);
  };

  // Save and analyze
  const handleSaveAndAnalyze = async () => {
    if (!storeDesc.trim()) { setMessage('Please describe what your store sells.'); return; }

    setAnalyzing(true);
    setAnalyzeProgress(0);
    setAnalyzeStage('Saving your store profile...');

    const stages = [
      { at: 5, text: '💾 Saving store profile...' },
      { at: 15, text: '🧬 AI analyzing your store niche...' },
      { at: 30, text: '🎯 Identifying target audience segments...' },
      { at: 45, text: '🔑 Generating niche keywords...' },
      { at: 60, text: '📊 Mapping catalog opportunities...' },
      { at: 75, text: '✨ Building brand personality profile...' },
      { at: 88, text: '🏪 Finalizing store DNA...' },
      { at: 97, text: '✅ Almost done...' },
    ];

    let prog = 0;
    const interval = setInterval(() => {
      prog += Math.random() * 3 + 1;
      if (prog > 97) prog = 97;
      setAnalyzeProgress(prog);
      const stage = [...stages].reverse().find(s => prog >= s.at);
      if (stage) setAnalyzeStage(stage.text);
    }, 400);

    try {
      // Save the simple fields first
      const priceMin = parseInt(priceRange.split('-')[0].replace(/\D/g, '')) || 10;
      const priceMax = parseInt(priceRange.split('-')[1]?.replace(/\D/g, '')) || 50;

      await apiFetch('/store-dna/simple-save', {
        method: 'POST',
        body: JSON.stringify({
          description: storeDesc,
          audience: audience,
          priceMin,
          priceMax,
        }),
      });

      // Then run AI analysis
      await apiFetch('/store-dna/analyze', { method: 'POST' });

      clearInterval(interval);
      setAnalyzeProgress(100);
      setAnalyzeStage('✅ Store DNA complete!');
      await getDna('/store-dna');
      setMessage('Store DNA built! Go to Research to find products.');
      setTimeout(() => { setAnalyzing(false); setAnalyzeProgress(0); }, 1800);
    } catch (err: any) {
      clearInterval(interval);
      setAnalyzing(false);
      setAnalyzeProgress(0);
      setMessage('Failed: ' + err.message);
    }
  };

  const hasDNA = dna && dna.brandVibe;

  return (
    <Page title="Store DNA" subtitle="Tell AI about your store — it handles the rest">
      <style>{GLOW}</style>
      <BlockStack gap="500">
        {message && (
          <FadeIn>
            <Banner tone={message.includes('fail') || message.includes('Failed') ? 'critical' : 'success'} onDismiss={() => setMessage(null)}>
              <Text as="p">{message}</Text>
            </Banner>
          </FadeIn>
        )}

        {/* AI Analysis Animation */}
        {analyzing && (
          <FadeIn>
            <Card>
              <div style={{ padding: '20px 0' }}>
                <BlockStack gap="400">
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      width: 70, height: 70, borderRadius: '50%', position: 'relative',
                      background: 'linear-gradient(135deg, #5C6AC4, #8B5CF6)',
                      animation: 'dnaPulse 2s ease-in-out infinite',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '2px dashed rgba(92,106,196,0.4)', animation: 'orbit 3s linear infinite' }} />
                      <span style={{ fontSize: 28, zIndex: 1 }}>🧬</span>
                    </div>
                  </div>
                  <Text as="h2" variant="headingMd" alignment="center">AI is Building Your Store DNA</Text>
                  <div style={{ height: 10, borderRadius: 5, background: '#E4E5E7', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 5,
                      background: analyzeProgress >= 100 ? 'linear-gradient(90deg, #008060, #00B386)' : 'linear-gradient(90deg, #5C6AC4, #8B5CF6, #007ACE, #5C6AC4)',
                      backgroundSize: '300% 100%', animation: analyzeProgress < 100 ? 'shimmer 1.5s linear infinite' : 'none',
                      width: `${analyzeProgress}%`, transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <InlineStack align="space-between">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5C6AC4', animation: 'dotBlink 1s ease-in-out infinite' }} />
                      <Text as="p" variant="bodySm" tone="subdued">{analyzeStage}</Text>
                    </div>
                    <Text as="p" variant="bodySm" fontWeight="bold">{Math.round(analyzeProgress)}%</Text>
                  </InlineStack>
                </BlockStack>
              </div>
            </Card>
          </FadeIn>
        )}

        {/* ── Simple Store Setup ─────────── */}
        {!analyzing && (
          <FadeIn delay={100}>
            <Card>
              <BlockStack gap="500">
                <InlineStack gap="300" blockAlign="center">
                  <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: 'linear-gradient(135deg, #5C6AC4, #8B5CF6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(92,106,196,0.3)',
                  }}>
                    <span style={{ fontSize: 24 }}>🧬</span>
                  </div>
                  <BlockStack gap="0">
                    <Text as="h2" variant="headingMd">Describe Your Store</Text>
                    <Text as="p" variant="bodySm" tone="subdued">AI will build your complete store DNA from just 3 inputs</Text>
                  </BlockStack>
                </InlineStack>

                {/* Field 1: What does your store sell? */}
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="bold">What does your store sell?</Text>
                  <TextField
                    label="" labelHidden
                    value={storeDesc} onChange={setStoreDesc}
                    placeholder="e.g., Minimalist home decor and aesthetic room accessories for young adults"
                    multiline={3} autoComplete="off"
                    helpText="Be specific! 'Gaming accessories and RGB desk setups' works better than 'cool stuff'"
                  />
                </BlockStack>

                {/* Field 2: Who's your customer? */}
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="bold">Who's your ideal customer?</Text>
                  <TextField
                    label="" labelHidden
                    value={audience} onChange={setAudience}
                    placeholder="e.g., Gen-Z college students who love TikTok aesthetic and cozy room vibes"
                    autoComplete="off"
                    helpText="Think age group, interests, lifestyle"
                  />
                </BlockStack>

                {/* Field 3: Price range */}
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="bold">Price range for products?</Text>
                  <InlineStack gap="200">
                    {['$5-$25', '$10-$50', '$20-$80', '$30-$100', '$50-$200'].map(range => (
                      <button key={range} onClick={() => setPriceRange(range)} style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                        border: priceRange === range ? '2px solid #5C6AC4' : '1px solid #C9CCCF',
                        background: priceRange === range ? '#F0F0FF' : 'white',
                        color: priceRange === range ? '#5C6AC4' : '#6D7175',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}>{range}</button>
                    ))}
                  </InlineStack>
                </BlockStack>

                <Divider />

                {/* Actions */}
                <InlineStack gap="300" align="space-between">
                  <Button onClick={handleAiSuggest} loading={aiSuggesting} disabled={!storeDesc.trim()}>
                    🤖 AI Improve My Description
                  </Button>
                  <Button variant="primary" size="large" onClick={handleSaveAndAnalyze} disabled={!storeDesc.trim()}>
                    🧬 Build Store DNA
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </FadeIn>
        )}

        {/* ── Current DNA Summary ─────────── */}
        {hasDNA && !analyzing && (
          <FadeIn delay={200}>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="success">DNA Active</Badge>
                    <Text as="h2" variant="headingSm">Current Store DNA</Text>
                  </InlineStack>
                  <Button size="slim" onClick={() => navigate('/candidates')}>Go to Research →</Button>
                </InlineStack>

                <InlineGrid columns={2} gap="300">
                  {[
                    { icon: '✨', label: 'Brand Vibe', value: dna.brandVibe, color: '#5C6AC4' },
                    { icon: '👥', label: 'Audience', value: dna.audienceSegments?.join(', '), color: '#007ACE' },
                    { icon: '🔑', label: 'Niche Keywords', value: dna.nicheKeywords?.join(', '), color: '#B98900' },
                    { icon: '💰', label: 'Price Position', value: dna.pricePositioning, color: '#008060' },
                    { icon: '💪', label: 'Strengths', value: dna.catalogStrengths?.join(', '), color: '#47B881' },
                    { icon: '🔍', label: 'Opportunities', value: dna.catalogGaps?.join(', '), color: '#DE6E1E' },
                  ].map(f => (
                    <div key={f.label} style={{
                      padding: '12px 16px', borderRadius: 10,
                      background: `${f.color}06`, border: `1px solid ${f.color}20`,
                    }}>
                      <Text as="p" variant="bodySm" tone="subdued">{f.icon} {f.label}</Text>
                      <Text as="p" variant="bodyMd" fontWeight="semibold">{f.value || 'Not set'}</Text>
                    </div>
                  ))}
                </InlineGrid>
              </BlockStack>
            </Card>
          </FadeIn>
        )}

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
