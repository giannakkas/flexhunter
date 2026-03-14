import { friendlyError } from '../utils/errors';
import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, TextField, Button, Banner,
  InlineStack, Badge, Divider, Spinner, InlineGrid,
} from '@shopify/polaris';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../hooks/useApi';

interface SeoResult {
  originalTitle: string;
  optimizedTitle: string;
  originalDescription: string;
  optimizedDescription: string;
  metaTitle: string;
  metaDescription: string;
  suggestedKeywords: string[];
  suggestedHandle: string;
  altTextSuggestions: string[];
  suggestedTags: string[];
  confidence: number;
}

export function SeoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('product');

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [seo, setSeo] = useState<SeoResult | null>(null);
  const [edited, setEdited] = useState<Partial<SeoResult>>({});
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'critical' } | null>(null);

  const runOptimization = async (id: string) => {
    setLoading(true);
    try {
      const result = await apiFetch<{ success: boolean; data: SeoResult }>(`/seo/optimize/${id}`, { method: 'POST' });
      setSeo(result.data);
      setEdited({
        optimizedTitle: result.data.optimizedTitle,
        optimizedDescription: result.data.optimizedDescription,
        metaTitle: result.data.metaTitle,
        metaDescription: result.data.metaDescription,
        suggestedHandle: result.data.suggestedHandle,
      });
    } catch (err: any) {
      setMessage({ text: friendlyError(err.message), tone: 'critical' });
    }
    setLoading(false);
  };

  const applyChanges = async () => {
    if (!productId || !edited) return;
    setApplying(true);
    try {
      await apiFetch(`/seo/apply/${productId}`, {
        method: 'POST',
        body: JSON.stringify({
          title: edited.optimizedTitle,
          description: edited.optimizedDescription,
          metaTitle: edited.metaTitle,
          metaDescription: edited.metaDescription,
          handle: edited.suggestedHandle,
          tags: seo?.suggestedTags,
        }),
      });
      setMessage({ text: 'SEO changes applied successfully!', tone: 'success' });
      setTimeout(() => navigate('/imports'), 1500);
    } catch (err: any) {
      setMessage({ text: friendlyError(err.message), tone: 'critical' });
    }
    setApplying(false);
  };

  useEffect(() => {
    if (productId) runOptimization(productId);
  }, [productId]);

  if (!productId) {
    return (
      <Page title="SEO Optimization" backAction={{ content: 'Back', onAction: () => navigate('/imports') }}>
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Optimize Product SEO</Text>
            <Text as="p" tone="subdued">
              Go to Imported Products and click "Optimize SEO" on any product to start.
            </Text>
            <Button variant="primary" onClick={() => navigate('/imports')}>Go to Imports</Button>
          </BlockStack>
        </Card>
        <div style={{ height: 80 }} />
      </Page>
    );
  }

  return (
    <Page title="SEO Optimization" backAction={{ content: 'Back to Imports', onAction: () => navigate('/imports') }}>
      <BlockStack gap="500">
        {message && <Banner tone={message.tone} onDismiss={() => setMessage(null)}><Text as="p">{message.text}</Text></Banner>}

        {/* Why SEO matters */}
        <Card>
          <div style={{ padding: '16px 20px', background: '#F0F5FF', borderRadius: 8, border: '1px solid #B4D5FE' }}>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Why optimize SEO after import?</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Products with optimized titles and descriptions rank higher in Google Shopping,
                get more organic traffic, and convert better. This is one of the highest-ROI
                actions you can take after importing a product.
              </Text>
            </BlockStack>
          </div>
        </Card>

        {loading && (
          <Card>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spinner size="large" />
              <br /><br />
              <Text as="p">Analyzing your product and generating SEO recommendations...</Text>
            </div>
          </Card>
        )}

        {seo && !loading && (
          <>
            {/* Confidence */}
            <InlineStack gap="200">
              <Badge tone={seo.confidence >= 0.7 ? 'success' : 'attention'}>
                Confidence: {(seo.confidence * 100).toFixed(0)}%
              </Badge>
              <Badge tone="info">{seo.suggestedKeywords.length} keywords found</Badge>
            </InlineStack>

            {/* Title */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Product Title</Text>
                <InlineGrid columns={2} gap="400">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Original</Text>
                    <div style={{ padding: '8px 12px', background: '#FFF4F4', borderRadius: 6, border: '1px solid #FDD' }}>
                      <Text as="p" variant="bodySm">{seo.originalTitle}</Text>
                    </div>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="success">Optimized</Text>
                    <TextField
                      label="" labelHidden
                      value={edited.optimizedTitle || ''}
                      onChange={v => setEdited(p => ({ ...p, optimizedTitle: v }))}
                      autoComplete="off"
                    />
                  </BlockStack>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* Meta */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Search Engine Preview</Text>
                <div style={{ padding: '16px', background: '#FAFBFC', borderRadius: 8, border: '1px solid #E4E5E7' }}>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="bold" tone="success">
                      {edited.metaTitle || seo.metaTitle}
                    </Text>
                    <Text as="p" variant="bodySm" tone="success">
                      yourstore.com/products/{edited.suggestedHandle || seo.suggestedHandle}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {edited.metaDescription || seo.metaDescription}
                    </Text>
                  </BlockStack>
                </div>
                <Divider />
                <TextField
                  label="Meta Title (50-60 characters)"
                  value={edited.metaTitle || ''}
                  onChange={v => setEdited(p => ({ ...p, metaTitle: v }))}
                  autoComplete="off"
                  helpText={`${(edited.metaTitle || '').length}/60 characters`}
                />
                <TextField
                  label="Meta Description (140-160 characters)"
                  value={edited.metaDescription || ''}
                  onChange={v => setEdited(p => ({ ...p, metaDescription: v }))}
                  multiline={2}
                  autoComplete="off"
                  helpText={`${(edited.metaDescription || '').length}/160 characters`}
                />
                <TextField
                  label="URL Handle"
                  value={edited.suggestedHandle || ''}
                  onChange={v => setEdited(p => ({ ...p, suggestedHandle: v }))}
                  autoComplete="off"
                  prefix="yourstore.com/products/"
                />
              </BlockStack>
            </Card>

            {/* Description */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Product Description</Text>
                <TextField
                  label="Optimized Description (HTML)"
                  value={edited.optimizedDescription || ''}
                  onChange={v => setEdited(p => ({ ...p, optimizedDescription: v }))}
                  multiline={6}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            {/* Keywords & Tags */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Suggested Keywords</Text>
                <InlineStack gap="200" wrap>
                  {seo.suggestedKeywords.map((kw, i) => (
                    <Badge key={i} tone="info">{kw}</Badge>
                  ))}
                </InlineStack>
                <Divider />
                <Text as="h3" variant="headingSm">Suggested Tags</Text>
                <InlineStack gap="200" wrap>
                  {seo.suggestedTags.map((tag, i) => (
                    <Badge key={i}>{tag}</Badge>
                  ))}
                </InlineStack>
                {seo.altTextSuggestions.length > 0 && (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingSm">Image Alt Text</Text>
                    {seo.altTextSuggestions.map((alt, i) => (
                      <Text key={i} as="p" variant="bodySm" tone="subdued">Image {i + 1}: {alt}</Text>
                    ))}
                  </>
                )}
              </BlockStack>
            </Card>

            {/* Apply */}
            <Card>
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">Apply Changes</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    This will update the product in your database and Shopify (if connected).
                  </Text>
                </BlockStack>
                <InlineStack gap="200">
                  <Button onClick={() => runOptimization(productId)}>Regenerate</Button>
                  <Button variant="primary" onClick={applyChanges} loading={applying}>
                    Apply SEO Changes
                  </Button>
                </InlineStack>
              </InlineStack>
            </Card>
          </>
        )}

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
