import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Select, TextField,
  Checkbox, Button, Banner, Divider, RangeSlider, ChoiceList,
} from '@shopify/polaris';
import { useApi } from '../hooks/useApi';

export function SettingsPage() {
  const { data: settings, get, loading } = useApi<any>();
  const { put, loading: saving, error } = useApi();
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { get('/settings'); }, [get]);
  useEffect(() => { if (settings) setForm({ ...settings }); }, [settings]);

  const updateForm = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!form) return;
    const { id, shopId, createdAt, updatedAt, ...data } = form;
    await put('/settings', data);
    setSaved(true);
  };

  if (loading || !form) {
    return <Page title="Settings"><Card><Text as="p">Loading...</Text></Card></Page>;
  }

  return (
    <Page
      title="Automation Settings"
      primaryAction={{ content: 'Save Settings', onAction: handleSave, loading: saving }}
    >
      <BlockStack gap="600">
        {saved && <Banner title="Settings saved" tone="success" onDismiss={() => setSaved(false)} />}
        {error && <Banner title="Error" tone="critical"><Text as="p">{error}</Text></Banner>}

        {/* Replacement Mode */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Replacement Mode</Text>
            <ChoiceList
              title="How should replacements be handled?"
              choices={[
                { label: 'Manual – I approve every replacement', value: 'MANUAL' },
                { label: 'Automatic – Auto-replace when thresholds are met', value: 'AUTOMATIC' },
                { label: 'Hybrid – Auto for high confidence, manual for the rest', value: 'HYBRID' },
              ]}
              selected={[form.replacementMode]}
              onChange={(v) => updateForm('replacementMode', v[0])}
            />
          </BlockStack>
        </Card>

        {/* Test & Evaluation Rules */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Test & Evaluation Rules</Text>

            <RangeSlider
              label={`Minimum test days: ${form.minTestDays}`}
              value={form.minTestDays}
              onChange={(v) => updateForm('minTestDays', v)}
              min={3}
              max={30}
              output
            />

            <RangeSlider
              label={`Minimum test views: ${form.minTestViews}`}
              value={form.minTestViews}
              onChange={(v) => updateForm('minTestViews', v)}
              min={10}
              max={500}
              step={10}
              output
            />

            <RangeSlider
              label={`Minimum margin: ${form.minimumMarginPercent}%`}
              value={form.minimumMarginPercent}
              onChange={(v) => updateForm('minimumMarginPercent', v)}
              min={10}
              max={80}
              output
            />
          </BlockStack>
        </Card>

        {/* Safety Thresholds */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Safety & Confidence</Text>

            <RangeSlider
              label={`Confidence threshold: ${(form.confidenceThreshold * 100).toFixed(0)}%`}
              value={form.confidenceThreshold * 100}
              onChange={(v) => updateForm('confidenceThreshold', (v as number) / 100)}
              min={30}
              max={95}
              output
            />

            {form.replacementMode === 'HYBRID' && (
              <RangeSlider
                label={`Auto-approve threshold: ${(form.approvalThreshold * 100).toFixed(0)}%`}
                value={form.approvalThreshold * 100}
                onChange={(v) => updateForm('approvalThreshold', (v as number) / 100)}
                min={50}
                max={99}
                output
              />
            )}

            <TextField
              label="Revenue protection threshold ($)"
              type="number"
              value={String(form.revenueProtection)}
              onChange={(v) => updateForm('revenueProtection', parseFloat(v))}
              helpText="Products earning above this amount require approval before replacement"
              autoComplete="off"
            />

            <Divider />

            <Checkbox
              label="Auto-archive replaced products"
              checked={form.autoArchiveOld}
              onChange={(v) => updateForm('autoArchiveOld', v)}
            />
            <Checkbox
              label="Notify me before auto-replacements"
              checked={form.notifyBeforeReplace}
              onChange={(v) => updateForm('notifyBeforeReplace', v)}
            />
            <Checkbox
              label="Never auto-replace pinned products"
              checked={form.neverReplacePinned}
              onChange={(v) => updateForm('neverReplacePinned', v)}
            />
            <Checkbox
              label="Require approval for the first replacement"
              checked={form.approveFirstReplace}
              onChange={(v) => updateForm('approveFirstReplace', v)}
            />
          </BlockStack>
        </Card>

        {/* Research Settings */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Research Settings</Text>

            <Checkbox
              label="Enable automatic research"
              checked={form.autoResearchEnabled}
              onChange={(v) => updateForm('autoResearchEnabled', v)}
            />

            <RangeSlider
              label={`Research frequency: every ${form.researchFrequencyDays} days`}
              value={form.researchFrequencyDays}
              onChange={(v) => updateForm('researchFrequencyDays', v)}
              min={1}
              max={14}
              output
            />

            <RangeSlider
              label={`Max candidates per run: ${form.maxCandidatesPerRun}`}
              value={form.maxCandidatesPerRun}
              onChange={(v) => updateForm('maxCandidatesPerRun', v)}
              min={10}
              max={100}
              step={5}
              output
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
