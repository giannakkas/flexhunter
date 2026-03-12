import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  Banner, Spinner, Divider, InlineGrid, TextField,
} from '@shopify/polaris';
import { apiFetch } from '../hooks/useApi';

const ADMIN_KEY = 'x-admin-secret';

function StatBox({ label, value, color = '#111', icon }: { label: string; value: any; color?: string; icon: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, background: '#FAFBFC', border: '1px solid #E5E7EB', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

export function AdminPage() {
  const [secret, setSecret] = useState(localStorage.getItem('admin_secret') || '');
  const [authed, setAuthed] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<any>(null);

  const headers = () => ({ [ADMIN_KEY]: secret });

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, sh, st] = await Promise.all([
        fetch('/api/admin/overview', { headers: headers() }).then(r => r.json()),
        fetch('/api/admin/shops', { headers: headers() }).then(r => r.json()),
        fetch('/api/admin/stats', { headers: headers() }).then(r => r.json()),
      ]);
      if (ov.error) throw new Error(ov.error);
      setOverview(ov);
      setShops(sh.shops || []);
      setStats(st);
      setAuthed(true);
      localStorage.setItem('admin_secret', secret);
    } catch (e: any) {
      setError(e.message);
      setAuthed(false);
    }
    setLoading(false);
  };

  const adminAction = async (path: string, label: string) => {
    setActionMsg(`Running ${label}...`);
    try {
      const r = await fetch(`/api/admin${path}`, { method: 'POST', headers: headers() }).then(r => r.json());
      setActionMsg(`✅ ${label} complete: ${JSON.stringify(r.result || r).slice(0, 100)}`);
      fetchAll();
    } catch (e: any) {
      setActionMsg(`❌ ${label} failed: ${e.message}`);
    }
  };

  const exportCsv = (type: string) => {
    window.open(`/api/admin/export/${type}?secret=${encodeURIComponent(secret)}`);
  };

  // Login screen
  if (!authed) {
    return (
      <Page title="Admin Panel">
        <div style={{ maxWidth: 400, margin: '80px auto' }}>
          <Card>
            <BlockStack gap="400">
              <div style={{ textAlign: 'center', fontSize: 48 }}>🔐</div>
              <Text as="h2" variant="headingMd" alignment="center">Admin Access</Text>
              <TextField label="Admin Secret" value={secret} onChange={setSecret} type="password" autoComplete="off" />
              {error && <Banner tone="critical"><Text as="p">{error}</Text></Banner>}
              <Button variant="primary" fullWidth onClick={fetchAll} loading={loading}>Login</Button>
            </BlockStack>
          </Card>
        </div>
      </Page>
    );
  }

  const sys = overview?.system || {};
  const counts = overview?.counts || {};
  const perf = overview?.performance || {};

  return (
    <Page title="Admin Panel" subtitle="Platform Control Center">
      <BlockStack gap="400">
        {actionMsg && <Banner tone={actionMsg.startsWith('❌') ? 'critical' : 'success'} onDismiss={() => setActionMsg(null)}><Text as="p">{actionMsg}</Text></Banner>}

        {/* System Health */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">System Health</Text>
            <InlineGrid columns={6} gap="200">
              <StatBox icon="🖥️" label="Uptime" value={`${Math.round((sys.uptime || 0) / 60)}m`} />
              <StatBox icon="🧠" label="Memory" value={`${sys.memoryMB || 0}MB`} />
              <StatBox icon="🤖" label="AI" value={sys.ai || '?'} color="#5C6AC4" />
              <StatBox icon="💾" label="Cache" value={sys.cache || '?'} color="#008060" />
              <StatBox icon="⚙️" label="Node" value={sys.nodeVersion?.slice(0, 6) || '?'} />
              <StatBox icon="🏪" label="Active" value={counts.activeShops || 0} color="#3B82F6" />
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* Counts */}
        <InlineGrid columns={5} gap="200">
          <StatBox icon="🏪" label="Total Shops" value={counts.shops || 0} color="#3B82F6" />
          <StatBox icon="🔍" label="Candidates" value={counts.candidates || 0} color="#8B5CF6" />
          <StatBox icon="📦" label="Imports" value={counts.imports || 0} color="#10B981" />
          <StatBox icon="💰" label="Revenue" value={`$${(perf.totalRevenue || 0).toFixed(0)}`} color="#F59E0B" />
          <StatBox icon="🛒" label="Orders" value={perf.totalOrders || 0} color="#10B981" />
        </InlineGrid>

        {/* Activity Stats */}
        {stats && (
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">Activity</Text>
              <InlineStack gap="400">
                <Badge tone="info">Today: {stats.today?.jobs || 0} jobs, {stats.today?.imports || 0} imports, {stats.today?.research || 0} research</Badge>
                <Badge tone="attention">This week: {stats.week?.jobs || 0} jobs, {stats.week?.failed || 0} failed</Badge>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* Shops */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingSm">Shops ({shops.length})</Text>
              <InlineStack gap="200">
                <Button size="slim" onClick={() => exportCsv('shops')}>📄 Export Shops</Button>
                <Button size="slim" onClick={() => exportCsv('candidates')}>📄 Export Candidates</Button>
                <Button size="slim" onClick={() => exportCsv('imports')}>📄 Export Imports</Button>
              </InlineStack>
            </InlineStack>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
                    {['Domain', 'Status', 'Token', 'Candidates', 'Imports', 'Description', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shops.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.domain}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <Badge tone={s.isActive ? 'success' : 'critical'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Badge tone={s.hasToken ? 'success' : 'warning'}>{s.hasToken ? 'Yes' : 'No'}</Badge>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{s.counts?.candidateProducts || 0}</td>
                      <td style={{ padding: '8px 12px' }}>{s.counts?.importedProducts || 0}</td>
                      <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <InlineStack gap="200">
                          <Button size="slim" onClick={() => adminAction(`/shops/${s.id}/research`, 'Research')}>🔬</Button>
                          <Button size="slim" onClick={() => adminAction(`/shops/${s.id}/sync`, 'Sync')}>📊</Button>
                          <Button size="slim" onClick={() => adminAction(`/shops/${s.id}/replacement-scan`, 'Scan')}>🔄</Button>
                        </InlineStack>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BlockStack>
        </Card>

        {/* Recent Errors */}
        {overview?.recentErrors?.length > 0 && (
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">⚠️ Recent Errors ({overview.recentErrors.length})</Text>
              {overview.recentErrors.slice(0, 5).map((e: any) => (
                <div key={e.id} style={{ padding: '8px 12px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA' }}>
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodySm" fontWeight="bold">{e.jobType}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">{new Date(e.createdAt).toLocaleString()}</Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="critical">{e.error?.slice(0, 150)}</Text>
                </div>
              ))}
            </BlockStack>
          </Card>
        )}

        {/* Recent Jobs */}
        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingSm">Recent Jobs</Text>
              <Button size="slim" onClick={() => adminAction('/cache/flush', 'Flush Cache')}>🗑️ Flush Cache</Button>
            </InlineStack>
            {(overview?.recentJobs || []).map((j: any) => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 12 }}>
                <InlineStack gap="200">
                  <Badge tone={j.status === 'COMPLETED' ? 'success' : j.status === 'FAILED' ? 'critical' : 'info'}>{j.status}</Badge>
                  <Text as="span" variant="bodySm">{j.jobType}</Text>
                </InlineStack>
                <Text as="span" variant="bodySm" tone="subdued">{new Date(j.createdAt).toLocaleString()}</Text>
              </div>
            ))}
          </BlockStack>
        </Card>

        <div style={{ height: 80 }} />
      </BlockStack>
    </Page>
  );
}
