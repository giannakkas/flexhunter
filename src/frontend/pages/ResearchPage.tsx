import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Button, Banner, Spinner,
  InlineStack, Badge, Divider, DescriptionList, TextField,
} from '@shopify/polaris';
import { useApi } from '../hooks/useApi';

export function ResearchPage() {
  const { data: dna, get: getDna, loading: dnaLoading } = useApi<any>();
  const { data: status, get: getStatus } = useApi<any>();
  const { post: startResearch, loading: researchLoading } = useApi();
  const { post: analyzeStore, loading: analyzingStore } = useApi();
  const [domainPreview, setDomainPreview] = useState<any>(null);
  const { post: analyzeDomain } = useApi<any>();

  useEffect(() => {
    getDna('/store-dna');
    getStatus('/research/status');
  }, [getDna, getStatus]);

  const handleStartResearch = async () => {
    await startResearch('/research/start');
    setTimeout(() => getStatus('/research/status'), 1000);
  };

  const handleAnalyzeStore = async () => {
    await analyzeStore('/store-dna/analyze');
    setTimeout(() => getDna('/store-dna'), 3000);
  };

  const handlePreviewDomain = async (domain: string) => {
    const result = await analyzeDomain('/domain/analyze', { domain });
    if (result?.data) setDomainPreview(result.data);
  };

  return (
    <Page
      title="Research Console"
      subtitle="Deep product research powered by your store's DNA"
      primaryAction={{
        content: 'Start Research',
        onAction: handleStartResearch,
        loading: researchLoading,
      }}
      secondaryActions={[
        { content: 'Re-Analyze Store', onAction: handleAnalyzeStore, loading: analyzingStore },
      ]}
    >
      <BlockStack gap="600">
        {status && status.status === 'RUNNING' && (
          <Banner title="Research in Progress" tone="info">
            <InlineStack gap="200" blockAlign="center">
              <Spinner size="small" />
              <Text as="p">The research pipeline is running. Results will appear in Candidates.</Text>
            </InlineStack>
          </Banner>
        )}

        {status && status.status === 'COMPLETED' && (
          <Banner title="Last Research Complete" tone="success">
            <Text as="p">
              Completed at {new Date(status.completedAt).toLocaleString()}.
              {status.result?.totalSaved && ` Found ${status.result.totalSaved} new candidates.`}
            </Text>
          </Banner>
        )}

        {/* Store DNA */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">Store DNA</Text>
              {dna && <Badge tone="success">Analyzed</Badge>}
            </InlineStack>

            {dnaLoading && <Spinner />}

            {dna && (
              <BlockStack gap="300">
                <DescriptionList
                  items={[
                    { term: 'Brand Vibe', description: dna.brandVibe || 'Not analyzed yet' },
                    { term: 'Domain', description: dna.domain },
                    { term: 'Niche Keywords', description: (dna.nicheKeywords || []).join(', ') },
                    { term: 'Audience', description: (dna.audienceSegments || []).join(', ') },
                    { term: 'Tone', description: (dna.toneAttributes || []).join(', ') },
                    { term: 'Price Position', description: dna.pricePositioning },
                    { term: 'Catalog Gaps', description: (dna.catalogGaps || []).join(', ') },
                    { term: 'Catalog Strengths', description: (dna.catalogStrengths || []).join(', ') },
                  ]}
                />
              </BlockStack>
            )}

            {!dna && !dnaLoading && (
              <Text as="p" tone="subdued">
                No store DNA yet. Complete onboarding or click "Re-Analyze Store" to generate it.
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Domain Intent Preview */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Domain Intent Engine</Text>
            <Text as="p" tone="subdued">
              Preview how any domain name is analyzed for product fit scoring.
            </Text>
            <InlineStack gap="200">
              <Button onClick={() => handlePreviewDomain('flexbucket.com')} size="slim">
                flexbucket.com
              </Button>
              <Button onClick={() => handlePreviewDomain('driphaus.com')} size="slim">
                driphaus.com
              </Button>
              <Button onClick={() => handlePreviewDomain('cozycraft.co')} size="slim">
                cozycraft.co
              </Button>
            </InlineStack>

            {domainPreview && (
              <BlockStack gap="200">
                <Divider />
                <Text as="h3" variant="headingSm">{domainPreview.domain}</Text>
                <DescriptionList
                  items={[
                    { term: 'Extracted Words', description: domainPreview.extractedWords?.join(', ') },
                    { term: 'Detected Slang', description: domainPreview.detectedSlang?.join(', ') || 'None' },
                    { term: 'Inferred Tone', description: domainPreview.inferredTone?.join(', ') || 'Neutral' },
                    { term: 'Age Group', description: domainPreview.inferredAgeGroup || 'General' },
                    { term: 'Psychographic Hints', description: domainPreview.psychographicHints?.join(', ') },
                    { term: 'Category Bias', description: domainPreview.categoryBias?.join(', ') },
                    { term: 'Fit Keywords', description: domainPreview.domainFitKeywords?.join(', ') },
                  ]}
                />
                {domainPreview.vibeScore && (
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" fontWeight="semibold">Vibe Scores:</Text>
                    <InlineStack gap="200" wrap>
                      {Object.entries(domainPreview.vibeScore).map(([key, val]) => (
                        <Badge key={key} tone={(val as number) > 60 ? 'success' : 'info'}>
                          {key}: {val as number}
                        </Badge>
                      ))}
                    </InlineStack>
                  </BlockStack>
                )}
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* How It Works */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">How Research Works</Text>
            <DescriptionList
              items={[
                { term: '1. Store Context', description: 'Loads your store DNA, domain analysis, and settings' },
                { term: '2. Candidate Fetch', description: 'Searches all connected providers for matching products' },
                { term: '3. Normalization', description: 'Standardizes data from different sources' },
                { term: '4. Multi-Dimensional Scoring', description: 'Scores each product across 11 dimensions including domain fit, audience fit, trend fit, margin fit, and more' },
                { term: '5. AI Enrichment', description: 'Uses AI to evaluate visual virality, novelty, and generate explanations' },
                { term: '6. Ranking', description: 'Products are ranked by weighted final score and saved as candidates' },
              ]}
            />
          </BlockStack>
        </Card>

        {/* Connected Providers */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Product Sources</Text>
            <Text as="p" tone="subdued">
              These are the providers FlexHunter searches for products. More coming soon.
            </Text>
            <BlockStack gap="200">
              {[
                { name: 'AliExpress', status: 'Mock Data (V1)', tone: 'attention' as const, desc: 'Using sample catalog. Real API integration coming in V2.' },
                { name: 'CJ Dropshipping', status: 'Coming Soon', tone: 'subdued' as const, desc: 'Will connect via CJ API for faster shipping options.' },
                { name: 'CSV / Feed Import', status: 'Available', tone: 'success' as const, desc: 'Upload your own product feed for scoring.' },
              ].map((provider) => (
                <div key={provider.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 8, background: '#FAFBFC', border: '1px solid #E4E5E7',
                }}>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">{provider.name}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">{provider.desc}</Text>
                  </BlockStack>
                  <Badge tone={provider.tone}>{provider.status}</Badge>
                </div>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Request a Provider */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Request a Provider</Text>
            <Text as="p" tone="subdued">
              Want us to integrate a specific supplier or marketplace? Let us know and we'll prioritize it.
            </Text>
            <ProviderRequestForm />
          </BlockStack>
        </Card>

        <div style={{ height: 60 }} />
      </BlockStack>
    </Page>
  );
}

function ProviderRequestForm() {
  const [provider, setProvider] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    // In production, this would POST to your API
    console.log('Provider request:', { provider, details });
    setSubmitted(true);
    setProvider('');
    setDetails('');
  };

  if (submitted) {
    return (
      <Banner tone="success" onDismiss={() => setSubmitted(false)}>
        <Text as="p">Thanks! We've received your request and will review it.</Text>
      </Banner>
    );
  }

  return (
    <BlockStack gap="300">
      <TextField
        label="Provider / Marketplace Name"
        value={provider}
        onChange={setProvider}
        placeholder="e.g., Spocket, Zendrop, Temu, Amazon..."
        autoComplete="off"
      />
      <TextField
        label="Why this provider? (optional)"
        value={details}
        onChange={setDetails}
        placeholder="e.g., Better shipping times to EU, niche products for my category..."
        multiline={2}
        autoComplete="off"
      />
      <Button variant="primary" onClick={handleSubmit} disabled={!provider.trim()}>
        Submit Request
      </Button>
    </BlockStack>
  );
}
