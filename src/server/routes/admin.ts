// ==============================================
// Admin API — Platform Control Panel
// ==============================================
// Protected by ADMIN_SECRET env var.
// Gives full visibility + control over all shops,
// research, imports, system health, and automation.

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import cache from '../utils/cache';
import logger from '../utils/logger';
import { getApiMetrics, getApiTimeline } from '../middleware/apiMetrics';

const router = Router();

// ── Auth middleware ────────────────────────────
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(503).json({ error: 'ADMIN_SECRET not configured' });

  const token = req.headers['x-admin-secret'] || req.query.secret;
  if (token !== secret) {
    logger.warn('Admin auth failed', { ip: req.ip, path: req.path });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(adminAuth);

// ── System Overview ───────────────────────────
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const [shops, candidates, imports, jobs, replacements] = await Promise.all([
      prisma.shop.count(),
      prisma.candidateProduct.count(),
      prisma.importedProduct.count(),
      prisma.jobRun.count(),
      prisma.replacementDecision.count(),
    ]);

    const activeShops = await prisma.shop.count({ where: { isActive: true } });
    const recentJobs = await prisma.jobRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, shopId: true, jobType: true, status: true, createdAt: true, completedAt: true, error: true },
    });

    const recentErrors = await prisma.jobRun.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, shopId: true, jobType: true, error: true, createdAt: true },
    });

    const perfAgg = await prisma.productPerformance.aggregate({
      _sum: { revenue: true, conversions: true },
      _avg: { healthScore: true },
    });

    res.json({
      system: {
        version: '2.0.0',
        uptime: Math.round(process.uptime()),
        cache: cache.isRedisAvailable() ? 'redis' : 'memory',
        ai: process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'none',
        nodeVersion: process.version,
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      counts: { shops, activeShops, candidates, imports, jobs, replacements },
      performance: {
        totalRevenue: perfAgg._sum.revenue || 0,
        totalOrders: perfAgg._sum.conversions || 0,
        avgHealthScore: Math.round(perfAgg._avg.healthScore || 0),
      },
      recentJobs,
      recentErrors,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── All Shops ─────────────────────────────────
router.get('/shops', async (_req: Request, res: Response) => {
  try {
    const shops = await prisma.shop.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            candidateProducts: true,
            importedProducts: true,
            replacementDecisions: true,
          },
        },
        settings: { select: { storeDescription: true, onboardingComplete: true } },
      },
    });

    res.json({
      shops: shops.map(s => ({
        id: s.id,
        domain: s.shopDomain,
        name: s.name,
        email: s.email,
        isActive: s.isActive,
        hasToken: !!s.accessToken && s.accessToken !== 'pending',
        plan: s.plan,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        onboarded: s.settings?.onboardingComplete || false,
        description: s.settings?.storeDescription || '',
        counts: s._count,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Shop Detail ───────────────────────────────
router.get('/shops/:id', async (req: Request, res: Response) => {
  try {
    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        settings: true,
        storeProfile: true,
        candidateProducts: { take: 10, orderBy: { createdAt: 'desc' }, include: { score: true } },
        importedProducts: { take: 10, orderBy: { importedAt: 'desc' }, include: { performance: true } },
        jobRuns: { take: 10, orderBy: { createdAt: 'desc' } },
        auditLogs: { take: 20, orderBy: { createdAt: 'desc' } },
      },
    });
    res.json({ shop });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trigger Research for a Shop ───────────────
router.post('/shops/:id/research', async (req: Request, res: Response) => {
  try {
    const shopId = req.params.id;
    logger.info('Admin triggered research', { shopId });
    const { runResearchPipeline } = await import('../services/research/researchPipeline');
    const result = await runResearchPipeline(shopId);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trigger Performance Sync ──────────────────
router.post('/shops/:id/sync', async (req: Request, res: Response) => {
  try {
    const shopId = req.params.id;
    logger.info('Admin triggered sync', { shopId });
    const { syncPerformance } = await import('../services/performance/performanceSync');
    const result = await syncPerformance(shopId);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trigger Replacement Scan ──────────────────
router.post('/shops/:id/replacement-scan', async (req: Request, res: Response) => {
  try {
    const shopId = req.params.id;
    const { scanForReplacements } = await import('../services/replacement/autoReplace');
    const result = await scanForReplacements(shopId);
    res.json({ success: true, suggestions: result.length, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── All Jobs ──────────────────────────────────
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { status, type, limit = '50' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.jobType = type;

    const jobs = await prisma.jobRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });
    res.json({ jobs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── System Stats ──────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [jobsToday, jobsWeek, importsToday, researchToday] = await Promise.all([
      prisma.jobRun.count({ where: { createdAt: { gte: day } } }),
      prisma.jobRun.count({ where: { createdAt: { gte: week } } }),
      prisma.importedProduct.count({ where: { importedAt: { gte: day } } }),
      prisma.jobRun.count({ where: { createdAt: { gte: day }, jobType: 'RESEARCH_PRODUCTS' } }),
    ]);

    const failedJobs = await prisma.jobRun.count({ where: { status: 'FAILED', createdAt: { gte: week } } });

    res.json({
      today: { jobs: jobsToday, imports: importsToday, research: researchToday },
      week: { jobs: jobsWeek, failed: failedJobs },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CSV Export ─────────────────────────────────
router.get('/export/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { shopId } = req.query;
    let csv = '';

    if (type === 'candidates') {
      const items = await prisma.candidateProduct.findMany({
        where: shopId ? { shopId: shopId as string } : {},
        include: { score: true },
        take: 1000,
      });
      csv = 'Title,Category,Source,Cost,Price,Score,Status\n';
      csv += items.map(i => `"${i.title.replace(/"/g, '""')}","${i.category}","${i.sourceName}",${i.costPrice},${i.suggestedPrice},${i.score?.finalScore || 0},${i.status}`).join('\n');
    } else if (type === 'imports') {
      const items = await prisma.importedProduct.findMany({
        where: shopId ? { shopId: shopId as string } : {},
        include: { performance: true },
        take: 1000,
      });
      csv = 'Title,Price,Status,Orders,Revenue,HealthScore,ImportedAt\n';
      csv += items.map(i => `"${i.importedTitle.replace(/"/g, '""')}",${i.importedPrice},${i.status},${i.performance?.orders || 0},${i.performance?.revenue || 0},${i.performance?.healthScore || 0},${i.importedAt.toISOString()}`).join('\n');
    } else if (type === 'shops') {
      const items = await prisma.shop.findMany({ include: { _count: { select: { importedProducts: true, candidateProducts: true } } } });
      csv = 'Domain,Name,Active,Plan,Imports,Candidates,CreatedAt\n';
      csv += items.map(s => `"${s.shopDomain}","${s.name}",${s.isActive},${s.plan},${s._count.importedProducts},${s._count.candidateProducts},${s.createdAt.toISOString()}`).join('\n');
    } else {
      return res.status(400).json({ error: 'Type must be: candidates, imports, or shops' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=flexhunter-${type}-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin Alerts ──────────────────────────────
router.get('/alerts', async (_req: Request, res: Response) => {
  const { getAdminAlerts, getUnacknowledgedCount } = await import('../services/adminAlerts');
  const alerts = await getAdminAlerts();
  const unread = await getUnacknowledgedCount();
  res.json({ alerts, unread });
});

router.post('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
  const { acknowledgeAlert } = await import('../services/adminAlerts');
  await acknowledgeAlert(req.params.id);
  res.json({ success: true });
});

// ── Flush Cache ───────────────────────────────
router.post('/cache/flush', async (_req: Request, res: Response) => {
  await cache.invalidatePrefix('');
  logger.info('Admin flushed cache');
  res.json({ success: true, message: 'Cache flushed' });
});

// ── Deactivate Shop ───────────────────────────
router.post('/shops/:id/deactivate', async (req: Request, res: Response) => {
  try {
    await prisma.shop.update({ where: { id: req.params.id }, data: { isActive: false } });
    logger.info('Admin deactivated shop', { shopId: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Scoring Debug — inspect why a product scored the way it did ──
router.get('/scoring-trace/:candidateId', async (req: Request, res: Response) => {
  try {
    const candidate = await prisma.candidateProduct.findUniqueOrThrow({
      where: { id: req.params.candidateId },
      include: { score: true },
    });
    const { getSignals } = await import('../services/signals');
    const signals = await getSignals(candidate.shopId, candidate.id);

    res.json({
      candidate: { id: candidate.id, title: candidate.title, category: candidate.category },
      score: candidate.score,
      signals: signals || 'No signals stored — run research again',
      weights: (await import('../services/signals/feedbackLoop')).DEFAULT_WEIGHTS,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Feedback Loop — recalibrate weights for a shop ──
router.post('/shops/:id/recalibrate', async (req: Request, res: Response) => {
  try {
    const { recalibrateWeights } = await import('../services/signals/feedbackLoop');
    const result = await recalibrateWeights(req.params.id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Config Status ──
router.get('/config', (_req: Request, res: Response) => {
  const { configStatus } = require('../config');
  res.json({
    ...configStatus,
    env: {
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      RAPIDAPI_KEY: !!process.env.RAPIDAPI_KEY,
      CJ_API_KEY: !!process.env.CJ_API_KEY,
      SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
      DATABASE_URL: !!process.env.DATABASE_URL,
      REDIS_URL: !!process.env.REDIS_URL,
      ADMIN_SECRET: !!process.env.ADMIN_SECRET,
    },
  });
});

// ── API Health Check — tests every external service ──
router.get('/api-health', async (_req: Request, res: Response) => {
  // Cache health check for 5 minutes — prevents burning API quota
  const cached = await cache.get('admin:api-health');
  if (cached) return res.json(cached);

  const results: any[] = [];

  // Helper: test an API and return result
  async function testApi(name: string, testFn: () => Promise<{ ok: boolean; detail?: string }>) {
    const start = Date.now();
    try {
      const r = await testFn();
      results.push({ name, status: r.ok ? 'healthy' : 'error', latency: Date.now() - start, detail: r.detail || 'OK', configured: true });
    } catch (err: any) {
      results.push({ name, status: 'error', latency: Date.now() - start, detail: err.message?.slice(0, 150), configured: true });
    }
  }

  // ── Gemini AI ──
  if (process.env.GEMINI_API_KEY) {
    await testApi('Gemini 2.5 Flash', async () => {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with just: OK' }] }], generationConfig: { maxOutputTokens: 10 } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) { const t = await r.text(); return { ok: false, detail: `HTTP ${r.status}: ${t.slice(0, 100)}` }; }
      return { ok: true, detail: 'Connected & responding' };
    });
  } else {
    results.push({ name: 'Gemini 2.5 Flash', status: 'not_configured', latency: 0, detail: 'GEMINI_API_KEY not set', configured: false });
  }

  // ── OpenAI ──
  if (process.env.OPENAI_API_KEY) {
    await testApi('OpenAI GPT', async () => {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}: Invalid key or quota exceeded` };
      return { ok: true, detail: 'Key valid & connected' };
    });
  } else {
    results.push({ name: 'OpenAI GPT', status: 'not_configured', latency: 0, detail: 'OPENAI_API_KEY not set (optional — Gemini is primary)', configured: false });
  }

  // ── AliExpress (RapidAPI) ──
  if (process.env.RAPIDAPI_KEY) {
    await testApi('AliExpress (RapidAPI)', async () => {
      const r = await fetch('https://aliexpress-datahub.p.rapidapi.com/item_search_2?q=test&page=1', {
        headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY!, 'x-rapidapi-host': 'aliexpress-datahub.p.rapidapi.com' },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 403) return { ok: false, detail: 'Not subscribed — subscribe at rapidapi.com' };
      if (r.status === 429) return { ok: false, detail: 'Rate limited — too many requests' };
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      const data = await r.json();
      const count = data?.result?.resultList?.length || 0;
      return { ok: true, detail: `Connected — ${count} test results returned` };
    });
  } else {
    results.push({ name: 'AliExpress (RapidAPI)', status: 'not_configured', latency: 0, detail: 'RAPIDAPI_KEY not set', configured: false });
  }

  // ── CJ Dropshipping ──
  if (process.env.CJ_API_KEY) {
    await testApi('CJ Dropshipping', async () => {
      const r = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: process.env.CJ_API_KEY }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      const data = await r.json();
      if (data.code === 200 && data.data?.accessToken) {
        return { ok: true, detail: 'Authenticated — token received' };
      }
      return { ok: false, detail: data.message || 'Auth failed' };
    });
  } else {
    results.push({ name: 'CJ Dropshipping', status: 'not_configured', latency: 0, detail: 'CJ_API_KEY not set', configured: false });
  }

  // ── Google Trends (RapidAPI) ──
  if (process.env.RAPIDAPI_KEY) {
    await testApi('Google Trends (RapidAPI)', async () => {
      const params = new URLSearchParams({ keyword: 'gadget', property: '', geo: '', dataSource: 'web' });
      const r = await fetch(`https://google-trends8.p.rapidapi.com/interestOverTime?${params}`, {
        headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY!, 'x-rapidapi-host': 'google-trends8.p.rapidapi.com' },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 403) return { ok: false, detail: 'Not subscribed — subscribe at rapidapi.com' };
      if (r.status === 429) return { ok: false, detail: 'Rate limited' };
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      return { ok: true, detail: 'Connected & returning trends' };
    });
  } else {
    results.push({ name: 'Google Trends (RapidAPI)', status: 'not_configured', latency: 0, detail: 'RAPIDAPI_KEY not set', configured: false });
  }

  // ── Amazon Data (RapidAPI) ──
  if (process.env.RAPIDAPI_KEY) {
    await testApi('Amazon Data (RapidAPI)', async () => {
      const r = await fetch('https://real-time-amazon-data.p.rapidapi.com/search?query=test&page=1&country=US', {
        headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY!, 'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com' },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 403) return { ok: false, detail: 'Not subscribed — subscribe at rapidapi.com' };
      if (r.status === 429) return { ok: false, detail: 'Rate limited' };
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      const data = await r.json();
      const count = data?.data?.products?.length || 0;
      return { ok: true, detail: `Connected — ${count} test results` };
    });
  } else {
    results.push({ name: 'Amazon Data (RapidAPI)', status: 'not_configured', latency: 0, detail: 'RAPIDAPI_KEY not set', configured: false });
  }

  // ── TikTok (RapidAPI) ──
  if (process.env.RAPIDAPI_KEY) {
    await testApi('TikTok Trends (RapidAPI)', async () => {
      const r = await fetch('https://tiktok-creative-center-api.p.rapidapi.com/api/search/hashtag?keyword=gadget&country=us', {
        headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY!, 'x-rapidapi-host': 'tiktok-creative-center-api.p.rapidapi.com' },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 403) return { ok: false, detail: 'Not subscribed — subscribe at rapidapi.com' };
      if (r.status === 429) return { ok: false, detail: 'Rate limited' };
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      return { ok: true, detail: 'Connected' };
    });
  } else {
    results.push({ name: 'TikTok Trends (RapidAPI)', status: 'not_configured', latency: 0, detail: 'RAPIDAPI_KEY not set', configured: false });
  }

  // ── Shopify ──
  const shop = await prisma.shop.findFirst({ where: { isActive: true, accessToken: { not: 'pending' } } }).catch(() => null);
  if (shop?.accessToken) {
    await testApi('Shopify Admin API', async () => {
      const r = await fetch(`https://${shop.shopDomain}/admin/api/2024-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': shop.accessToken! },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 401) return { ok: false, detail: '401 Unauthorized — token expired, reinstall app' };
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      const data = await r.json();
      return { ok: true, detail: `Connected to ${data.shop?.name || shop.shopDomain}` };
    });
  } else {
    results.push({ name: 'Shopify Admin API', status: shop ? 'error' : 'not_configured', latency: 0, detail: shop ? 'Token is pending — reinstall app' : 'No active shop found', configured: !!shop });
  }

  // ── Database ──
  await testApi('PostgreSQL Database', async () => {
    const count = await prisma.shop.count();
    return { ok: true, detail: `Connected — ${count} shops in database` };
  });

  // ── Redis ──
  await testApi('Redis Cache', async () => {
    const isUp = cache.isRedisAvailable();
    return { ok: isUp, detail: isUp ? 'Connected & caching' : 'Not connected — using in-memory fallback' };
  });

  // Summary
  const healthy = results.filter(r => r.status === 'healthy').length;
  const errors = results.filter(r => r.status === 'error').length;
  const notConfigured = results.filter(r => r.status === 'not_configured').length;

  const response = {
    summary: { total: results.length, healthy, errors, notConfigured },
    apis: results,
    checkedAt: new Date().toISOString(),
  };

  // Cache for 5 minutes to avoid burning API quota
  await cache.set('admin:api-health', response, 300);

  res.json(response);
});

// ── API Monitoring ────────────────────────────
router.get('/api-metrics', (_req: Request, res: Response) => {
  res.json(getApiMetrics());
});

// ── Debug: Raw AliExpress Response ────────────
router.get('/debug/aliexpress', async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) return res.json({ error: 'RAPIDAPI_KEY not set' });

    const r = await fetch('https://aliexpress-datahub.p.rapidapi.com/item_search_2?q=test&page=1', {
      headers: { 'X-Rapidapi-Key': apiKey, 'X-Rapidapi-Host': 'aliexpress-datahub.p.rapidapi.com' },
    });
    const data = await r.json();
    
    // Return the ENTIRE raw response so we can see the structure
    const topLevelKeys = Object.keys(data || {});
    const resultKeys = data?.result ? Object.keys(data.result) : [];
    const resultList = data?.result?.resultList || data?.resultList || [];
    const firstRaw = resultList[0];
    const firstItemKeys = firstRaw ? Object.keys(firstRaw) : [];
    const innerItem = firstRaw?.item;
    const innerItemKeys = innerItem ? Object.keys(innerItem) : [];

    res.json({
      httpStatus: r.status,
      topLevelKeys,
      resultKeys,
      resultListLength: resultList.length,
      firstEntryKeys: firstItemKeys,
      innerItemKeys,
      // Full first 2 entries — raw
      raw_entry_0: resultList[0] || null,
      raw_entry_1: resultList[1] || null,
      // If no resultList, show first 500 chars of raw response
      rawSnippet: resultList.length === 0 ? JSON.stringify(data).slice(0, 1000) : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api-timeline', (req: Request, res: Response) => {
  const bucket = parseInt(req.query.bucket as string) || 5;
  res.json(getApiTimeline(bucket));
});

export default router;
