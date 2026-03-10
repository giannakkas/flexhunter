import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Select, TextField,
  Checkbox, Button, Banner, Divider, RangeSlider, ChoiceList,
  EmptyState,
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useApi, apiFetch } from '../hooks/useApi';

export function SettingsPage() {
  const navigate = useNavigate();
  const { data: settings, get, loading } = useApi<any>();
  const { put, loading: saving, error } = useApi();
  const { post: resetPost } = useApi();
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { get('/settings'); }, [get]);
  useEffect(() => { if (settings) setForm({ ...settings }); }, [settings]);

  const updateForm = (key: string, value: any) => {
    setForm((prev: any) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!form) return;
    const { id, shopId, createdAt, updatedAt, ...data } = form;
    await put('/settings', data);
    setSaved(true);
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure? This will reset all settings and restart onboarding.')) return;
    await put('/settings', { onboardingComplete: false });
    navigate('/onboarding');
  };

  if (loading) {
    return <Page title="Settings"><Card><Text as="p">Loading settings...</Text></Card></Page>;
  }

  // No settings yet = not onboarded
  if (!form) {
    return (
      <Page title="Settings">
        <Card>
          <EmptyState
            heading="Complete setup first"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            action={{ content: 'Go to Setup', onAction: () => navigate('/onboarding') }}
          >
            <Text as="p">Complete the onboarding wizard to configure your settings.</Text>
          </EmptyState>
        </Card>
      </Page>
    );
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
                { label: 'Manual \u2013 I approve every replacement', value: 'MANUAL' },
                { label: 'Automatic \u2013 Auto-replace when thresholds are met', value: 'AUTOMATIC' },
                { label: 'Hybrid \u2013 Auto for high confidence, manual for the rest', value: 'HYBRID' },
              ]}
              selected={[form.replacementMode]}
              onChange={(v) => updateForm('replacementMode', v[0])}
            />
          </BlockStack>
        </Card>

        {/* Test Rules */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Test & Evaluation Rules</Text>

            <RangeSlider
              label={`Minimum test days: ${form.minTestDays}`}
              value={form.minTestDays}
              onChange={(v) => updateForm('minTestDays', v)}
              min={3} max={30} output
            />
            <RangeSlider
              label={`Minimum test views: ${form.minTestViews}`}
              value={form.minTestViews}
              onChange={(v) => updateForm('minTestViews', v)}
              min={10} max={500} step={10} output
            />
            <RangeSlider
              label={`Minimum margin: ${form.minimumMarginPercent}%`}
              value={form.minimumMarginPercent}
              onChange={(v) => updateForm('minimumMarginPercent', v)}
              min={10} max={80} output
            />
          </BlockStack>
        </Card>

        {/* Safety */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Safety & Confidence</Text>

            <RangeSlider
              label={`Confidence threshold: ${(form.confidenceThreshold * 100).toFixed(0)}%`}
              value={form.confidenceThreshold * 100}
              onChange={(v) => updateForm('confidenceThreshold', (v as number) / 100)}
              min={30} max={95} output
            />

            {form.replacementMode === 'HYBRID' && (
              <RangeSlider
                label={`Auto-approve threshold: ${(form.approvalThreshold * 100).toFixed(0)}%`}
                value={form.approvalThreshold * 100}
                onChange={(v) => updateForm('approvalThreshold', (v as number) / 100)}
                min={50} max={99} output
              />
            )}

            <TextField
              label="Revenue protection threshold ($)"
              type="number"
              value={String(form.revenueProtection)}
              onChange={(v) => updateForm('revenueProtection', parseFloat(v))}
              helpText="Products earning above this require approval"
              autoComplete="off"
            />

            <Divider />

            <Checkbox label="Auto-archive replaced products" checked={form.autoArchiveOld} onChange={(v) => updateForm('autoArchiveOld', v)} />
            <Checkbox label="Notify me before auto-replacements" checked={form.notifyBeforeReplace} onChange={(v) => updateForm('notifyBeforeReplace', v)} />
            <Checkbox label="Never auto-replace pinned products" checked={form.neverReplacePinned} onChange={(v) => updateForm('neverReplacePinned', v)} />
            <Checkbox label="Require approval for first replacement" checked={form.approveFirstReplace} onChange={(v) => updateForm('approveFirstReplace', v)} />
          </BlockStack>
        </Card>

        {/* Research */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Research Settings</Text>

            <Checkbox label="Enable automatic research" checked={form.autoResearchEnabled} onChange={(v) => updateForm('autoResearchEnabled', v)} />
            <RangeSlider
              label={`Research frequency: every ${form.researchFrequencyDays} days`}
              value={form.researchFrequencyDays}
              onChange={(v) => updateForm('researchFrequencyDays', v)}
              min={1} max={14} output
            />
            <RangeSlider
              label={`Max candidates per run: ${form.maxCandidatesPerRun}`}
              value={form.maxCandidatesPerRun}
              onChange={(v) => updateForm('maxCandidatesPerRun', v)}
              min={10} max={100} step={5} output
            />
          </BlockStack>
        </Card>

        {/* Danger Zone */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Shopify Connection</Text>
            <Divider />
            <ShopifyTokenSetup />
          </BlockStack>
        </Card>

        {/* Reset */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd" tone="critical">Danger Zone</Text>
            <Divider />
            <Text as="p" variant="bodySm" tone="subdued">
              Reset all settings and start the onboarding wizard again. This does not delete imported products.
            </Text>
            <Button tone="critical" onClick={handleReset}>
              Reset Settings & Start Over
            </Button>
          </BlockStack>
        </Card>

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}

function ShopifyTokenSetup() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<any>('/shop-status').then(r => setStatus(r.data)).catch(() => {});
  }, [saved]);

  const handleSave = async () => {
    if (!token.trim()) return;
    await apiFetch('/setup-token', { method: 'POST', body: JSON.stringify({ accessToken: token }) });
    setSaved(true);
    setToken('');
  };

  if (status?.hasToken && saved) {
    return (
      <Banner tone="success">
        <Text as="p">Connected to <strong>{status.domain}</strong>. Products will now import directly to your Shopify store.</Text>
      </Banner>
    );
  }

  if (status?.hasToken && !saved) {
    return (
      <BlockStack gap="300">
        <Banner tone="success">
          <Text as="p">Connected to <strong>{status.domain}</strong>. Imports create real Shopify products.</Text>
        </Banner>
        <Button variant="plain" onClick={() => setSaved(false)}>Update token</Button>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="400">
      <Banner tone="critical">
        <Text as="p">Not connected. Products won't appear in your Shopify store until you complete the setup below.</Text>
      </Banner>

      <div style={{ padding: '20px', background: '#FAFBFC', borderRadius: 10, border: '1px solid #E4E5E7' }}>
        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">Quick Setup (2 minutes)</Text>

          <BlockStack gap="200">
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#5C6AC4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>1</div>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd" fontWeight="semibold">Open your store's app settings</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Go to: <strong>Shopify Admin → Settings → Apps and sales channels → Develop apps</strong>
                </Text>
                <Button size="slim" url={`https://admin.shopify.com/store/${(status?.domain || '').replace('.myshopify.com', '')}/settings/apps/development`} external>
                  Open App Settings
                </Button>
              </BlockStack>
            </div>

            <Divider />

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#5C6AC4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>2</div>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd" fontWeight="semibold">Create a new app called "FlexHunter"</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Click "Create an app" → name it "FlexHunter" → click Create
                </Text>
              </BlockStack>
            </div>

            <Divider />

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#5C6AC4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>3</div>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd" fontWeight="semibold">Configure API scopes</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Click "Configure Admin API scopes" → check <strong>write_products</strong> and <strong>read_products</strong> → Save
                </Text>
              </BlockStack>
            </div>

            <Divider />

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#5C6AC4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>4</div>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd" fontWeight="semibold">Install the app and copy the token</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Click "Install app" → click "Reveal token once" → copy the Admin API access token
                </Text>
              </BlockStack>
            </div>

            <Divider />

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#008060', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>5</div>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd" fontWeight="semibold">Paste the token here</Text>
                <TextField
                  label="" labelHidden
                  value={token} onChange={setToken}
                  placeholder="shpat_xxxxx..."
                  autoComplete="off"
                />
                <Button variant="primary" onClick={handleSave} disabled={!token.trim()} fullWidth>
                  Connect Store
                </Button>
              </BlockStack>
            </div>
          </BlockStack>
        </BlockStack>
      </div>

      {saved && <Banner tone="success" onDismiss={() => setSaved(false)}><Text as="p">Token saved! Products will now import to Shopify.</Text></Banner>}
    </BlockStack>
  );
}
