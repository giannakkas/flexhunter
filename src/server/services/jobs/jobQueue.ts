// ==============================================
// Job Queue & Worker Engine
// ==============================================
// Background job processing with BullMQ for all
// async operations: research, scoring, syncing, etc.

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../../config';
import prisma from '../../utils/db';
import { runResearchPipeline } from '../research/researchPipeline';
import { buildStoreDNA } from '../store-dna/storeDnaEngine';
import { syncPerformance } from '../performance/performanceTracker';
import { evaluateWeakProducts, findReplacementCandidate, suggestReplacement, processReplacements } from '../replacement/replacementEngine';
import {
  createShopifyProduct,
  addProductImages,
  tagShopifyProduct,
} from '../shopify/shopifyClient';

// ── Queue Definitions ──────────────────────────

const connection = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const researchQueue = new Queue('research', { connection });
export const importQueue = new Queue('import', { connection });
export const performanceQueue = new Queue('performance', { connection });
export const replacementQueue = new Queue('replacement', { connection });
export const storeAnalysisQueue = new Queue('store-analysis', { connection });

// ── Job Helpers ────────────────────────────────

async function createJobRun(shopId: string, jobType: string, payload?: any) {
  return prisma.jobRun.create({
    data: {
      shopId,
      jobType: jobType as any,
      status: 'RUNNING',
      payload,
      startedAt: new Date(),
    },
  });
}

async function completeJobRun(jobRunId: string, result?: any) {
  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: { status: 'COMPLETED', result, completedAt: new Date(), progress: 100 },
  });
}

async function failJobRun(jobRunId: string, error: string) {
  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: { status: 'FAILED', error, completedAt: new Date() },
  });
}

// ── Job Dispatchers ────────────────────────────

