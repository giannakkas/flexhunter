import React, { useEffect, useState } from 'react';
import {
  Page, Card, BlockStack, Text, Badge, Button, InlineStack,
  Banner, Spinner, Divider, InlineGrid, TextField, Tabs,
} from '@shopify/polaris';

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

function ApiStatusDot({ rate }: { rate: number }) {
  const c = rate === 0 ? '#10B981' : rate < 5 ? '#F59E0B' : '#EF4444';
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 6 }} />;
}

export function AdminPage() {
  const [secret, setSecret] = useState(localStorage.getItem('admin_secret') || '');
  const [authed, setAuthed] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [apiMetrics, setApiMetrics] = useState<any>(null);
  const [apiHealth, setApiHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  const headers = () => ({ [ADMIN_KEY]: secret });

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, sh, st, am, ah] = await Promise.all([
        fetch('/api/admin/overview', { headers: headers() }).then(r => r.json()),
        fetch('/api/admin/shops', { headers: headers() }).then(r => r.json()),
        fetch('/api/admin/stats', { headers: headers() }).then(r => r.json()),
        fetch('/api/admin/api-metrics', { headers: headers() }).then(r => r.json()),
        fetch('/api/admin/api-health', { headers: headers() }).then(r => r.json()),
      ]);
      if (ov.error) throw new Error(ov.error);
      setOverview(ov); setShops(sh.shops || []); setStats(st); setApiMetrics(am); setApiHealth(ah);
      setAuthed(true);
      localStorage.setItem('admin_secret', secret);
    } catch (e: any) { setError(e.message); setAuthed(false); }
    setLoading(false);
  };

  // Auto-refresh every 30s
  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [authed]);

  const adminAction = async (path: string, label: string) => {
    setActionMsg(`Running ${label}...`);
    try {
      const r = await fetch(`/api/admin${path}`, { method: 'POST', headers: headers() }).then(r => r.json());
      setActionMsg(`✅ ${label}: ${JSON.stringify(r.result || r).slice(0, 100)}`);
      fetchAll();
    } catch (e: any) { setActionMsg(`❌ ${label}: ${e.message}`); }
  };

  const exportCsv = (type: string) => window.open(`/api/admin/export/${type}?secret=${encodeURIComponent(secret)}`);

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
  const ov = apiMetrics?.overview || {};
  const endpoints = apiMetrics?.endpoints || [];
  const extApis = apiMetrics?.externalApis || [];
  const recentApiErrors = apiMetrics?.recentErrors || [];

  const tabs = [
    { id: 'overview', content: '📊 Overview' },
    { id: 'apis', content: '🔌 API Monitor' },
    { id: 'shops', content: '🏪 Shops' },
    { id: 'errors', content: `⚠️ Errors (${(overview?.recentErrors?.length || 0) + recentApiErrors.length})` },
  ];

  return (
    <Page title="Admin Panel" subtitle="Platform Control Center"
      secondaryActions={[{ content: '🔄 Refresh', onAction: fetchAll }]}
    >
      <BlockStack gap="400">
        {actionMsg && <Banner tone={actionMsg.startsWith('❌') ? 'critical' : 'success'} onDismiss={() => setActionMsg(null)}><Text as="p">{actionMsg}</Text></Banner>}

        {/* System Health Row */}
        <InlineGrid columns={6} gap="200">
          <StatBox icon="🖥️" label="Uptime" value={`${Math.round((sys.uptime || 0) / 60)}m`} />
          <StatBox icon="🧠" label="Memory" value={`${sys.memoryMB || 0}MB`} />
          <StatBox icon="🤖" label="AI" value={sys.ai || '?'} color="#5C6AC4" />
          <StatBox icon="💾" label="Cache" value={sys.cache || '?'} color="#008060" />
          <StatBox icon="📡" label="RPM" value={ov.requestsPerMinute || 0} color="#3B82F6" />
          <StatBox icon="❌" label="Err Rate" value={`${ov.errorRate || 0}%`} color={ov.errorRate > 5 ? '#EF4444' : '#10B981'} />
        </InlineGrid>

        <Tabs tabs={tabs} selected={tab} onSelect={setTab}>
          {/* ── Tab 0: Overview ── */}
          {tab === 0 && (
            <BlockStack gap="400">
              <div style={{ height: 12 }} />

              {/* API & Service Health */}
              {apiHealth?.apis && (
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text as="h2" variant="headingSm">🔌 API & Service Health — Live Status</Text>
                      <InlineStack gap="200">
                        <Badge tone="success">{apiHealth.summary?.healthy || 0} Healthy</Badge>
                        {apiHealth.summary?.errors > 0 && <Badge tone="critical">{apiHealth.summary.errors} Failing</Badge>}
                        {apiHealth.summary?.notConfigured > 0 && <Badge tone="attention">{apiHealth.summary.notConfigured} Not Set</Badge>}
                      </InlineStack>
                    </InlineStack>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#F9FAFB' }}>
                            {['Service', 'Status', 'Latency', 'Details', 'Key Set'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #E5E7EB', textAlign: 'left' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {apiHealth.apis.map((api: any, i: number) => (
                            <tr key={i} style={{
                              borderBottom: '1px solid #F3F4F6',
                              background: api.status === 'error' ? '#FEF2F2' : api.status === 'not_configured' ? '#FFFBEB' : 'transparent',
                            }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{api.name}</td>
                              <td style={{ padding: '10px 12px' }}>
                                {api.status === 'healthy' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 700, fontSize: 12 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />HEALTHY</span>}
                                {api.status === 'error' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#DC2626', fontWeight: 700, fontSize: 12 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />ERROR</span>}
                                {api.status === 'not_configured' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#D97706', fontWeight: 700, fontSize: 12 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />NOT SET</span>}
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                                {api.latency > 0 ? `${api.latency}ms` : '—'}
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: 12, maxWidth: 350, color: api.status === 'error' ? '#DC2626' : '#374151' }}>
                                {api.detail}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                {api.configured ? <span style={{ color: '#10B981', fontSize: 16 }}>✓</span> : <span style={{ color: '#EF4444', fontSize: 16 }}>✗</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {apiHealth.checkedAt && (
                      <Text as="p" variant="bodySm" tone="subdued">Last checked: {new Date(apiHealth.checkedAt).toLocaleString()}</Text>
                    )}
                  </BlockStack>
                </Card>
              )}

              <InlineGrid columns={5} gap="200">
                <StatBox icon="🏪" label="Shops" value={counts.shops || 0} color="#3B82F6" />
                <StatBox icon="🔍" label="Candidates" value={counts.candidates || 0} color="#8B5CF6" />
                <StatBox icon="📦" label="Imports" value={counts.imports || 0} color="#10B981" />
                <StatBox icon="💰" label="Revenue" value={`$${(perf.totalRevenue || 0).toFixed(0)}`} color="#F59E0B" />
                <StatBox icon="📊" label="Requests 24h" value={ov.totalRequests24h || 0} color="#3B82F6" />
              </InlineGrid>

              {stats && (
                <Card>
                  <InlineStack gap="400">
                    <Badge tone="info">Today: {stats.today?.jobs || 0} jobs, {stats.today?.imports || 0} imports, {stats.today?.research || 0} research</Badge>
                    <Badge tone="attention">This week: {stats.week?.jobs || 0} jobs, {stats.week?.failed || 0} failed</Badge>
                  </InlineStack>
                </Card>
              )}

              {/* External APIs health */}
              {extApis.length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingSm">🔌 External API Status</Text>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#F9FAFB' }}>
                            {['API', 'Status', 'Calls', 'Success', 'Failures', 'Err %', 'Avg Latency', 'Last Error'].map(h => (
                              <th key={h} style={{ padding: '8px 10px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {extApis.map((api: any) => {
                            const errRate = api.calls > 0 ? (api.failures / api.calls * 100) : 0;
                            return (
                              <tr key={api.name} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{api.name}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <ApiStatusDot rate={errRate} />
                                  {errRate === 0 ? 'Healthy' : errRate < 10 ? 'Degraded' : 'Failing'}
                                </td>
                                <td style={{ padding: '8px 10px' }}>{api.calls}</td>
                                <td style={{ padding: '8px 10px', color: '#10B981', fontWeight: 600 }}>{api.successes}</td>
                                <td style={{ padding: '8px 10px', color: api.failures > 0 ? '#EF4444' : '#6B7280', fontWeight: 600 }}>{api.failures}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <Badge tone={errRate === 0 ? 'success' : errRate < 10 ? 'warning' : 'critical'}>{errRate.toFixed(1)}%</Badge>
                                </td>
                                <td style={{ padding: '8px 10px' }}>{api.avgLatency}ms</td>
                                <td style={{ padding: '8px 10px', fontSize: 11, color: '#EF4444', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{api.lastError || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          )}

          {/* ── Tab 1: API Monitor ── */}
          {tab === 1 && (
            <BlockStack gap="400">
              <div style={{ height: 12 }} />
              <InlineGrid columns={4} gap="200">
                <StatBox icon="📡" label="Total 24h" value={ov.totalRequests24h || 0} color="#3B82F6" />
                <StatBox icon="⏱️" label="Avg Latency" value={`${ov.avgLatencyMs || 0}ms`} color="#8B5CF6" />
                <StatBox icon="❌" label="Errors" value={ov.totalErrors || 0} color="#EF4444" />
                <StatBox icon="🔥" label="5xx Errors" value={ov.total5xxErrors || 0} color={ov.total5xxErrors > 0 ? '#EF4444' : '#10B981'} />
              </InlineGrid>

              {/* Status Codes */}
              {apiMetrics?.statusCodes && (
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm">HTTP Status Codes</Text>
                    <InlineStack gap="200">
                      {Object.entries(apiMetrics.statusCodes).sort().map(([code, count]: any) => {
                        const tone = parseInt(code) < 300 ? 'success' : parseInt(code) < 400 ? 'info' : parseInt(code) < 500 ? 'warning' : 'critical';
                        return <Badge key={code} tone={tone}>{code}: {count}</Badge>;
                      })}
                    </InlineStack>
                  </BlockStack>
                </Card>
              )}

              {/* Endpoints Table */}
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingSm">Endpoints ({endpoints.length})</Text>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          {['Method', 'Path', 'Requests', 'OK', 'Errors', 'Err%', 'Avg ms', 'P95 ms', 'Max ms', 'Last Called'].map(h => (
                            <th key={h} style={{ padding: '6px 8px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {endpoints.map((ep: any, i: number) => {
                          const errPct = ep.totalRequests > 0 ? (ep.errorCount / ep.totalRequests * 100) : 0;
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: errPct > 20 ? '#FEF2F2' : 'transparent' }}>
                              <td style={{ padding: '6px 8px' }}>
                                <Badge tone={ep.method === 'GET' ? 'info' : ep.method === 'POST' ? 'success' : 'attention'}>{ep.method}</Badge>
                              </td>
                              <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>{ep.path}</td>
                              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{ep.totalRequests}</td>
                              <td style={{ padding: '6px 8px', color: '#10B981' }}>{ep.successCount}</td>
                              <td style={{ padding: '6px 8px', color: ep.errorCount > 0 ? '#EF4444' : '#6B7280', fontWeight: ep.errorCount > 0 ? 700 : 400 }}>{ep.errorCount}</td>
                              <td style={{ padding: '6px 8px' }}>{errPct.toFixed(0)}%</td>
                              <td style={{ padding: '6px 8px' }}>{ep.avgDuration}</td>
                              <td style={{ padding: '6px 8px', color: ep.p95Duration > 5000 ? '#EF4444' : '#374151' }}>{ep.p95Duration}</td>
                              <td style={{ padding: '6px 8px', color: ep.maxDuration > 10000 ? '#EF4444' : '#374151' }}>{ep.maxDuration}</td>
                              <td style={{ padding: '6px 8px', fontSize: 10, color: '#6B7280' }}>{new Date(ep.lastCalledAt).toLocaleTimeString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </BlockStack>
              </Card>

              {/* Slow Endpoints */}
              {apiMetrics?.slowEndpoints?.length > 0 && (
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm">🐌 Slow Endpoints (P95 &gt; 1s)</Text>
                    {apiMetrics.slowEndpoints.map((ep: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <Text as="span" variant="bodySm"><Badge>{ep.method}</Badge> {ep.path}</Text>
                        <InlineStack gap="200">
                          <Badge tone="warning">P95: {ep.p95Duration}ms</Badge>
                          <Badge tone="critical">Max: {ep.maxDuration}ms</Badge>
                        </InlineStack>
                      </div>
                    ))}
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          )}

          {/* ── Tab 2: Shops ── */}
          {tab === 2 && (
            <BlockStack gap="400">
              <div style={{ height: 12 }} />
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingSm">Shops ({shops.length})</Text>
                    <InlineStack gap="200">
                      <Button size="slim" onClick={() => exportCsv('shops')}>📄 Shops</Button>
                      <Button size="slim" onClick={() => exportCsv('candidates')}>📄 Candidates</Button>
                      <Button size="slim" onClick={() => exportCsv('imports')}>📄 Imports</Button>
                    </InlineStack>
                  </InlineStack>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
                          {['Domain', 'Status', 'Token', 'Candidates', 'Imports', 'Description', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shops.map(s => (
                          <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.domain}</td>
                            <td style={{ padding: '8px 12px' }}><Badge tone={s.isActive ? 'success' : 'critical'}>{s.isActive ? 'Active' : 'Off'}</Badge></td>
                            <td style={{ padding: '8px 12px' }}><Badge tone={s.hasToken ? 'success' : 'warning'}>{s.hasToken ? '✓' : '✗'}</Badge></td>
                            <td style={{ padding: '8px 12px' }}>{s.counts?.candidateProducts || 0}</td>
                            <td style={{ padding: '8px 12px' }}>{s.counts?.importedProducts || 0}</td>
                            <td style={{ padding: '8px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description || '—'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <InlineStack gap="200">
                                <Button size="slim" onClick={() => adminAction(`/shops/${s.id}/research`, 'Research')}>🔬</Button>
                                <Button size="slim" onClick={() => adminAction(`/shops/${s.id}/sync`, 'Sync')}>📊</Button>
                                <Button size="slim" onClick={() => adminAction(`/shops/${s.id}/replacement-scan`, 'Replace')}>🔄</Button>
                              </InlineStack>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BlockStack>
              </Card>
            </BlockStack>
          )}

          {/* ── Tab 3: Errors ── */}
          {tab === 3 && (
            <BlockStack gap="400">
              <div style={{ height: 12 }} />

              {/* API Request Errors */}
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingSm">🔴 API Request Errors ({recentApiErrors.length})</Text>
                  {recentApiErrors.length === 0 ? (
                    <Text as="p" variant="bodySm" tone="subdued">No API errors in the last 24 hours</Text>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#FEF2F2' }}>
                            {['Method', 'Path', 'Status', 'Duration', 'Error', 'Time'].map(h => (
                              <th key={h} style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid #FECACA', textAlign: 'left' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recentApiErrors.map((e: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid #FEF2F2' }}>
                              <td style={{ padding: '6px 8px' }}><Badge>{e.method}</Badge></td>
                              <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>{e.path}</td>
                              <td style={{ padding: '6px 8px' }}><Badge tone="critical">{e.status}</Badge></td>
                              <td style={{ padding: '6px 8px' }}>{e.duration}ms</td>
                              <td style={{ padding: '6px 8px', color: '#EF4444', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.error}</td>
                              <td style={{ padding: '6px 8px', fontSize: 10 }}>{new Date(e.timestamp).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </BlockStack>
              </Card>

              {/* Job Errors */}
              {overview?.recentErrors?.length > 0 && (
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm">🟠 Job Errors ({overview.recentErrors.length})</Text>
                    {overview.recentErrors.map((e: any) => (
                      <div key={e.id} style={{ padding: '8px 12px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA' }}>
                        <InlineStack align="space-between">
                          <Badge tone="warning">{e.jobType}</Badge>
                          <Text as="p" variant="bodySm" tone="subdued">{new Date(e.createdAt).toLocaleString()}</Text>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="critical">{e.error?.slice(0, 200)}</Text>
                      </div>
                    ))}
                  </BlockStack>
                </Card>
              )}

              {/* External API Errors */}
              {extApis.filter((a: any) => a.failures > 0).length > 0 && (
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm">🔌 External API Failures</Text>
                    {extApis.filter((a: any) => a.failures > 0).map((api: any) => (
                      <div key={api.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA' }}>
                        <div>
                          <Text as="p" variant="bodySm" fontWeight="bold">{api.name}</Text>
                          <Text as="p" variant="bodySm" tone="critical">Last error: {api.lastError}</Text>
                        </div>
                        <InlineStack gap="200">
                          <Badge tone="critical">{api.failures} failures</Badge>
                          <Badge tone="success">{api.successes} ok</Badge>
                        </InlineStack>
                      </div>
                    ))}
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          )}
        </Tabs>

        {/* Recent Jobs footer */}
        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingSm">Recent Jobs</Text>
              <Button size="slim" onClick={() => adminAction('/cache/flush', 'Flush Cache')}>🗑️ Flush Cache</Button>
            </InlineStack>
            {(overview?.recentJobs || []).slice(0, 8).map((j: any) => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F3F4F6', fontSize: 12 }}>
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
