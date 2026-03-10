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
  { name: 'Room Decor & LED', emoji: '\uD83D\uDCA1' },
  { name: 'Gaming Accessories', emoji: '\uD83C\uDFAE' },
  { name: 'Tech Gadgets', emoji: '\uD83D\uDCF1' },
  { name: 'Phone Accessories', emoji: '\uD83D\uDCDE' },
  { name: 'Desk Setup', emoji: '\uD83D\uDDA5' },
  { name: 'Creator Tools', emoji: '\uD83C\uDFAC' },
  { name: 'Fashion Accessories', emoji: '\uD83D\uDC57' },
  { name: 'Lifestyle Products', emoji: '\u2728' },
  { name: 'Fitness & Wellness', emoji: '\uD83D\uDCAA' },
  { name: 'Kitchen & Home', emoji: '\uD83C\uDFE0' },
  { name: 'Beauty & Skincare', emoji: '\uD83D\uDC84' },
  { name: 'Pet Products', emoji: '\uD83D\uDC3E' },
  { name: 'Outdoor & Travel', emoji: '\uD83C\uDF0D' },
  { name: 'Car Accessories', emoji: '\uD83D\uDE97' },
  { name: 'Party & Events', emoji: '\uD83C\uDF89' },
  { name: 'Stationery', emoji: '\uD83D\uDCDD' },
];

