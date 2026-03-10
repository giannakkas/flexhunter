// ==============================================
// Research Pipeline
// ==============================================
// Orchestrates the full product research flow:
// 1. Load/build store DNA
// 2. Fetch candidates from providers
// 3. Normalize data
// 4. Score all candidates
// 5. Save to database
// 6. Generate explanations

import { v4 as uuid } from 'uuid';
import prisma from '../../utils/db';
import { buildStoreDNA, loadStoreDNA } from '../store-dna/storeDnaEngine';
import { providerRegistry } from '../providers/providerRegistry';
import { scoreProducts } from '../scoring/scoringEngine';
import { StoreDNA, NormalizedProduct, MerchantSettingsData } from '../../../shared/types';

export interface ResearchResult {
  batchId: string;
  totalFetched: number;
  totalScored: number;
  totalSaved: number;
  topCandidates: {
    title: string;
    category: string;
    finalScore: number;
    explanation: string;
  }[];
}

/**
 * Run the full research pipeline for a shop
 */
export async function runResearchPipeline(shopId: string): Promise<ResearchResult> {
  const batchId = uuid();
  console.log(`[Research] Starting pipeline for shop ${shopId}, batch ${batchId}`);

  // ── Step 1: Load or build Store DNA ──────────
  let dna = await loadStoreDNA(shopId);
  if (!dna) {
    console.log('[Research] No existing DNA, building fresh...');
    dna = await buildStoreDNA(shopId);
  }

  // ── Step 2: Load merchant settings ───────────
  const settings = await prisma.merchantSettings.findUniqueOrThrow({
    where: { shopId },
  });

  const settingsData: MerchantSettingsData = {
    storeDescription: settings.storeDescription,
    targetAudience: settings.targetAudience,
    targetCountries: settings.targetCountries,
    preferredCategories: settings.preferredCategories,
    bannedCategories: settings.bannedCategories,
    priceRangeMin: settings.priceRangeMin,
    priceRangeMax: settings.priceRangeMax,
    minimumMarginPercent: settings.minimumMarginPercent,
    desiredShippingSpeed: settings.desiredShippingSpeed,
    replacementMode: settings.replacementMode,
    maxCandidatesPerRun: settings.maxCandidatesPerRun,
  };

  // ── Step 3: Generate search keywords from DNA ─
  const searchKeywords = generateSearchKeywords(dna, settingsData);
  console.log(`[Research] Search keywords: ${searchKeywords.join(', ')}`);

  // ── Step 4: Fetch from providers ─────────────
  const rawProducts: NormalizedProduct[] = [];

  for (const keywords of searchKeywords) {
    const results = await providerRegistry.searchAll({
      keywords: [keywords],
      minPrice: settingsData.priceRangeMin ?? undefined,
      maxPrice: settingsData.priceRangeMax ?? undefined,
      limit: 20,
    });
    rawProducts.push(...results);
  }

  // Deduplicate by provider + product ID
  const seen = new Set<string>();
  const uniqueProducts = rawProducts.filter((p) => {
    const key = `${p.providerType}-${p.providerProductId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[Research] Fetched ${rawProducts.length} total, ${uniqueProducts.length} unique`);

  // ── Step 5: Filter out banned categories ─────
  const filtered = uniqueProducts.filter((p) => {
    const category = (p.category || '').toLowerCase();
    return !settingsData.bannedCategories.some((banned) =>
      category.includes(banned.toLowerCase())
    );
  });

  // ── Step 6: Score all candidates ─────────────
  const scored = await scoreProducts(
    filtered,
    dna,
    settingsData,
    undefined, // default weights
    true // use AI enrichment
  );

  console.log(`[Research] Scored ${scored.length} products`);

  // ── Step 7: Take top N candidates ────────────
  const topN = scored.slice(0, settingsData.maxCandidatesPerRun);

  // ── Step 8: Save to database ─────────────────
  let savedCount = 0;
  for (const product of topN) {
    try {
      // Check if we already have this product
      const existing = await prisma.candidateProduct.findFirst({
        where: {
          shopId,
          providerType: product.providerType,
          providerProductId: product.providerProductId,
        },
      });

      if (existing) {
        // Update score
        await prisma.candidateScore.upsert({
          where: { candidateId: existing.id },
          create: {
            candidateId: existing.id,
            ...product.score,
            scoredAt: new Date(),
          },
          update: {
            ...product.score,
            scoredAt: new Date(),
          },
        });
        continue;
      }

      // Create new candidate
      const candidate = await prisma.candidateProduct.create({
        data: {
          shopId,
          providerType: product.providerType,
          providerProductId: product.providerProductId,
          sourceUrl: product.sourceUrl,
          sourceName: product.sourceName,
          title: product.title,
          description: product.description,
          category: product.category,
          subcategory: product.subcategory,
          imageUrls: product.imageUrls,
          variants: product.variants,
          costPrice: product.costPrice,
          suggestedPrice: product.suggestedPrice,
          currency: product.currency,
          shippingCost: product.shippingCost,
          shippingDays: product.shippingDays,
          shippingSpeed: product.shippingSpeed,
          warehouseCountry: product.warehouseCountry,
          reviewCount: product.reviewCount,
          reviewRating: product.reviewRating,
          orderVolume: product.orderVolume,
          supplierRating: product.supplierRating,
          rawData: product.rawData,
          researchBatchId: batchId,
          status: 'CANDIDATE',
        },
      });

      // Save score
      await prisma.candidateScore.create({
        data: {
          candidateId: candidate.id,
          ...product.score,
          scoredAt: new Date(),
        },
      });

      savedCount++;
    } catch (err) {
      console.warn(`[Research] Failed to save product ${product.title}:`, err);
    }
  }

  // ── Step 9: Audit log ────────────────────────
  await prisma.auditLog.create({
    data: {
      shopId,
      action: 'RESEARCH_COMPLETED',
      details: {
        batchId,
        totalFetched: rawProducts.length,
        uniqueProducts: uniqueProducts.length,
        scored: scored.length,
        saved: savedCount,
      },
    },
  });

  console.log(`[Research] Pipeline complete. Saved ${savedCount} new candidates.`);

  return {
    batchId,
    totalFetched: rawProducts.length,
    totalScored: scored.length,
    totalSaved: savedCount,
    topCandidates: topN.slice(0, 5).map((p) => ({
      title: p.title,
      category: p.category,
      finalScore: p.score.finalScore,
      explanation: p.score.explanation,
    })),
  };
}

/**
 * Generate smart search keywords from store DNA
 */
function generateSearchKeywords(dna: StoreDNA, settings: MerchantSettingsData): string[] {
  const keywords = new Set<string>();

  // From preferred categories
  for (const cat of settings.preferredCategories.slice(0, 5)) {
    keywords.add(cat);
  }

  // From niche keywords
  for (const kw of dna.nicheKeywords.slice(0, 5)) {
    keywords.add(kw);
  }

  // From catalog gaps
  for (const gap of dna.catalogGaps.slice(0, 3)) {
    keywords.add(gap);
  }

  // From domain signals
  for (const bias of dna.domainIntent?.categoryBias?.slice(0, 3) || []) {
    keywords.add(bias);
  }

  // Fallback
  if (keywords.size === 0) {
    keywords.add('trending gadgets');
    keywords.add('viral products');
  }

  return [...keywords];
}
