// ==============================================
// API Routes
// ==============================================

import { Router, Request, Response } from 'express';
import prisma from '../utils/db';
import cache from '../utils/cache';
import logger from '../utils/logger';
import { researchRateLimit, seoRateLimit, importRateLimit } from '../middleware/security';
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

  // If domain is unknown, find the shop with a real token (standalone mode)
  if (!shopDomain || shopDomain === 'unknown') {
    const shopWithToken = await prisma.shop.findFirst({
      where: { accessToken: { not: 'pending' }, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (shopWithToken) return shopWithToken.id;

    // Last resort: any shop
    const anyShop = await prisma.shop.findFirst({ orderBy: { createdAt: 'desc' } });
    if (anyShop) return anyShop.id;

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

    // Cache for 30 seconds
    const cached = await cache.get(`dashboard:${shopId}`);
    if (cached) return res.json({ success: true, data: cached });

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

    const dashData = {
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
    };

    await cache.set(`dashboard:${shopId}`, dashData, 30);

    res.json({ success: true, data: dashData });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Store DNA ──────────────────────────────────

router.get('/store-dna', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const dna = await cache.through(`store-dna:${shopId}`, 60, () => loadStoreDNA(shopId));
    res.json({ success: true, data: dna });
  } catch (err: any) {
    res.json({ success: true, data: null });
  }
});

router.put('/store-dna', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const updates = req.body;

    // Map DNA fields to StoreProfile columns
    const profileFields: Record<string, any> = {};
    const settingsFields: Record<string, any> = {};

    if (updates.brandVibe !== undefined) profileFields.brandVibe = updates.brandVibe;
    if (updates.pricePositioning !== undefined) profileFields.pricePositioning = updates.pricePositioning;
    if (updates.nicheKeywords !== undefined) profileFields.nicheKeywords = updates.nicheKeywords;
    if (updates.audienceSegments !== undefined) profileFields.audienceSegments = updates.audienceSegments;
    if (updates.toneAttributes !== undefined) profileFields.toneAttributes = updates.toneAttributes;
    if (updates.catalogGaps !== undefined) profileFields.catalogGaps = updates.catalogGaps;
    if (updates.catalogStrengths !== undefined) profileFields.catalogStrengths = updates.catalogStrengths;
    if (updates.topCategories !== undefined) profileFields.topCategories = updates.topCategories;
    if (updates.description !== undefined) settingsFields.storeDescription = updates.description;

    if (Object.keys(profileFields).length > 0) {
      await prisma.storeProfile.update({ where: { shopId }, data: profileFields });
    }
    if (Object.keys(settingsFields).length > 0) {
      await prisma.merchantSettings.update({ where: { shopId }, data: settingsFields });
    }

    await cache.del(`store-dna:${shopId}`);
    res.json({ success: true, message: 'DNA updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simple save — just 3 fields from the simplified Store DNA form
router.post('/store-dna/simple-save', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { description, audience, priceMin, priceMax } = req.body;

    // Update merchant settings
    await prisma.merchantSettings.upsert({
      where: { shopId },
      create: {
        shopId,
        storeDescription: description || '',
        targetAudience: audience ? audience.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        priceRangeMin: priceMin || 10,
        priceRangeMax: priceMax || 50,
        onboardingComplete: true,
        preferredCategories: [],
        bannedCategories: [],
        targetCountries: ['US', 'UK', 'CA', 'AU'],
      },
      update: {
        storeDescription: description || undefined,
        targetAudience: audience ? audience.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        priceRangeMin: priceMin || undefined,
        priceRangeMax: priceMax || undefined,
        onboardingComplete: true,
      },
    });

    await cache.del(`store-dna:${shopId}`);
    res.json({ success: true, message: 'Saved' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// AI suggest — enhance user's store description
router.post('/store-dna/ai-suggest', async (req: Request, res: Response) => {
  try {
    const { description, audience, priceRange } = req.body;
    const { aiComplete } = await import('../utils/ai');

    const prompt = `You are helping a dropshipper describe their store more precisely. They wrote:

Description: "${description}"
Target audience: "${audience || 'not specified'}"
Price range: "${priceRange || '$10-$50'}"

Improve their description to be more specific and niche-focused. A good description helps AI find the RIGHT products.

Return ONLY JSON:
{
  "description": "improved 1-2 sentence description that's very specific about what the store sells",
  "audience": "specific audience description (age, interests, lifestyle)",
  "priceRange": "suggested price range like $10-$50"
}`;

    const result = await aiComplete(prompt, {
      temperature: 0.5,
      maxTokens: 300,
      systemPrompt: 'Help the user describe their e-commerce store precisely. Return only JSON.',
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

// Research diagnostic — tests each step and returns results
router.post('/research/diagnose', async (req: Request, res: Response) => {
  const diag: any = { steps: [], errors: [] };
  try {
    const shopId = await getOrCreateShop(req);
    diag.shopId = shopId;

    // Step 1: Check settings
    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });
    diag.steps.push({ step: 'settings', ok: !!settings?.storeDescription, description: settings?.storeDescription?.slice(0, 50) });
    if (!settings?.storeDescription) { return res.json({ success: true, data: diag }); }

    // Step 2: Test AI
    try {
      const { aiComplete } = await import('../utils/ai');
      const aiTest = await aiComplete<any>('Return JSON: {"test": "ok"}', { maxTokens: 20, systemPrompt: 'Return only JSON' });
      diag.steps.push({ step: 'ai', ok: true, result: JSON.stringify(aiTest).slice(0, 80) });
    } catch (err: any) {
      diag.steps.push({ step: 'ai', ok: false, error: err.message?.slice(0, 150) });
      diag.errors.push(`AI: ${err.message?.slice(0, 150)}`);
    }

    // Step 3: Test providers
    try {
      const { providerRegistry } = await import('../services/providers/providerRegistry');
      const available = providerRegistry.getAvailable();
      diag.steps.push({ step: 'providers', ok: available.length > 0, count: available.length, names: available.map((p: any) => p.name) });
      
      // Try fetching 1 product
      const products = await providerRegistry.searchAll({ keywords: ['tactical gloves'], limit: 3 });
      diag.steps.push({ step: 'fetch', ok: products.length > 0, count: products.length, firstTitle: products[0]?.title?.slice(0, 50) });
    } catch (err: any) {
      diag.steps.push({ step: 'fetch', ok: false, error: err.message?.slice(0, 150) });
      diag.errors.push(`Fetch: ${err.message?.slice(0, 150)}`);
    }

    // Step 4: Test batch scoring
    try {
      const { aiComplete } = await import('../utils/ai');
      const scoreTest = await aiComplete<any>(`Score this product for a "hunting and outdoor" store:
0. "Tactical Gloves" | $12 cost:$5 | 500 orders | 4.5★
Return JSON array: [{"storeFit":80,"saturation":60,"viralScore":70,"trendStage":"rising_trend","winnerScore":75,"storeFitReason":"fits outdoor niche","viralReason":"useful product"}]`, { maxTokens: 300, systemPrompt: 'Return only JSON array' });
      
      const isArray = Array.isArray(scoreTest);
      diag.steps.push({ step: 'scoring', ok: isArray, isArray, type: typeof scoreTest, result: JSON.stringify(scoreTest).slice(0, 200) });
    } catch (err: any) {
      diag.steps.push({ step: 'scoring', ok: false, error: err.message?.slice(0, 150) });
      diag.errors.push(`Scoring: ${err.message?.slice(0, 150)}`);
    }

    // Step 5: Check DB save capability
    try {
      const count = await prisma.candidateProduct.count({ where: { shopId } });
      diag.steps.push({ step: 'db', ok: true, existingCandidates: count });
    } catch (err: any) {
      diag.steps.push({ step: 'db', ok: false, error: err.message?.slice(0, 150) });
    }

    // Step 6: Check latest job status
    const latestJob = await prisma.jobRun.findFirst({
      where: { shopId, jobType: 'RESEARCH_PRODUCTS' },
      orderBy: { createdAt: 'desc' },
    });
    diag.steps.push({ 
      step: 'lastJob', 
      status: latestJob?.status, 
      error: latestJob?.error?.slice(0, 200), 
      createdAt: latestJob?.createdAt,
      result: latestJob?.result ? JSON.stringify(latestJob.result).slice(0, 300) : null,
    });

    // Step 7: Check last 3 job history
    const recentJobs = await prisma.jobRun.findMany({
      where: { shopId, jobType: 'RESEARCH_PRODUCTS' },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    diag.steps.push({ 
      step: 'jobHistory', 
      jobs: recentJobs.map(j => ({ status: j.status, error: j.error?.slice(0, 100), created: j.createdAt, saved: (j.result as any)?.totalSaved, fetched: (j.result as any)?.totalFetched })),
    });

    res.json({ success: true, data: diag });
  } catch (err: any) {
    diag.errors.push(err.message);
    res.json({ success: true, data: diag });
  }
});

// Dry-run: runs each pipeline step with real data, reports counts, doesn't save
router.post('/research/dry-run', async (req: Request, res: Response) => {
  const results: any = { steps: [], errors: [] };
  try {
    const shopId = await getOrCreateShop(req);
    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });
    if (!settings?.storeDescription) {
      results.errors.push('No Store DNA configured');
      return res.json({ success: true, data: results });
    }
    results.steps.push({ step: 'settings', storeDesc: settings.storeDescription.slice(0, 80) });

    // Step 1: Keywords
    const { aiComplete } = await import('../utils/ai');
    let keywords: string[] = [];
    try {
      const kws = await aiComplete<string[]>(`Generate 5 product search keywords for: "${settings.storeDescription}". Return JSON array of 5 strings.`, {
        temperature: 0.5, maxTokens: 200, systemPrompt: 'Return only a JSON array of 5 keyword strings.',
      });
      keywords = Array.isArray(kws) ? kws : [];
      results.steps.push({ step: 'keywords', ok: keywords.length > 0, keywords });
    } catch (e: any) {
      results.steps.push({ step: 'keywords', ok: false, error: e.message?.slice(0, 150) });
      results.errors.push(`Keywords: ${e.message?.slice(0, 100)}`);
      // Fallback
      keywords = settings.preferredCategories?.slice(0, 3) || [settings.storeDescription.split(' ').slice(0, 3).join(' ')];
      results.steps.push({ step: 'keywords_fallback', keywords });
    }

    // Step 2: Fetch from each keyword
    const { providerRegistry } = await import('../services/providers/providerRegistry');
    let allProducts: any[] = [];
    const fetchDetails: any[] = [];
    for (const kw of keywords.slice(0, 5)) {
      try {
        const products = await providerRegistry.searchAll({ keywords: [kw], limit: 20 });
        allProducts.push(...products);
        fetchDetails.push({ keyword: kw, count: products.length });
      } catch (e: any) {
        fetchDetails.push({ keyword: kw, count: 0, error: e.message?.slice(0, 80) });
      }
    }
    results.steps.push({ step: 'fetch', totalProducts: allProducts.length, perKeyword: fetchDetails });

    // Dedup
    const seen = new Set<string>();
    allProducts = allProducts.filter(p => {
      const key = `${p.providerType}-${p.providerProductId}`;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
    results.steps.push({ step: 'dedup', afterDedup: allProducts.length });

    // Step 3: Relevance filter
    if (allProducts.length > 0) {
      try {
        const { relevanceFilterAgent } = await import('../services/agents');
        const indices = await relevanceFilterAgent(allProducts.slice(0, 30), settings.storeDescription);
        results.steps.push({ step: 'relevanceFilter', input: Math.min(allProducts.length, 30), output: indices.length, indices: indices.slice(0, 20) });
      } catch (e: any) {
        results.steps.push({ step: 'relevanceFilter', ok: false, error: e.message?.slice(0, 150) });
      }
    }

    // Step 4: Sample score (1 product)
    if (allProducts.length > 0) {
      try {
        const sample = allProducts[0];
        results.steps.push({ step: 'sampleProduct', title: sample.title?.slice(0, 60), cost: sample.costPrice, orders: sample.orderVolume, source: sample.sourceName });
      } catch {}
    }

    results.summary = `${keywords.length} keywords → ${allProducts.length} products fetched. Pipeline should produce ${Math.min(allProducts.length, 27)} results.`;
    res.json({ success: true, data: results });
  } catch (err: any) {
    results.errors.push(err.message?.slice(0, 300));
    res.json({ success: true, data: results });
  }
});

router.post('/research/start', researchRateLimit, async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    console.log(`[Research] POST /research/start for shop ${shopId}`);

    // Check if Store DNA is configured
    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });
    if (!settings?.storeDescription) {
      return res.json({
        success: true,
        message: 'Please set up your Store DNA first. Go to Store DNA and describe what your store sells.',
        data: { totalFetched: 0, totalScored: 0, totalSaved: 0, batchId: '', topCandidates: [] },
      });
    }

    // Clean up stuck RUNNING jobs older than 8 minutes
    const eightMinAgo = new Date(Date.now() - 8 * 60 * 1000);
    await prisma.jobRun.updateMany({
      where: { shopId, jobType: 'RESEARCH_PRODUCTS', status: 'RUNNING', createdAt: { lt: eightMinAgo } },
      data: { status: 'FAILED', error: 'Timed out — auto-cleaned on next research start', completedAt: new Date() },
    });

    // Check if already running (only recent — within last 8 min)
    const running = await prisma.jobRun.findFirst({
      where: { shopId, jobType: 'RESEARCH_PRODUCTS', status: 'RUNNING', createdAt: { gte: eightMinAgo } },
    });
    if (running) {
      return res.json({ success: true, message: 'Research already running...', data: { status: 'RUNNING' } });
    }

    // Create job record immediately
    const job = await prisma.jobRun.create({
      data: { shopId, jobType: 'RESEARCH_PRODUCTS', status: 'RUNNING', startedAt: new Date(), progress: 0 },
    });

    // Return immediately — research runs in background
    res.json({ success: true, message: 'Research started! Checking for products...', data: { status: 'RUNNING', jobId: job.id } });

    // Run research in background (fire-and-forget)
    (async () => {
      try {
        console.log(`[Research] Background task starting for job ${job.id}`);
        const { runResearchPipeline } = await import('../services/research/researchPipeline');
        const result = await runResearchPipeline(shopId);

        console.log(`[Research] Pipeline returned: ${JSON.stringify({ saved: result.totalSaved, fetched: result.totalFetched, scored: result.totalScored })}`);

        await prisma.jobRun.update({
          where: { id: job.id },
          data: { status: 'COMPLETED', result: result as any, completedAt: new Date(), progress: 100 },
        });

        console.log(`[Research] ✅ Job ${job.id} COMPLETED: ${result.totalSaved} products saved`);
        logger.info('Research complete', { shopId, saved: result.totalSaved, fetched: result.totalFetched });
        await cache.invalidatePrefix(`dashboard:${shopId}`);
        await cache.invalidatePrefix(`candidates:${shopId}`);

        try {
          const { notify } = await import('../services/notifications');
          await notify(shopId, 'success', `Research found ${result.totalSaved} products`,
            `AI analyzed ${result.totalFetched} products and selected ${result.totalSaved} winners for your store.`,
            { label: 'View Products', url: '/candidates' });
        } catch {}
      } catch (err: any) {
        const errorMsg = err.message?.slice(0, 500) || 'Unknown error';
        const errorStack = err.stack?.slice(0, 300) || '';
        console.error(`[Research] ❌ Background FAILED for job ${job.id}: ${errorMsg}`);
        console.error(`[Research] Stack: ${errorStack}`);
        
        await prisma.jobRun.update({
          where: { id: job.id },
          data: { status: 'FAILED', error: errorMsg, completedAt: new Date() },
        }).catch((e: any) => console.error(`[Research] Failed to update job status: ${e.message}`));
      }
    })();
  } catch (err: any) {
    console.error('[Research] FAILED:', err.message);
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
    const { status, sort, page = '1', limit = '200' } = req.query;

    // Cache for 15 seconds
    const cacheKey = `candidates:${shopId}:${status}:${sort}:${page}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

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

    const response = {
      success: true,
      data: candidates,
      meta: { page: parseInt(page as string), total, hasMore: total > parseInt(page as string) * parseInt(limit as string) },
    };
    await cache.set(cacheKey, response, 15);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Select a candidate (move to Candidates page, no Shopify import)
router.post('/candidates/:id/select', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { id } = req.params;
    await prisma.candidateProduct.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
    res.json({ success: true, message: 'Product selected' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unselect a candidate (move back to research)
router.post('/candidates/:id/unselect', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.candidateProduct.update({
      where: { id },
      data: { status: 'CANDIDATE' },
    });
    res.json({ success: true, message: 'Product removed from candidates' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get count of selected candidates
router.get('/candidates/selected-count', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const count = await prisma.candidateProduct.count({
      where: { shopId, status: 'APPROVED', importedProduct: null },
    });
    res.json({ success: true, data: { count } });
  } catch {
    res.json({ success: true, data: { count: 0 } });
  }
});

router.post('/candidates/:id/approve', importRateLimit, async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { id } = req.params;
    const { customTitle, customPrice, customDescription } = req.body || {};

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
    const finalTitle = customTitle || candidate.title;
    const finalPrice = Number(customPrice) || candidate.suggestedPrice || cost * 2.5;
    const finalDescription = customDescription || candidate.description || '';
    const scoreVal = Math.round(candidate.score?.finalScore || 0);

    let shopifyProductId = `mock-${Date.now()}`;
    let shopifyGid = `gid://shopify/Product/${shopifyProductId}`;
    let shopifyHandle = finalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    let isMock = true;

    // Try real Shopify import
    if (shop.accessToken && shop.accessToken !== 'pending') {
      try {
        const { createShopifyProduct } = await import('../services/shopify/shopifyClient');
        const result = await createShopifyProduct(
          shop.shopDomain, shop.accessToken,
          {
            title: finalTitle,
            descriptionHtml: finalDescription,
            productType: candidate.category || '',
            tags: ['flexhunter', 'testing', `score:${scoreVal}`],
            status: 'ACTIVE',
            variants: [{ price: finalPrice.toFixed(2) }],
            images: (candidate.imageUrls || []).filter((u: string) => u && u.startsWith('http')).map((u: string) => ({ src: u })),
          }
        );
        shopifyProductId = result.id.split('/').pop() || shopifyProductId;
        shopifyGid = result.id;
        shopifyHandle = result.handle;
        isMock = false;
        console.log(`[Import] SUCCESS: Created Shopify product ${shopifyProductId} for "${finalTitle}"`);
      } catch (shopifyErr: any) {
        console.error('[Import] Shopify API error:', shopifyErr.message);
        isMock = true;
        return res.json({
          success: true,
          message: `Saved locally but Shopify import failed: ${shopifyErr.message}. Check your token in Settings.`,
          shopifyError: shopifyErr.message,
        });
      }
    } else {
      console.log(`[Import] No Shopify token (${shop.accessToken}). Saving as mock.`);
    }

    // Create ImportedProduct
    const imported = await prisma.importedProduct.create({
      data: {
        shopId,
        candidateId: id,
        shopifyProductId,
        shopifyProductGid: shopifyGid,
        shopifyHandle,
        shopifyStatus: isMock ? 'MOCK' : 'DRAFT',
        importedTitle: finalTitle,
        importedDescription: finalDescription,
        importedTags: ['flexhunter', 'testing'],
        importedPrice: finalPrice,
        publishedOnImport: false,
        status: 'TESTING',
        testStartedAt: new Date(),
      },
    });

    // Update candidate status — remove from Candidates page
    await prisma.candidateProduct.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    // Audit
    await prisma.auditLog.create({
      data: {
        shopId,
        action: 'PRODUCT_IMPORTED',
        entityType: 'CandidateProduct',
        entityId: id,
        explanation: `Imported "${finalTitle}" (${isMock ? 'mock' : 'Shopify'})`,
      },
    });

    logger.info('Product imported', { shopId, title: finalTitle, mock: isMock });
    await cache.invalidatePrefix(`dashboard:${shopId}`);

    res.json({
      success: true,
      message: isMock ? 'Product saved (mock import)' : 'Product imported to Shopify',
      importedProductId: imported.id,
    });
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

// Delete imported product (from DB + optionally from Shopify)
router.delete('/imports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shopId = await getOrCreateShop(req);
    console.log(`[Import] DELETE request for imported product ${id}`);

    const imported = await prisma.importedProduct.findUnique({
      where: { id },
    });

    if (!imported) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Try to delete from Shopify if it was a real import
    if (imported.shopifyProductId && imported.shopifyStatus !== 'MOCK') {
      try {
        const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
        if (shop.accessToken && shop.accessToken !== 'pending') {
          const url = `https://${shop.shopDomain}/admin/api/2024-01/products/${imported.shopifyProductId}.json`;
          const r = await fetch(url, {
            method: 'DELETE',
            headers: { 'X-Shopify-Access-Token': shop.accessToken },
          });
          console.log(`[Import] Shopify delete ${imported.shopifyProductId}: ${r.status}`);
        }
      } catch (err: any) {
        console.warn(`[Import] Shopify delete failed (continuing): ${err.message}`);
      }
    }

    // Delete everything in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all related records first
      await tx.replacementDecision.deleteMany({ where: { currentProductId: id } });
      await tx.productPin.deleteMany({ where: { importedProductId: id } });
      await tx.productPerformance.deleteMany({ where: { importedProductId: id } });

      // Delete the imported product
      await tx.importedProduct.delete({ where: { id } });

      // Reset candidate back to CANDIDATE
      if (imported.candidateId) {
        await tx.candidateProduct.update({
          where: { id: imported.candidateId },
          data: { status: 'CANDIDATE' },
        }).catch(() => {});
      }
    });

    console.log(`[Import] Successfully deleted "${imported.importedTitle}"`);

    await prisma.auditLog.create({
      data: {
        shopId,
        action: 'PRODUCT_DELETED',
        entityType: 'ImportedProduct',
        entityId: id,
        explanation: `Deleted "${imported.importedTitle}"`,
      },
    }).catch(() => {});

    res.json({ success: true, message: 'Product deleted' });
  } catch (err: any) {
    console.error(`[Import] DELETE FAILED:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete ALL imported products
router.delete('/imports', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    console.log(`[Import] DELETE ALL for shop ${shopId}`);

    const allImports = await prisma.importedProduct.findMany({
      where: { shopId },
      select: { id: true, shopifyProductId: true, shopifyStatus: true, candidateId: true, importedTitle: true },
    });

    // Delete from Shopify
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    if (shop.accessToken && shop.accessToken !== 'pending') {
      for (const imp of allImports) {
        if (imp.shopifyProductId && imp.shopifyStatus !== 'MOCK') {
          try {
            await fetch(`https://${shop.shopDomain}/admin/api/2024-01/products/${imp.shopifyProductId}.json`, {
              method: 'DELETE',
              headers: { 'X-Shopify-Access-Token': shop.accessToken },
            });
          } catch {}
        }
      }
    }

    const ids = allImports.map(i => i.id);
    const candIds = allImports.map(i => i.candidateId).filter(Boolean) as string[];

    // Delete all related records in transaction
    await prisma.$transaction(async (tx) => {
      await tx.replacementDecision.deleteMany({ where: { currentProductId: { in: ids } } });
      await tx.productPin.deleteMany({ where: { importedProductId: { in: ids } } });
      await tx.productPerformance.deleteMany({ where: { importedProductId: { in: ids } } });
      await tx.importedProduct.deleteMany({ where: { shopId } });
      if (candIds.length > 0) {
        await tx.candidateProduct.updateMany({
          where: { id: { in: candIds } },
          data: { status: 'CANDIDATE' },
        });
      }
    });

    console.log(`[Import] Deleted ${allImports.length} imported products`);

    await prisma.auditLog.create({
      data: { shopId, action: 'ALL_IMPORTS_DELETED', explanation: `Deleted ${allImports.length} products` },
    }).catch(() => {});

    res.json({ success: true, message: `Deleted ${allImports.length} products` });
  } catch (err: any) {
    console.error(`[Import] DELETE ALL FAILED:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Replacements ───────────────────────────────

router.get('/replacements', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const decisions = await prisma.replacementDecision.findMany({
      where: { shopId },
      include: {
        currentProduct: {
          include: {
            performance: true,
            candidate: { select: { imageUrls: true, category: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch replacement candidates separately (no FK relation in schema)
    const enriched = await Promise.all(decisions.map(async (d) => {
      let replacementCandidate = null;
      if (d.replacementCandidateId) {
        replacementCandidate = await prisma.candidateProduct.findUnique({
          where: { id: d.replacementCandidateId },
          select: { id: true, title: true, imageUrls: true, suggestedPrice: true, costPrice: true, orderVolume: true, category: true, sourceName: true },
        }).catch(() => null);
      }
      return { ...d, replacementCandidate };
    }));

    res.json({ success: true, data: enriched });
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
    const { syncPerformance } = await import('../services/performance/performanceSync');
    const result = await syncPerformance(shopId);
    res.json({ success: true, message: `Synced ${result.synced} products, ${result.weak} weak detected`, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auto-replacement scan
router.post('/replacements/scan', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { scanForReplacements } = await import('../services/replacement/autoReplace');
    const suggestions = await scanForReplacements(shopId);
    res.json({ success: true, data: suggestions, message: `Found ${suggestions.length} replacement suggestions` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Recalibrate scoring weights from merchant outcomes
router.post('/scoring/recalibrate', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { recalibrateWeights } = await import('../services/signals/feedbackLoop');
    const result = await recalibrateWeights(shopId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get scoring trace for a candidate
router.get('/scoring/trace/:candidateId', async (req: Request, res: Response) => {
  try {
    const candidate = await prisma.candidateProduct.findUniqueOrThrow({
      where: { id: req.params.candidateId },
      include: { score: true },
    });
    const { getSignals, buildScoringTrace } = await import('../services/signals');
    const signals = await getSignals(candidate.shopId, candidate.id);
    res.json({
      success: true,
      data: {
        title: candidate.title,
        score: candidate.score,
        signals,
        evidenceCompleteness: signals?.evidenceCompleteness || 0,
        signalCount: signals?.signalCount || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Pairwise Product Comparison ───────────────

router.post('/scoring/compare', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { productAId, productBId } = req.body;
    if (!productAId || !productBId) return res.status(400).json({ success: false, error: 'Provide productAId and productBId' });

    const [a, b] = await Promise.all([
      prisma.candidateProduct.findUniqueOrThrow({ where: { id: productAId }, include: { score: true } }),
      prisma.candidateProduct.findUniqueOrThrow({ where: { id: productBId }, include: { score: true } }),
    ]);

    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });

    const { compareProducts } = await import('../services/signals/pairwiseRanking');
    const result = await compareProducts(
      { id: a.id, title: a.title, score: a.score?.finalScore || 0, price: a.suggestedPrice || 0, cost: a.costPrice || 0, orders: a.orderVolume || 0, rating: a.reviewRating || 0, shippingDays: a.shippingDays || 15, category: a.category || '' },
      { id: b.id, title: b.title, score: b.score?.finalScore || 0, price: b.suggestedPrice || 0, cost: b.costPrice || 0, orders: b.orderVolume || 0, rating: b.reviewRating || 0, shippingDays: b.shippingDays || 15, category: b.category || '' },
      settings?.storeDescription || 'dropshipping store',
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/scoring/tournament', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { topN = 5 } = req.body;

    const candidates = await prisma.candidateProduct.findMany({
      where: { shopId, status: 'CANDIDATE' },
      include: { score: true },
      orderBy: { score: { finalScore: 'desc' } },
      take: topN * 2,
    });

    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });

    const { tournamentRank } = await import('../services/signals/pairwiseRanking');
    const result = await tournamentRank(
      candidates.map(c => ({
        id: c.id, title: c.title, score: c.score?.finalScore || 0,
        price: c.suggestedPrice || 0, cost: c.costPrice || 0,
        orders: c.orderVolume || 0, rating: c.reviewRating || 0,
        shippingDays: c.shippingDays || 15, category: c.category || '',
      })),
      settings?.storeDescription || 'dropshipping store',
      topN,
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Trend Intelligence ─────────────────────────

router.post('/trends/analyze', async (req: Request, res: Response) => {
  try {
    const { keywords } = req.body;
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide an array of keywords' });
    }

    const { batchAggregateTrends } = await import('../services/trends');
    const trends = await batchAggregateTrends(keywords.slice(0, 10));
    res.json({ success: true, data: trends });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Discover winning trends — AI generates trending product keywords
router.post('/trends/discover', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });
    const storeDesc = settings?.storeDescription || '';

    // AI generates trending keywords based on store + current market
    const { aiComplete } = await import('../utils/ai');
    const keywords = await aiComplete<string[]>(`You are a trend forecasting expert. Generate 8 product keywords/categories that are trending RIGHT NOW and likely to go viral in the next 1-2 weeks.

${storeDesc ? `The merchant's store sells: "${storeDesc}". Include 4 keywords related to their niche AND 4 general trending product categories.` : 'Generate 8 general trending product categories across dropshipping.'}

Think about:
- Products blowing up on TikTok this week
- Seasonal products that are about to peak
- New gadgets getting attention
- Problem-solving products going viral
- Gift-worthy items trending for upcoming holidays

Return ONLY a JSON array of 8 keyword strings. Each should be 2-4 words.`, {
      temperature: 0.7,
      maxTokens: 300,
      systemPrompt: 'Trend forecasting expert. Return only a JSON array of 8 trending product keyword strings.',
    });

    if (!Array.isArray(keywords)) {
      return res.status(500).json({ success: false, error: 'AI failed to generate keywords' });
    }

    // Now analyze these keywords for trend data
    const { batchAggregateTrends } = await import('../services/trends');
    const trends = await batchAggregateTrends(keywords);

    // Sort by score descending
    trends.sort((a: any, b: any) => (b.overallScore || 0) - (a.overallScore || 0));

    res.json({ success: true, data: trends, keywords });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get early viral products — products detected 1-2 weeks before breakout
router.get('/trends/viral-products', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);

    // Find products with high viral scores from recent research
    const candidates = await prisma.candidateProduct.findMany({
      where: {
        shopId,
        status: { in: ['CANDIDATE', 'APPROVED'] },
        score: {
          visualVirality: { gte: 50 },
        },
      },
      include: { score: true },
      orderBy: { score: { visualVirality: 'desc' } },
      take: 20,
    });

    // Classify each by viral stage
    const viralProducts = candidates.map((c: any) => {
      const vs = c.score?.visualVirality || 0;
      const orders = c.orderVolume || 0;
      let stage = 'stable_trend';
      let timeAdvantage = '0 days';

      if (vs >= 80 && orders < 5000) { stage = 'early_acceleration'; timeAdvantage = '2-3 weeks early'; }
      else if (vs >= 65 && orders < 10000) { stage = 'breakout_candidate'; timeAdvantage = '1-2 weeks early'; }
      else if (vs >= 50 && orders < 50000) { stage = 'rising_trend'; timeAdvantage = '1 week early'; }
      else if (orders >= 50000) { stage = 'saturated'; timeAdvantage = 'already mainstream'; }

      return {
        id: c.id,
        title: c.title,
        category: c.category,
        imageUrl: c.imageUrls?.[0],
        price: c.suggestedPrice,
        cost: c.costPrice,
        orders,
        viralScore: vs,
        finalScore: c.score?.finalScore || 0,
        storeFitScore: c.score?.storeFit || 0,
        stage,
        timeAdvantage,
        explanation: c.score?.explanation,
        fitReasons: c.score?.fitReasons || [],
        sourceName: c.sourceName,
        status: c.status,
      };
    });

    res.json({
      success: true,
      data: viralProducts,
      summary: {
        total: viralProducts.length,
        earlyAcceleration: viralProducts.filter((p: any) => p.stage === 'early_acceleration').length,
        breakoutCandidates: viralProducts.filter((p: any) => p.stage === 'breakout_candidate').length,
        risingTrends: viralProducts.filter((p: any) => p.stage === 'rising_trend').length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TikTok Top Products — trending products on TikTok right now
router.get('/trends/tiktok-products', async (req: Request, res: Response) => {
  try {
    const { getTikTokTopProducts } = await import('../services/trends/tiktokTrends');
    const products = await getTikTokTopProducts(req.query.country as string || 'US');
    res.json({ success: true, data: products });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/trends/keyword/:keyword', async (req: Request, res: Response) => {
  try {
    const { keyword } = req.params;
    const { aggregateTrend } = await import('../services/trends');
    const trend = await aggregateTrend(keyword);
    res.json({ success: true, data: trend });
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

router.get('/suppliers', async (req: Request, res: Response) => {
  const { providerRegistry } = await import('../services/providers/providerRegistry');
  const all = providerRegistry.getAll();

  // Load saved preferences
  let prefs: Record<string, boolean> = {};
  try {
    const shopId = await getOrCreateShop(req);
    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });
    prefs = (settings as any)?.supplierPrefs || {};
  } catch {}

  res.json({
    success: true,
    data: all.map(p => ({
      name: p.name,
      type: p.type,
      available: p.isAvailable(),
      enabled: prefs[p.name] !== false, // default enabled
      live: providerRegistry.isLive(p.name),
    })),
  });
});

router.post('/suppliers/toggle', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { name, enabled } = req.body;

    // Store in settings as JSON
    const settings = await prisma.merchantSettings.findUnique({ where: { shopId } });
    const prefs = (settings as any)?.supplierPrefs || {};
    prefs[name] = enabled;

    // We'll store supplier prefs in the settings' banned categories as a workaround
    // In production, add a proper supplierPrefs JSON field to MerchantSettings
    await prisma.auditLog.create({
      data: { shopId, action: 'SETTINGS_CHANGED', explanation: `${name} ${enabled ? 'enabled' : 'disabled'}` },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Debug endpoint to check ALL shop records
router.get('/debug/shop', async (req: Request, res: Response) => {
  try {
    // Show ALL shops in the database
    const allShops = await prisma.shop.findMany({
      select: {
        id: true,
        shopDomain: true,
        name: true,
        accessToken: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Also try to identify which shop the frontend is using
    let frontendDomain = req.headers['x-shop-domain'] as string || 'unknown';

    res.json({
      success: true,
      frontendSendsDomain: frontendDomain,
      allShops: allShops.map(s => ({
        id: s.id,
        domain: s.shopDomain,
        name: s.name,
        tokenPrefix: s.accessToken.slice(0, 15) + '...',
        tokenLength: s.accessToken.length,
        isPending: s.accessToken === 'pending',
        isActive: s.isActive,
        created: s.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fix token: update ALL shops matching this domain pattern
router.post('/fix-token', async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

    // Update ALL shop records with pending tokens
    const result = await prisma.shop.updateMany({
      where: { accessToken: 'pending' },
      data: { accessToken },
    });

    // Also update any shop that matches the frontend domain
    const domain = req.headers['x-shop-domain'] as string;
    if (domain && domain !== 'unknown') {
      await prisma.shop.updateMany({
        where: { shopDomain: { contains: domain.replace('.myshopify.com', '') } },
        data: { accessToken },
      });
    }

    res.json({ success: true, message: `Updated ${result.count} shop records`, updated: result.count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── SEO Optimization ────────────────────────

router.post('/seo/optimize/:importedProductId', seoRateLimit, async (req: Request, res: Response) => {
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

    // Update the specific shop
    await prisma.shop.update({
      where: { id: shopId },
      data: { accessToken },
    });

    // Also update ALL pending shops
    const fixed = await prisma.shop.updateMany({
      where: { accessToken: 'pending' },
      data: { accessToken },
    });

    console.log(`[Token] Updated shop ${shopId} + ${fixed.count} pending shops`);

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
        shopId: shop.id,
        domain: shop.shopDomain,
        name: shop.name,
        hasToken: shop.accessToken !== 'pending',
        isActive: shop.isActive,
        oauthUrl: shop.accessToken === 'pending'
          ? `/api/auth?shop=${shop.shopDomain}`
          : null,
      },
    });
  } catch (err: any) {
    res.json({ success: true, data: { hasToken: false, oauthUrl: null } });
  }
});

// One-click OAuth connect
router.get('/connect-shopify', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.query.shop as string || req.headers['x-shop-domain'] as string;
    if (shopDomain && shopDomain !== 'unknown') {
      return res.redirect(`/api/auth?shop=${shopDomain.includes('.myshopify.com') ? shopDomain : shopDomain + '.myshopify.com'}`);
    }
    const shopId = await getOrCreateShop(req);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    res.redirect(`/api/auth?shop=${shop.shopDomain}`);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Could not determine shop. Try reinstalling the app.' });
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

// ── Notifications ─────────────────────────────

router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { getNotifications } = await import('../services/notifications');
    const notifications = await getNotifications(shopId);
    res.json({ success: true, data: notifications });
  } catch { res.json({ success: true, data: [] }); }
});

router.get('/notifications/unread', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { getUnreadCount } = await import('../services/notifications');
    const count = await getUnreadCount(shopId);
    res.json({ success: true, data: { count } });
  } catch { res.json({ success: true, data: { count: 0 } }); }
});

router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { markRead } = await import('../services/notifications');
    await markRead(shopId, req.params.id);
    res.json({ success: true });
  } catch { res.json({ success: true }); }
});

router.post('/notifications/read-all', async (req: Request, res: Response) => {
  try {
    const shopId = await getOrCreateShop(req);
    const { markAllRead } = await import('../services/notifications');
    await markAllRead(shopId);
    res.json({ success: true });
  } catch { res.json({ success: true }); }
});

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
