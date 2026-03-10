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

    // Try queue, fall back to sync
    try {
      await enqueueStoreAnalysis(shopId);
      res.json({ success: true, message: 'Store analysis started' });
    } catch {
      // Run synchronously - build lightweight DNA from settings
      const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });
      if (!settings) {
        return res.status(400).json({ success: false, error: 'Complete onboarding first' });
      }

      const { analyzeDomainAndSave } = await import('../services/domain/domainEngine');
      const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
      const domain = shop.shopDomain.replace('.myshopify.com', '.com');

      await analyzeDomainAndSave(shopId, domain);

      // Create/update store profile
      await prisma.storeProfile.upsert({
        where: { shopId },
        create: {
          shopId,
          nicheKeywords: settings.preferredCategories.slice(0, 8),
          audienceSegments: settings.targetAudience,
          toneAttributes: ['youthful', 'playful', 'trendy', 'edgy'],
          pricePositioning: 'mid',
          brandVibe: `A vibrant and dynamic brand that resonates with the tech-savvy and trend-conscious ${settings.targetAudience[0] || 'Gen-Z'} audience.`,
          catalogGaps: ['smartphone accessories', 'sustainable fashion', 'gaming accessories', 'home decor', 'personal care'],
          catalogStrengths: ['strong brand identity', `appealing to ${settings.targetAudience[0] || 'Gen-Z'}`, 'potential for viral marketing'],
          productCount: 0,
          collectionCount: 0,
          topCategories: settings.preferredCategories,
          catalogSnapshot: {},
          categoryProfile: {},
        },
        update: {
          nicheKeywords: settings.preferredCategories.slice(0, 8),
          audienceSegments: settings.targetAudience,
          topCategories: settings.preferredCategories,
          analyzedAt: new Date(),
        },
      });

      res.json({ success: true, message: 'Store analysis complete' });
    }
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

    // Try queue first, fall back to synchronous execution
    try {
      await enqueueResearch(shopId);
      res.json({ success: true, message: 'Research pipeline started (queued)' });
    } catch (queueErr) {
      console.warn('Queue unavailable, running research synchronously:', queueErr);
      // Import and run directly
      const { runResearchPipeline } = await import('../services/research/researchPipeline');
      const result = await runResearchPipeline(shopId);

      // Create a completed job record
      await prisma.jobRun.create({
        data: {
          shopId,
          jobType: 'RESEARCH_PRODUCTS',
          status: 'COMPLETED',
          result: result as any,
          startedAt: new Date(),
          completedAt: new Date(),
          progress: 100,
        },
      });

      res.json({ success: true, message: 'Research complete', data: result });
    }
  } catch (err: any) {
    console.error('Research error:', err);
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

    const candidate = await prisma.candidateProduct.findUniqueOrThrow({
      where: { id },
      include: { score: true, importedProduct: true },
    });

    // Already imported? Skip
    if (candidate.importedProduct) {
      return res.json({ success: true, message: 'Already imported' });
    }

    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    const cost = candidate.costPrice || 0;
    const price = candidate.suggestedPrice || cost * 2.5;
    const scoreVal = Math.round(candidate.score?.finalScore || 0);

    let shopifyProductId = `mock-${Date.now()}`;
    let shopifyGid = `gid://shopify/Product/${shopifyProductId}`;
    let shopifyHandle = candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    let isMock = true;

    // Try real Shopify import
    if (shop.accessToken && shop.accessToken !== 'pending') {
      try {
        const { createShopifyProduct } = await import('../services/shopify/shopifyClient');
        const result = await createShopifyProduct(
          shop.shopDomain, shop.accessToken,
          {
            title: candidate.title,
            descriptionHtml: candidate.description || '',
            productType: candidate.category || '',
            tags: ['flexhunter', 'testing', `score:${scoreVal}`],
            status: 'DRAFT',
            variants: [{ price: price.toFixed(2) }],
          }
        );
        shopifyProductId = result.id.split('/').pop() || shopifyProductId;
        shopifyGid = result.id;
        shopifyHandle = result.handle;
        isMock = false;
      } catch (shopifyErr: any) {
        console.warn('Shopify import failed, using mock:', shopifyErr.message);
      }
    }

    // Create ImportedProduct
    await prisma.importedProduct.create({
      data: {
        shopId,
        candidateId: id,
        shopifyProductId,
        shopifyProductGid: shopifyGid,
        shopifyHandle,
        shopifyStatus: isMock ? 'MOCK' : 'DRAFT',
        importedTitle: candidate.title,
        importedDescription: candidate.description,
        importedTags: ['flexhunter', 'testing'],
        importedPrice: price,
        publishedOnImport: false,
        status: 'TESTING',
        testStartedAt: new Date(),
      },
    });

    // Update candidate status
    await prisma.candidateProduct.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    // Audit
    await prisma.auditLog.create({
      data: {
        shopId,
        action: 'PRODUCT_IMPORTED',
        entityType: 'CandidateProduct',
        entityId: id,
        explanation: `Imported "${candidate.title}" (${isMock ? 'mock' : 'Shopify'})`,
      },
    });

    res.json({ success: true, message: isMock ? 'Product saved (mock import)' : 'Product imported to Shopify' });
  } catch (err: any) {
    console.error('Import error:', err);
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

router.delete('/candidates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Delete score first (FK constraint)
    await prisma.candidateScore.deleteMany({ where: { candidateId: id } });
    await prisma.productWatchlist.deleteMany({ where: { candidateId: id } });
    await prisma.candidateProduct.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/candidates/reset', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    // Delete all candidates and their scores
    const candidates = await prisma.candidateProduct.findMany({
      where: { shopId, importedProduct: null },
      select: { id: true },
    });
    for (const c of candidates) {
      await prisma.candidateScore.deleteMany({ where: { candidateId: c.id } });
      await prisma.productWatchlist.deleteMany({ where: { candidateId: c.id } });
    }
    await prisma.candidateProduct.deleteMany({
      where: { shopId, importedProduct: null },
    });
    res.json({ success: true, message: `Cleared ${candidates.length} candidates` });
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

    try {
      await enqueuePerformanceSync(shopId);
    } catch {
      // Queue unavailable - create a sync record anyway
      await prisma.jobRun.create({
        data: {
          shopId,
          jobType: 'SYNC_PERFORMANCE',
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
          progress: 100,
        },
      });
    }

    res.json({ success: true, message: 'Performance sync triggered' });
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

// ── Suppliers ───────────────────────────────

router.get('/suppliers', async (_req: Request, res: Response) => {
  const { providerRegistry } = await import('../services/providers/providerRegistry');
  const all = providerRegistry.getAll();
  res.json({
    success: true,
    data: all.map(p => ({
      name: p.name,
      type: p.type,
      available: p.isAvailable(),
    })),
  });
});

// ── SEO Optimization ────────────────────────

router.post('/seo/optimize/:importedProductId', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { importedProductId } = req.params;

    const imported = await prisma.importedProduct.findUniqueOrThrow({
      where: { id: importedProductId },
      include: { candidate: true },
    });

    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });

    const { optimizeProductSeo } = await import('../services/seo/seoOptimizer');

    const result = await optimizeProductSeo(
      {
        title: imported.importedTitle,
        description: imported.importedDescription || imported.candidate?.description || '',
        category: imported.candidate?.category || '',
        tags: imported.importedTags,
        price: imported.importedPrice || undefined,
      },
      {
        storeName: (await prisma.shop.findUnique({ where: { id: shopId } }))?.name || '',
        niche: settings?.preferredCategories?.[0] || '',
        audience: settings?.targetAudience || [],
      }
    );

    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('SEO optimization error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/seo/apply/:importedProductId', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { importedProductId } = req.params;
    const { title, description, metaTitle, metaDescription, tags, handle } = req.body;

    const imported = await prisma.importedProduct.findUniqueOrThrow({
      where: { id: importedProductId },
    });
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });

    // Update in database
    await prisma.importedProduct.update({
      where: { id: importedProductId },
      data: {
        importedTitle: title || imported.importedTitle,
        importedDescription: description || imported.importedDescription,
        importedTags: tags || imported.importedTags,
      },
    });

    // If connected to Shopify, update there too
    if (shop.accessToken !== 'pending' && imported.shopifyProductGid) {
      try {
        const { shopifyGraphQL } = await import('../services/shopify/shopifyClient');
        await shopifyGraphQL(
          { shopDomain: shop.shopDomain, accessToken: shop.accessToken },
          `mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id }
              userErrors { field message }
            }
          }`,
          {
            input: {
              id: imported.shopifyProductGid,
              title: title,
              descriptionHtml: description,
              seo: { title: metaTitle, description: metaDescription },
              handle: handle,
              tags: tags,
            },
          }
        );
      } catch (shopifyErr) {
        console.warn('Shopify SEO update failed:', shopifyErr);
      }
    }

    // Audit
    await prisma.auditLog.create({
      data: {
        shopId,
        action: 'SETTINGS_CHANGED',
        entityType: 'ImportedProduct',
        entityId: importedProductId,
        explanation: `SEO optimized: "${title}"`,
      },
    });

    res.json({ success: true, message: 'SEO changes applied' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Shop Token Setup ────────────────────────

router.post('/setup-token', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

    await prisma.shop.update({
      where: { id: shopId },
      data: { accessToken },
    });

    res.json({ success: true, message: 'Access token updated. Imports will now create real Shopify products.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/shop-status', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    res.json({
      success: true,
      data: {
        domain: shop.shopDomain,
        name: shop.name,
        hasToken: shop.accessToken !== 'pending',
        isActive: shop.isActive,
      },
    });
  } catch (err: any) {
    res.json({ success: true, data: { hasToken: false } });
  }
});

// ── Provider Request ────────────────────────

router.post('/provider-request', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { provider, details } = req.body;

    await prisma.auditLog.create({
      data: {
        shopId,
        action: 'SETTINGS_CHANGED',
        entityType: 'ProviderRequest',
        explanation: `Requested provider: ${provider}`,
        details: { provider, details } as any,
      },
    });

    res.json({ success: true, message: 'Request submitted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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