const COUNTRY_OPTIONS = [
  { label: '\uD83C\uDDFA\uD83C\uDDF8 United States', value: 'US' },
  { label: '\uD83C\uDDEC\uD83C\uDDE7 United Kingdom', value: 'GB' },
  { label: '\uD83C\uDDE8\uD83C\uDDE6 Canada', value: 'CA' },
  { label: '\uD83C\uDDE6\uD83C\uDDFA Australia', value: 'AU' },
  { label: '\uD83C\uDDE9\uD83C\uDDEA Germany', value: 'DE' },
  { label: '\uD83C\uDDEB\uD83C\uDDF7 France', value: 'FR' },
  { label: '\uD83C\uDDEA\uD83C\uDDF8 Spain', value: 'ES' },
  { label: '\uD83C\uDDEE\uD83C\uDDF9 Italy', value: 'IT' },
  { label: '\uD83C\uDDF3\uD83C\uDDF1 Netherlands', value: 'NL' },
  { label: '\uD83C\uDDEA\uD83C\uDDFA Europe (All EU)', value: 'EU' },
  { label: '\uD83C\uDF0D Worldwide', value: 'WORLD' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { post, loading, error } = useApi();
  const [step, setStep] = useState(0);
  const [customPreferred, setCustomPreferred] = useState('');
  const [customBanned, setCustomBanned] = useState('');
  const [customCountry, setCustomCountry] = useState('');

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
    replacementMode: 'HYBRID',
  });

  const updateForm = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleInArray = (field: 'preferredCategories' | 'bannedCategories', item: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter((c) => c !== item)
        : [...prev[field], item],
    }));
  };

  const addCustomCategory = (field: 'preferredCategories' | 'bannedCategories', value: string, setter: (v: string) => void) => {
    if (value.trim() && !form[field].includes(value.trim())) {
      setForm((prev) => ({
        ...prev,
        [field]: [...prev[field], value.trim()],
      }));
      setter('');
    }
  };

  const addCustomCountry = () => {
    if (customCountry.trim() && !form.targetCountries.includes(customCountry.trim())) {
      setForm((prev) => ({
        ...prev,
        targetCountries: [...prev.targetCountries, customCountry.trim()],
      }));
      setCustomCountry('');
    }
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
        {/* Progress */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <InlineStack gap="300">
                {STEPS.map((s, i) => (
                  <Text key={s} as="span" variant="bodySm"
                    fontWeight={i === step ? 'bold' : 'regular'}
                    tone={i < step ? 'success' : i === step ? undefined : 'subdued'}
                  >
                    {i < step ? '\u2713 ' : ''}{s}
                  </Text>
                ))}
              </InlineStack>
              <Badge>{step + 1}/{STEPS.length}</Badge>
            </InlineStack>
            <ProgressBar progress={progress} tone="primary" size="small" />
          </BlockStack>
        </Card>

        {error && <Banner tone="critical" title="Error"><Text as="p">{error}</Text></Banner>}

        {/* Step 0: Store */}
        {step === 0 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">Tell us about your store</Text>
                <Text as="p" tone="subdued">
                  The more detail you give, the better our AI will find products for you.
                  Sit back and watch the magic happen!
                </Text>
              </BlockStack>
              <TextField
                label="Store Description"
                value={form.storeDescription}
                onChange={(v) => updateForm('storeDescription', v)}
                multiline={4}
                placeholder="Example: We sell cool, flex-worthy gadgets for Gen-Z and young adults. Think LED room aesthetic products, gaming desk accessories, TikTok viral gadgets, and creator tools. Products should feel social-media-friendly and show-off worthy."
                autoComplete="off"
                helpText={`${form.storeDescription.length} characters \u2014 aim for 50+`}
              />
              <TextField
                label="Your Store Domain"
                value={form.domain}
                onChange={(v) => updateForm('domain', v)}
                placeholder="flexbucket.com"
                autoComplete="off"
                helpText="We analyze your domain name to understand your brand vibe and language"
              />
              <div style={{
                padding: '12px 16px', borderRadius: 8, background: '#F0F5FF',
                border: '1px solid #B4D5FE',
              }}>
                <Text as="p" variant="bodySm">
                  <strong>Tip:</strong> Your domain name matters! "flexbucket.com" signals youth culture
                  and curated products. We use this in scoring.
                </Text>
              </div>
            </BlockStack>
          </Card>
        )}

        {/* Step 1: Audience */}
        {step === 1 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">Who are your customers?</Text>
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
              <Text as="h3" variant="headingSm">Where do you ship?</Text>
              <ChoiceList
                title="Countries"
                titleHidden
                allowMultiple
                choices={COUNTRY_OPTIONS}
                selected={form.targetCountries}
                onChange={(v) => updateForm('targetCountries', v)}
              />
              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    labelHidden
                    value={customCountry}
                    onChange={setCustomCountry}
                    placeholder="Add another country..."
                    autoComplete="off"
                  />
                </div>
                <Button onClick={addCustomCountry} disabled={!customCountry.trim()}>Add</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* Step 2: Categories */}
        {step === 2 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">What products fit your store?</Text>
                <Text as="p" tone="subdued">
                  Tap categories to select. We'll focus research on these.
                </Text>
              </BlockStack>

              <Text as="h3" variant="headingSm">Preferred Categories</Text>
              <InlineStack gap="200" wrap>
                {CATEGORIES.map(({ name, emoji }) => (
                  <Button
                    key={name}
                    variant={form.preferredCategories.includes(name) ? 'primary' : 'secondary'}
                    size="slim"
                    onClick={() => toggleInArray('preferredCategories', name)}
                  >
                    {emoji} {name}
                  </Button>
                ))}
              </InlineStack>
              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    labelHidden
                    value={customPreferred}
                    onChange={setCustomPreferred}
                    placeholder="Add a custom category..."
                    autoComplete="off"
                  />
                </div>
                <Button onClick={() => addCustomCategory('preferredCategories', customPreferred, setCustomPreferred)}
                  disabled={!customPreferred.trim()}>Add</Button>
              </InlineStack>
              {form.preferredCategories.filter(c => !CATEGORIES.map(x => x.name).includes(c)).length > 0 && (
                <InlineStack gap="200" wrap>
                  {form.preferredCategories.filter(c => !CATEGORIES.map(x => x.name).includes(c)).map(c => (
                    <Badge key={c} tone="success">{c} <span onClick={() => toggleInArray('preferredCategories', c)} style={{ cursor: 'pointer' }}>\u2715</span></Badge>
                  ))}
                </InlineStack>
              )}

              <Divider />

              <Text as="h3" variant="headingSm">Categories to Avoid</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Optional \u2014 products from these will be filtered out.
              </Text>
              <InlineStack gap="200" wrap>
                {CATEGORIES.filter(c => !form.preferredCategories.includes(c.name)).map(({ name, emoji }) => (
                  <Button
                    key={name}
                    variant={form.bannedCategories.includes(name) ? 'tertiary' : 'secondary'}
                    tone={form.bannedCategories.includes(name) ? 'critical' : undefined}
                    size="slim"
                    onClick={() => toggleInArray('bannedCategories', name)}
                  >
                    {form.bannedCategories.includes(name) ? '\u2715 ' : ''}{emoji} {name}
                  </Button>
                ))}
              </InlineStack>
              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    labelHidden
                    value={customBanned}
                    onChange={setCustomBanned}
                    placeholder="Add a custom category to avoid..."
                    autoComplete="off"
                  />
                </div>
                <Button onClick={() => addCustomCategory('bannedCategories', customBanned, setCustomBanned)}
                  disabled={!customBanned.trim()}>Add</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* Step 3: Business */}
        {step === 3 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">Business Rules</Text>
                <Text as="p" tone="subdued">Set your price range, margin, and shipping preferences.</Text>
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
                  { label: 'Express (1-5 days)', value: 'EXPRESS' },
                  { label: 'Standard (5-15 days)', value: 'STANDARD' },
                  { label: 'Economy (15-30 days)', value: 'ECONOMY' },
                ]}
                value={form.desiredShippingSpeed}
                onChange={(v) => updateForm('desiredShippingSpeed', v)}
              />
            </BlockStack>
          </Card>
        )}

        {/* Step 4: Strategy */}
        {step === 4 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">Replacement Strategy</Text>
                <Text as="p" tone="subdued">
                  When a product underperforms, how should FlexHunter handle it?
                </Text>
              </BlockStack>

              {[
                {
                  value: 'MANUAL', title: 'Manual Mode',
                  icon: '\uD83D\uDD90\uFE0F',
                  desc: 'You review and approve every replacement. Full control.',
                  color: '#F0F5FF',
                },
                {
                  value: 'AUTOMATIC', title: 'Automatic Mode',
                  icon: '\uD83E\uDD16',
                  desc: 'Products are auto-replaced when they hit your thresholds. Hands-off.',
                  color: '#F1F8F5',
                },
                {
                  value: 'HYBRID', title: 'Hybrid Mode (Recommended)',
                  icon: '\u26A1',
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
                      <Text as="h3" variant="headingSm">{mode.icon} {mode.title}</Text>
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
                  Pinned products are never auto-replaced, and products above
                  your revenue threshold always require approval. You can change this anytime in Settings.
                </Text>
              </div>
            </BlockStack>
          </Card>
        )}

        {/* Navigation - with bottom spacing */}
        <div style={{ paddingBottom: 40 }}>
          <InlineStack align="space-between">
            <Button
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              \u2190 Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
              >
                Next Step \u2192
              </Button>
            ) : (
              <Button
                variant="primary"
                tone="success"
                onClick={handleSubmit}
                loading={loading}
                size="large"
              >
                Complete Setup & Start Hunting
              </Button>
            )}
          </InlineStack>
        </div>
      </BlockStack>
    </Page>
  );
}
