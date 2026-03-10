import React, { useState } from 'react';
import {
  Page, Card, BlockStack, Text, TextField, Select, ChoiceList,
  Button, InlineStack, ProgressBar, Banner, Divider,
  RangeSlider, InlineGrid, Badge,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';

const STEPS = ['Your Store', 'Audience', 'Products', 'Business', 'Strategy'];

const AUDIENCE_OPTIONS = [
  { label: 'Gen-Z (18-25)', value: 'gen-z' },
  { label: 'Teenagers (13-17)', value: 'teenagers' },
  { label: 'Young Adults (25-35)', value: 'young adults' },
  { label: 'Gamers', value: 'gamers' },
  { label: 'Content Creators', value: 'creators' },
  { label: 'TikTok Users', value: 'tiktok users' },
  { label: 'Millennials (30-45)', value: 'millennials' },
  { label: 'Parents', value: 'parents' },
  { label: 'Professionals', value: 'professionals' },
  { label: 'Students', value: 'students' },
];

const CATEGORIES = [
  { name: 'Room Decor & LED', emoji: '💡' },
  { name: 'Gaming Accessories', emoji: '🎮' },
  { name: 'Tech Gadgets', emoji: '📱' },
  { name: 'Phone Accessories', emoji: '📞' },
  { name: 'Desk Setup', emoji: '🖥️' },
  { name: 'Creator Tools', emoji: '🎬' },
  { name: 'Fashion Accessories', emoji: '👗' },
  { name: 'Lifestyle Products', emoji: '✨' },
  { name: 'Fitness & Wellness', emoji: '💪' },
  { name: 'Kitchen & Home', emoji: '🏠' },
  { name: 'Beauty & Skincare', emoji: '💄' },
  { name: 'Pet Products', emoji: '🐾' },
  { name: 'Outdoor & Travel', emoji: '🌍' },
  { name: 'Car Accessories', emoji: '🚗' },
  { name: 'Party & Events', emoji: '🎉' },
  { name: 'Stationery', emoji: '📝' },
];

const COUNTRY_OPTIONS = [
  { label: '🇺🇸 United States', value: 'US' },
  { label: '🇬🇧 United Kingdom', value: 'GB' },
  { label: '🇨🇦 Canada', value: 'CA' },
  { label: '🇦🇺 Australia', value: 'AU' },
  { label: '🇩🇪 Germany', value: 'DE' },
  { label: '🇫🇷 France', value: 'FR' },
  { label: '🌍 Worldwide', value: 'WORLD' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { post, loading, error } = useApi();
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    storeDescription: '',
    domain: '',
    targetAudience: [] as string[],
    targetCountries: ['US'] as string[],
    preferredCategories: [] as string[],
    bannedCategories: [] as string[],
    priceRangeMin: 10,
    priceRangeMax: 80,
    minimumMarginPercent: 30,
    desiredShippingSpeed: 'STANDARD',
    replacementMode: 'MANUAL',
  });

  const updateForm = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (cat: string, field: 'preferredCategories' | 'bannedCategories') => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(cat)
        ? prev[field].filter((c) => c !== cat)
        : [...prev[field], cat],
    }));
  };

  const handleSubmit = async () => {
    const result = await post('/onboarding', form);
    if (result?.success) {
      navigate('/');
    }
  };

  const canProceed = () => {
    if (step === 0) return form.storeDescription.length > 10 && form.domain.length > 3;
    if (step === 1) return form.targetAudience.length > 0;
    if (step === 2) return form.preferredCategories.length > 0;
    return true;
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <Page
      title="Store Setup"
      backAction={{ content: 'Dashboard', onAction: () => navigate('/') }}
    >
      <BlockStack gap="500">
        {/* Progress Bar */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <InlineStack gap="300">
                {STEPS.map((s, i) => (
                  <Text key={s} as="span" variant="bodySm"
                    fontWeight={i === step ? 'bold' : 'regular'}
                    tone={i < step ? 'success' : i === step ? undefined : 'subdued'}
                  >
                    {i < step ? '✓ ' : ''}{s}
                  </Text>
                ))}
              </InlineStack>
              <Badge>{step + 1}/{STEPS.length}</Badge>
            </InlineStack>
            <ProgressBar progress={progress} tone="primary" size="small" />
          </BlockStack>
        </Card>

        {error && <Banner tone="critical" title="Error"><Text as="p">{error}</Text></Banner>}

        {/* ── Step 0: Store Description ───────── */}
        {step === 0 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">Tell us about your store 🏪</Text>
                <Text as="p" tone="subdued">
                  The more detail you give, the better our product recommendations will be.
                  Think about what makes your store unique.
                </Text>
              </BlockStack>
              <TextField
                label="Store Description"
                value={form.storeDescription}
                onChange={(v) => updateForm('storeDescription', v)}
                multiline={4}
                placeholder="Example: We sell cool, flex-worthy gadgets for Gen-Z and young adults. Think LED room aesthetic products, gaming desk accessories, TikTok viral gadgets, and creator tools. Products should feel social-media-friendly and show-off worthy."
                autoComplete="off"
                helpText={`${form.storeDescription.length} characters — aim for 50+`}
              />
              <TextField
                label="Your Store Domain"
                value={form.domain}
                onChange={(v) => updateForm('domain', v)}
                placeholder="flexbucket.com"
                autoComplete="off"
                helpText="We analyze your domain name to understand your brand's vibe and language"
              />
              <div style={{
                padding: '12px 16px', borderRadius: 8, background: '#F0F5FF',
                border: '1px solid #B4D5FE',
              }}>
                <Text as="p" variant="bodySm">
                  💡 <strong>Tip:</strong> Your domain name matters! "flexbucket.com" tells us your store
                  targets youth culture with flex-worthy, curated products. We use this signal in scoring.
                </Text>
              </div>
            </BlockStack>
          </Card>
        )}

        {/* ── Step 1: Target Audience ─────────── */}
        {step === 1 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">Who are your customers? 🎯</Text>
                <Text as="p" tone="subdued">
                  Select all audience segments that match. This helps us find products they'll actually want.
                </Text>
              </BlockStack>
              <ChoiceList
                title="Target Audience"
                titleHidden
                allowMultiple
                choices={AUDIENCE_OPTIONS}
                selected={form.targetAudience}
                onChange={(v) => updateForm('targetAudience', v)}
              />
              <Divider />
              <Text as="h3" variant="headingSm">Where do you ship? 🌍</Text>
              <ChoiceList
                title="Countries"
                titleHidden
                allowMultiple
                choices={COUNTRY_OPTIONS}
                selected={form.targetCountries}
                onChange={(v) => updateForm('targetCountries', v)}
              />
            </BlockStack>
          </Card>
        )}

        {/* ── Step 2: Categories ──────────────── */}
        {step === 2 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">What products fit your store? 🛍️</Text>
                <Text as="p" tone="subdued">
                  Tap to select categories you want. We'll focus research on these.
                </Text>
              </BlockStack>

              <Text as="h3" variant="headingSm">✅ Preferred Categories</Text>
              <InlineStack gap="200" wrap>
                {CATEGORIES.map(({ name, emoji }) => (
                  <Button
                    key={name}
                    variant={form.preferredCategories.includes(name) ? 'primary' : 'secondary'}
                    size="slim"
                    onClick={() => toggleCategory(name, 'preferredCategories')}
                  >
                    {emoji} {name}
                  </Button>
                ))}
              </InlineStack>

              <Divider />

              <Text as="h3" variant="headingSm">🚫 Categories to Avoid</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Optional — products from these categories will be filtered out.
              </Text>
              <InlineStack gap="200" wrap>
                {CATEGORIES.filter(c => !form.preferredCategories.includes(c.name)).map(({ name, emoji }) => (
                  <Button
                    key={name}
                    variant={form.bannedCategories.includes(name) ? 'tertiary' : 'secondary'}
                    tone={form.bannedCategories.includes(name) ? 'critical' : undefined}
                    size="slim"
                    onClick={() => toggleCategory(name, 'bannedCategories')}
                  >
                    {form.bannedCategories.includes(name) ? '✕ ' : ''}{emoji} {name}
                  </Button>
                ))}
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* ── Step 3: Business Rules ─────────── */}
        {step === 3 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">Business Rules 💼</Text>
                <Text as="p" tone="subdued">
                  Set your price range, margin, and shipping preferences.
                </Text>
              </BlockStack>

              <InlineGrid columns={2} gap="400">
                <TextField
                  label="Min Price ($)"
                  type="number"
                  value={String(form.priceRangeMin)}
                  onChange={(v) => updateForm('priceRangeMin', parseFloat(v) || 0)}
                  autoComplete="off"
                />
                <TextField
                  label="Max Price ($)"
                  type="number"
                  value={String(form.priceRangeMax)}
                  onChange={(v) => updateForm('priceRangeMax', parseFloat(v) || 0)}
                  autoComplete="off"
                />
              </InlineGrid>

              <RangeSlider
                label={`Minimum Profit Margin: ${form.minimumMarginPercent}%`}
                value={form.minimumMarginPercent}
                onChange={(v) => updateForm('minimumMarginPercent', v)}
                min={10}
                max={80}
                output
              />

              <Select
                label="Preferred Shipping Speed"
                options={[
                  { label: '⚡ Express (1-5 days)', value: 'EXPRESS' },
                  { label: '📦 Standard (5-15 days)', value: 'STANDARD' },
                  { label: '🐢 Economy (15-30 days)', value: 'ECONOMY' },
                ]}
                value={form.desiredShippingSpeed}
                onChange={(v) => updateForm('desiredShippingSpeed', v)}
              />
            </BlockStack>
          </Card>
        )}

        {/* ── Step 4: Replacement Strategy ──── */}
        {step === 4 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">Replacement Strategy 🔄</Text>
                <Text as="p" tone="subdued">
                  When a product underperforms, how should FlexHunter handle it?
                </Text>
              </BlockStack>

              {[
                {
                  value: 'MANUAL', title: '🖐️ Manual Mode',
                  desc: 'You review and approve every replacement. Full control.',
                  color: '#F0F5FF',
                },
                {
                  value: 'AUTOMATIC', title: '🤖 Automatic Mode',
                  desc: 'Products are auto-replaced when they hit your thresholds. Hands-off.',
                  color: '#F1F8F5',
                },
                {
                  value: 'HYBRID', title: '⚡ Hybrid Mode (Recommended)',
                  desc: 'High-confidence replacements happen automatically. Uncertain ones need your approval.',
                  color: '#FFF8E6',
                },
              ].map((mode) => (
                <div
                  key={mode.value}
                  onClick={() => updateForm('replacementMode', mode.value)}
                  style={{
                    padding: '16px 20px', borderRadius: 10, cursor: 'pointer',
                    border: form.replacementMode === mode.value
                      ? '2px solid #5C6AC4' : '2px solid #E4E5E7',
                    background: form.replacementMode === mode.value ? mode.color : 'white',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingSm">{mode.title}</Text>
                      {form.replacementMode === mode.value && (
                        <Badge tone="info">Selected</Badge>
                      )}
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">{mode.desc}</Text>
                  </BlockStack>
                </div>
              ))}

              <div style={{
                padding: '12px 16px', borderRadius: 8, background: '#F6F6F7',
              }}>
                <Text as="p" variant="bodySm" tone="subdued">
                  🔒 Don't worry — pinned products are never auto-replaced, and products above
                  your revenue threshold always require approval. You can change this anytime in Settings.
                </Text>
              </div>
            </BlockStack>
          </Card>
        )}

        {/* Navigation */}
        <InlineStack align="space-between">
          <Button
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            ← Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              variant="primary"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
            >
              Next Step →
            </Button>
          ) : (
            <Button
              variant="primary"
              tone="success"
              onClick={handleSubmit}
              loading={loading}
              size="large"
            >
              ✨ Complete Setup & Start Hunting
            </Button>
          )}
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
