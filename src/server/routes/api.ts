// ==============================================
// API Routes
// ==============================================

import { Router, Request, Response } from 'express';
import prisma from '../utils/db';
import {
  enqueueResearch,
  enqueueImport,
  enqueuePerformanceSync,
  enqueueReplacementEval,
  enqueueStoreAnalysis,
} from '../services/jobs/jobQueue';
import { analyzeDomain } from '../services/domain/domainEngine';
import { loadStoreDNA } from '../services/store-dna/storeDnaEngine';

const router = Router();

// ── Middleware: Get or create shop ──────────────

async function getOrCreateShop(req: Request): Promise<string> {
  // Try shop domain from header
  let shopDomain = req.headers['x-shop-domain'] as string;

  // Fallback to old header
  if (!shopDomain || shopDomain === 'unknown') {
    const shopId = req.headers['x-shop-id'] as string;
    if (shopId && shopId !== 'dev-shop-id') return shopId;
  }

  if (!shopDomain || shopDomain === 'unknown') {
    throw new Error('Unable to identify shop. Please reload the app.');
  }

  // Ensure .myshopify.com suffix
  if (!shopDomain.includes('.myshopify.com')) {
    shopDomain = shopDomain.replace(/\.com$/, '') + '.myshopify.com';
  }

  // Find or create shop
  let shop = await prisma.shop.findUnique({ where: { shopDomain } });
  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        shopDomain,
        accessToken: 'pending', // Will be updated by OAuth
        name: shopDomain.split('.')[0],
        isActive: true,
      },
    });
  }
  return shop.id;
}

// ── Onboarding ─────────────────────────────────

router.post('/onboarding', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const body = req.body;

    await prisma.merchantSettings.upsert({
      where: { shopId },
      create: {
        shopId,
        storeDescription: body.storeDescription,
        targetAudience: body.targetAudience || [],
        targetCountries: body.targetCountries || [],
        preferredCategories: body.preferredCategories || [],
        bannedCategories: body.bannedCategories || [],
        priceRangeMin: body.priceRangeMin,
        priceRangeMax: body.priceRangeMax,
        minimumMarginPercent: body.minimumMarginPercent || 30,
        desiredShippingSpeed: body.desiredShippingSpeed || 'STANDARD',
        replacementMode: body.replacementMode || 'HYBRID',
        onboardingComplete: true,
      },
      update: {
        storeDescription: body.storeDescription,
        targetAudience: body.targetAudience || [],
        targetCountries: body.targetCountries || [],
        preferredCategories: body.preferredCategories || [],
        bannedCategories: body.bannedCategories || [],
        priceRangeMin: body.priceRangeMin,
        priceRangeMax: body.priceRangeMax,
        minimumMarginPercent: body.minimumMarginPercent || 30,
        desiredShippingSpeed: body.desiredShippingSpeed || 'STANDARD',
        replacementMode: body.replacementMode || 'HYBRID',
        onboardingComplete: true,
      },
    });

    // Trigger store analysis in background
    try { await enqueueStoreAnalysis(shopId); } catch {}

    res.json({ success: true, message: 'Onboarding complete' });
  } catch (err: any) {
    console.error('Onboarding error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/onboarding/status', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });
    res.json({
      success: true,
      data: {
        isComplete: settings?.onboardingComplete || false,
        settings,
      },
    });
  } catch (err: any) {
    // Don't error on status check - just return not complete
    res.json({ success: true, data: { isComplete: false, settings: null } });
  }
});