export async function enqueueResearch(shopId: string) {
  await researchQueue.add('run-research', { shopId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}

export async function enqueueImport(shopId: string, candidateId: string) {
  await importQueue.add('import-product', { shopId, candidateId }, {
    attempts: 2,
  });
}

export async function enqueuePerformanceSync(shopId: string) {
  await performanceQueue.add('sync-perf', { shopId }, {
    attempts: 2,
  });
}

export async function enqueueReplacementEval(shopId: string) {
  await replacementQueue.add('evaluate-replacements', { shopId }, {
    attempts: 2,
  });
}

export async function enqueueStoreAnalysis(shopId: string) {
  await storeAnalysisQueue.add('analyze-store', { shopId }, {
    attempts: 2,
  });
}

// ── Workers ────────────────────────────────────

export function startWorkers() {
  // Research Worker
  new Worker('research', async (job: Job) => {
    const { shopId } = job.data;
    const jobRun = await createJobRun(shopId, 'RESEARCH_PRODUCTS');

    try {
      const result = await runResearchPipeline(shopId);
      await completeJobRun(jobRun.id, result);
      console.log(`✓ Research complete for ${shopId}: ${result.totalSaved} new candidates`);
    } catch (err: any) {
      await failJobRun(jobRun.id, err.message);
      throw err;
    }
  }, { connection, concurrency: 2 });

  // Import Worker
  new Worker('import', async (job: Job) => {
    const { shopId, candidateId } = job.data;
    const jobRun = await createJobRun(shopId, 'IMPORT_PRODUCT', { candidateId });

    try {
      const candidate = await prisma.candidateProduct.findUniqueOrThrow({
        where: { id: candidateId },
        include: { score: true },
      });

      const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });

      const cost = candidate.costPrice || 0;
      const price = candidate.suggestedPrice || cost * 2.5;

      // Create in Shopify
      const shopifyProduct = await createShopifyProduct(
        shop.shopDomain,
        shop.accessToken,
        {
          title: candidate.title,
          descriptionHtml: candidate.description || '',
          productType: candidate.category || '',
          tags: ['flexhunter', 'testing', `score:${Math.round(candidate.score?.finalScore || 0)}`],
          status: 'DRAFT',
          variants: [{ price: price.toFixed(2) }],
        }
      );

      if (candidate.imageUrls.length > 0) {
        await addProductImages(shop.shopDomain, shop.accessToken, shopifyProduct.id, candidate.imageUrls);
      }

      // Create ImportedProduct record
      await prisma.importedProduct.create({
        data: {
          shopId,
          candidateId,
          shopifyProductId: shopifyProduct.id.split('/').pop() || '',
          shopifyProductGid: shopifyProduct.id,
          shopifyHandle: shopifyProduct.handle,
          shopifyStatus: 'DRAFT',
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
        where: { id: candidateId },
        data: { status: 'IMPORTING' },
      });

      // Audit
      await prisma.auditLog.create({
        data: {
          shopId,
          action: 'PRODUCT_IMPORTED',
          entityType: 'CandidateProduct',
          entityId: candidateId,
          explanation: `Imported "${candidate.title}" to Shopify as draft`,
          details: { shopifyProductId: shopifyProduct.id, price },
        },
      });

      await completeJobRun(jobRun.id, { shopifyProductId: shopifyProduct.id });
      console.log(`✓ Imported "${candidate.title}" for ${shopId}`);
    } catch (err: any) {
      await failJobRun(jobRun.id, err.message);
      throw err;
    }
  }, { connection, concurrency: 3 });

  // Performance Sync Worker
  new Worker('performance', async (job: Job) => {
    const { shopId } = job.data;
    const jobRun = await createJobRun(shopId, 'SYNC_PERFORMANCE');

    try {
      await syncPerformance(shopId);
      await completeJobRun(jobRun.id);
      console.log(`✓ Performance synced for ${shopId}`);
    } catch (err: any) {
      await failJobRun(jobRun.id, err.message);
      throw err;
    }
  }, { connection, concurrency: 2 });

  // Replacement Worker
  new Worker('replacement', async (job: Job) => {
    const { shopId } = job.data;
    const jobRun = await createJobRun(shopId, 'SUGGEST_REPLACEMENTS');

    try {
      // Evaluate weak products
      const weakProducts = await evaluateWeakProducts(shopId);

      // Find and suggest replacements for each
      for (const weak of weakProducts) {
        const replacement = await findReplacementCandidate(shopId, weak.importedProductId);
        if (replacement) {
          await suggestReplacement(
            shopId,
            weak.importedProductId,
            replacement.candidateId,
            replacement.finalScore / 100,
            weak.reason,
            replacement.explanation
          );
        }
      }

      // Process based on automation mode
      await processReplacements(shopId);

      await completeJobRun(jobRun.id, { weakProducts: weakProducts.length });
      console.log(`✓ Replacement evaluation complete for ${shopId}: ${weakProducts.length} weak products`);
    } catch (err: any) {
      await failJobRun(jobRun.id, err.message);
      throw err;
    }
  }, { connection, concurrency: 1 });

  // Store Analysis Worker
  new Worker('store-analysis', async (job: Job) => {
    const { shopId } = job.data;
    const jobRun = await createJobRun(shopId, 'ANALYZE_STORE');

    try {
      const dna = await buildStoreDNA(shopId);
      await completeJobRun(jobRun.id, { vibe: dna.brandVibe, niches: dna.nicheKeywords });
      console.log(`✓ Store analysis complete for ${shopId}`);
    } catch (err: any) {
      await failJobRun(jobRun.id, err.message);
      throw err;
    }
  }, { connection, concurrency: 2 });

  console.log('✓ All workers started');
}

// ── Scheduled Jobs (cron-like) ─────────────────

export async function scheduleRecurringJobs() {
  // Add repeatable jobs for active shops
  const activeShops = await prisma.shop.findMany({
    where: { isActive: true },
    include: { settings: true },
  });

  for (const shop of activeShops) {
    if (!shop.settings?.onboardingComplete) continue;

    // Performance sync every 6 hours
    await performanceQueue.add('sync-perf', { shopId: shop.id }, {
      repeat: { pattern: '0 */6 * * *' },
      jobId: `perf-sync-${shop.id}`,
    });

    // Replacement evaluation daily
    await replacementQueue.add('evaluate-replacements', { shopId: shop.id }, {
      repeat: { pattern: '0 8 * * *' },
      jobId: `replacement-eval-${shop.id}`,
    });

    // Auto research if enabled
    if (shop.settings.autoResearchEnabled) {
      const days = shop.settings.researchFrequencyDays;
      await researchQueue.add('run-research', { shopId: shop.id }, {
        repeat: { pattern: `0 3 */${days} * *` },
        jobId: `research-${shop.id}`,
      });
    }
  }

  console.log(`✓ Scheduled recurring jobs for ${activeShops.length} shops`);
}
