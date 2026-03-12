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
      _sum: { revenue: true, orders: true },
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
        totalOrders: perfAgg._sum.orders || 0,
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

export default router;