// ── Dashboard ──────────────────────────────────

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);

    const [candidates, imports, replacements, lastResearch, lastSync] = await Promise.all([
      prisma.candidateProduct.groupBy({
        by: ['status'],
        where: { shopId },
        _count: true,
      }),
      prisma.importedProduct.groupBy({
        by: ['status'],
        where: { shopId },
        _count: true,
      }),
      prisma.replacementDecision.count({
        where: { shopId, action: 'SUGGESTED' },
      }),
      prisma.jobRun.findFirst({
        where: { shopId, jobType: 'RESEARCH_PRODUCTS', status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.jobRun.findFirst({
        where: { shopId, jobType: 'SYNC_PERFORMANCE', status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    const candidateCount = candidates.reduce((acc: number, c: any) => acc + c._count, 0);
    const importStatusMap = Object.fromEntries(imports.map((i: any) => [i.status, i._count]));

    const perfAgg = await prisma.productPerformance.aggregate({
      where: { importedProduct: { shopId } },
      _sum: { revenue: true },
      _avg: { healthScore: true },
    });

    res.json({
      success: true,
      data: {
        totalCandidates: candidateCount,
        totalImported: Object.values(importStatusMap).reduce((a: number, b: any) => a + (b as number), 0),
        totalTesting: importStatusMap['TESTING'] || 0,
        totalWinners: importStatusMap['WINNER'] || 0,
        totalWeak: importStatusMap['WEAK'] || 0,
        pendingReplacements: replacements,
        totalRevenue: perfAgg._sum.revenue || 0,
        avgHealthScore: Math.round(perfAgg._avg.healthScore || 0),
        lastResearchAt: lastResearch?.completedAt || null,
        lastSyncAt: lastSync?.completedAt || null,
      },
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Store DNA ──────────────────────────────────

router.get('/store-dna', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const dna = await loadStoreDNA(shopId);
    res.json({ success: true, data: dna });
  } catch (err: any) {
    res.json({ success: true, data: null });
  }
});

router.post('/store-dna/analyze', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    await enqueueStoreAnalysis(shopId);
    res.json({ success: true, message: 'Store analysis started' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Domain Analysis ────────────────────────────

router.post('/domain/analyze', async (req: Request, res: Response) => {
  try {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domain required' });
    const result = await analyzeDomain(domain);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Research ───────────────────────────────────

router.post('/research/start', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    await enqueueResearch(shopId);
    res.json({ success: true, message: 'Research pipeline started' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/research/status', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const latestJob = await prisma.jobRun.findFirst({
      where: { shopId, jobType: 'RESEARCH_PRODUCTS' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: latestJob });
  } catch (err: any) {
    res.json({ success: true, data: null });
  }
});

// ── Candidates ─────────────────────────────────

router.get('/candidates', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { status, sort, page = '1', limit = '20' } = req.query;

    const where: any = { shopId };
    if (status) where.status = status;

    const candidates = await prisma.candidateProduct.findMany({
      where,
      include: { score: true },
      orderBy: sort === 'score' ? { score: { finalScore: 'desc' } } : { createdAt: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    });

    const total = await prisma.candidateProduct.count({ where });

    res.json({
      success: true,
      data: candidates,
      meta: { page: parseInt(page as string), total, hasMore: total > parseInt(page as string) * parseInt(limit as string) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/candidates/:id/approve', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { id } = req.params;

    await prisma.candidateProduct.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    await enqueueImport(shopId, id);

    res.json({ success: true, message: 'Product approved and import started' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/candidates/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.candidateProduct.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/candidates/:id/watchlist', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { id } = req.params;

    await prisma.productWatchlist.upsert({
      where: { shopId_candidateId: { shopId, candidateId: id } },
      create: { shopId, candidateId: id, notes: req.body.notes },
      update: { notes: req.body.notes },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Imported Products ──────────────────────────

router.get('/imports', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { status } = req.query;

    const where: any = { shopId };
    if (status) where.status = status;

    const imports = await prisma.importedProduct.findMany({
      where,
      include: { performance: true, candidate: { include: { score: true } } },
      orderBy: { importedAt: 'desc' },
    });

    res.json({ success: true, data: imports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/imports/:id/pin', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { id } = req.params;

    await prisma.importedProduct.update({
      where: { id },
      data: { isPinned: true, status: 'PINNED' },
    });

    await prisma.productPin.create({
      data: { importedProductId: id, reason: req.body.reason },
    });

    await prisma.auditLog.create({
      data: {
        shopId,
        action: 'PRODUCT_PINNED',
        entityType: 'ImportedProduct',
        entityId: id,
        explanation: req.body.reason || 'Merchant pinned product',
      },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/imports/:id/unpin', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shopId = await getOrCreateShop(req);

    await prisma.importedProduct.update({
      where: { id },
      data: { isPinned: false, status: 'TESTING' },
    });

    await prisma.auditLog.create({
      data: {
        shopId,
        action: 'PRODUCT_UNPINNED',
        entityType: 'ImportedProduct',
        entityId: id,
      },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Replacements ───────────────────────────────

router.get('/replacements', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const decisions = await prisma.replacementDecision.findMany({
      where: { shopId },
      include: { currentProduct: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: decisions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/replacements/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shopId = await getOrCreateShop(req);

    await prisma.replacementDecision.update({
      where: { id },
      data: { action: 'APPROVED', approvedAt: new Date(), approvedBy: 'merchant' },
    });

    await enqueueReplacementEval(shopId);
    res.json({ success: true, message: 'Replacement approved' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/replacements/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shopId = await getOrCreateShop(req);

    await prisma.replacementDecision.update({
      where: { id },
      data: {
        action: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: req.body.reason,
      },
    });

    await prisma.auditLog.create({
      data: {
        shopId,
        action: 'REPLACEMENT_REJECTED',
        entityType: 'ReplacementDecision',
        entityId: id,
        explanation: req.body.reason || 'Merchant rejected replacement',
      },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Settings ───────────────────────────────────

router.get('/settings', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });
    res.json({ success: true, data: settings || null });
  } catch (err: any) {
    res.json({ success: true, data: null });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const body = req.body;
    const { id, shopId: _, createdAt, updatedAt, ...data } = body;

    const updated = await prisma.merchantSettings.update({
      where: { shopId },
      data,
    });

    await prisma.auditLog.create({
      data: {
        shopId,
        action: 'SETTINGS_CHANGED',
        details: data,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Performance ────────────────────────────────

router.post('/performance/sync', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    await enqueuePerformanceSync(shopId);
    res.json({ success: true, message: 'Performance sync started' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Audit Logs ─────────────────────────────────

router.get('/audit', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { action, page = '1', limit = '50' } = req.query;

    const where: any = { shopId };
    if (action) where.action = action;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    });

    const total = await prisma.auditLog.count({ where });

    res.json({
      success: true,
      data: logs,
      meta: { page: parseInt(page as string), total },
    });
  } catch (err: any) {
    res.json({ success: true, data: [], meta: { page: 1, total: 0 } });
  }
});

// ── Jobs ───────────────────────────────────────

router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const jobs = await prisma.jobRun.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ success: true, data: jobs });
  } catch (err: any) {
    res.json({ success: true, data: [] });
  }
});

export default router;
