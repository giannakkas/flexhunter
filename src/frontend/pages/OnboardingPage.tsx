import React, { useState } from 'react';
import {
  Page, Card, BlockStack, Text, TextField, Select, ChoiceList,
  Button, InlineStack, ProgressBar, Banner, Tag, Divider,
  RangeSlider,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';

const STEPS = [
  'Store Description',
  'Target Audience',
  'Product Preferences',
  'Business Rules',
  'Replacement Mode',
];

const AUDIENCE_OPTIONS = [
  { label: 'Gen-Z (18-25)', value: 'gen-z' },
  { label: 'Teenagers (13-17)', value: 'teenagers' },
  { label: 'Young Adults (25-35)', value: 'young adults' },
  { label: 'Gamers', value: 'gamers' },
  { label: 'Content Creators', value: 'creators' },
  { label: 'TikTok Users', value: 'tiktok users' },
  { label: 'Millennials', value: 'millennials' },
  { label: 'Parents', value: 'parents' },
  { label: 'Professionals', value: 'professionals' },
  { label: 'Students', value: 'students' },
];

const CATEGORY_OPTIONS = [
  'Room Decor & LED', 'Gaming Accessories', 'Tech Gadgets', 'Phone Accessories',
  'Desk Setup', 'Creator Tools', 'Fashion Accessories', 'Lifestyle Products',
  'Fitness & Wellness', 'Kitchen & Home', 'Beauty & Skincare', 'Pet Products',
  'Outdoor & Travel', 'Stationery', 'Car Accessories', 'Party & Events',
];

const COUNTRY_OPTIONS = [
  { label: 'United States', value: 'US' },
  { label: 'United Kingdom', value: 'GB' },
  { label: 'Canada', value: 'CA' },
  { label: 'Australia', value: 'AU' },
  { label: 'Germany', value: 'DE' },
  { label: 'France', value: 'FR' },
  { label: 'Worldwide', value: 'WORLD' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { post, loading, error } = useApi();
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    storeDescription: '',
    domain: 'flexbucket.com',
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

  const handleSubmit = async () => {
    const result = await post('/onboarding', form);
    if (result?.success) {
      navigate('/');
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <Page title="Welcome to FlexHunter" subtitle="Let's set up your intelligent product hunter">
      <BlockStack gap="600">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="p" variant="bodySm" tone="subdued">
                Step {step + 1} of {STEPS.length}: {STEPS[step]}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">{Math.round(progress)}%</Text>
            </InlineStack>
            <ProgressBar progress={progress} tone="primary" size="small" />
          </BlockStack>
        </Card>

        {error && (
          <Banner tone="critical" title="Error">
            <Text as="p">{error}</Text>
          </Banner>
        )}

        {/* Step 0: Store Description */}
        {step === 0 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Describe Your Store</Text>
              <Text as="p" tone="subdued">
                Tell us about your store in plain English. What do you sell? What's your vibe?
                The more detail, the better our recommendations.
              </Text>
              <TextField
                label="Store Description"
                value={form.storeDescription}
                onChange={(v) => updateForm('storeDescription', v)}
                multiline={4}
                placeholder="e.g., FlexBucket is a Gen-Z and young adult store selling cool, flex-worthy gadgets, room setup products, LED aesthetic items, and TikTok-viral accessories. Products should feel social-media-friendly and show-off worthy."
                autoComplete="off"
              />
              <TextField
                label="Store Domain"
                value={form.domain}
                onChange={(v) => updateForm('domain', v)}
                helpText="Your domain name is analyzed to understand your brand's vibe and language"
                autoComplete="off"
              />
            </BlockStack>
          </Card>
        )}

        {/* Step 1: Target Audience */}
        {step === 1 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Who's Your Audience?</Text>
              <Text as="p" tone="subdued">Select all audience segments that match your store.</Text>
              <ChoiceList
                title="Target Audience"
                allowMultiple
                choices={AUDIENCE_OPTIONS}
                selected={form.targetAudience}
                onChange={(v) => updateForm('targetAudience', v)}
              />
              <Divider />
              <ChoiceList
                title="Target Countries"
                allowMultiple
                choices={COUNTRY_OPTIONS}
                selected={form.targetCountries}
                onChange={(v) => updateForm('targetCountries', v)}
              />
            </BlockStack>
          </Card>
        )}

        {/* Step 2: Product Preferences */}
        {step === 2 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Product Preferences</Text>

              <Text as="p" variant="bodyMd" fontWeight="semibold">Preferred Categories</Text>
              <InlineStack gap="200" wrap>
                {CATEGORY_OPTIONS.map((cat) => (
                  <Button
                    key={cat}
                    variant={form.preferredCategories.includes(cat) ? 'primary' : 'secondary'}
                    size="slim"
                    onClick={() => {
                      const cats = form.preferredCategories.includes(cat)
                        ? form.preferredCategories.filter((c) => c !== cat)
                        : [...form.preferredCategories, cat];
                      updateForm('preferredCategories', cats);
                    }}
                  >
                    {cat}
                  </Button>
                ))}
              </InlineStack>

              <Divider />

              <Text as="p" variant="bodyMd" fontWeight="semibold">Banned Categories (products to avoid)</Text>
              <InlineStack gap="200" wrap>
                {['Kitchen & Home', 'Pet Products', 'Fitness & Wellness', 'Car Accessories', 'Stationery'].map((cat) => (
                  <Button
                    key={cat}
                    variant={form.bannedCategories.includes(cat) ? 'tertiary' : 'secondary'}
                    size="slim"
                    tone={form.bannedCategories.includes(cat) ? 'critical' : undefined}
                    onClick={() => {
                      const cats = form.bannedCategories.includes(cat)
                        ? form.bannedCategories.filter((c) => c !== cat)
                        : [...form.bannedCategories, cat];
                      updateForm('bannedCategories', cats);
                    }}
                  >
                    {form.bannedCategories.includes(cat) ? '✕ ' : ''}{cat}
                  </Button>
                ))}
              </InlineStack>

              <Divider />

              <Text as="p" variant="bodyMd" fontWeight="semibold">
                Price Range: ${form.priceRangeMin} – ${form.priceRangeMax}
              </Text>
              <RangeSlider
                label="Min Price"
                value={form.priceRangeMin}
                onChange={(v) => updateForm('priceRangeMin', v)}
                min={5}
                max={200}
                output
              />
              <RangeSlider
                label="Max Price"
                value={form.priceRangeMax}
                onChange={(v) => updateForm('priceRangeMax', v)}
                min={20}
                max={500}
                output
              />
            </BlockStack>
          </Card>
        )}

        {/* Step 3: Business Rules */}
        {step === 3 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Business Rules</Text>

              <RangeSlider
                label={`Minimum Margin: ${form.minimumMarginPercent}%`}
                value={form.minimumMarginPercent}
                onChange={(v) => updateForm('minimumMarginPercent', v)}
                min={10}
                max={80}
                output
              />

              <Select
                label="Desired Shipping Speed"
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

        {/* Step 4: Replacement Mode */}
        {step === 4 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Replacement Mode</Text>
              <Text as="p" tone="subdued">
                How should FlexHunter handle underperforming products?
              </Text>

              <ChoiceList
                title="Replacement Strategy"
                choices={[
                  {
                    label: 'Manual – I review and approve every replacement',
                    value: 'MANUAL',
                    helpText: 'Full control. The app suggests replacements, you decide.',
                  },
                  {
                    label: 'Automatic – Replace products when thresholds are met',
                    value: 'AUTOMATIC',
                    helpText: 'Hands-off. Products are auto-replaced based on your rules.',
                  },
                  {
                    label: 'Hybrid – Auto-replace high-confidence, ask me for the rest',
                    value: 'HYBRID',
                    helpText: 'Best of both. Strong matches auto-replace, uncertain ones need approval.',
                  },
                ]}
                selected={[form.replacementMode]}
                onChange={(v) => updateForm('replacementMode', v[0])}
              />
            </BlockStack>
          </Card>
        )}

        {/* Navigation */}
        <InlineStack align="space-between">
          <Button
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              variant="primary"
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
            >
              Complete Setup & Start Hunting
            </Button>
          )}
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
