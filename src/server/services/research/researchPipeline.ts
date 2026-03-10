// ==============================================
// Research Pipeline
// ==============================================

import { v4 as uuid } from 'uuid';
import prisma from '../../utils/db';
import { analyzeDomainAndSave } from '../domain/domainEngine';
import { providerRegistry } from '../providers/providerRegistry';
import { scoreProduct } from '../scoring/scoringEngine';
import { StoreDNA, NormalizedProduct, MerchantSettingsData, DEFAULT_SCORE_WEIGHTS } from '../../../shared/types';

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
 * Build a lightweight store DNA from settings only (no Shopify API, no OpenAI)
 */
async function buildLightDNA(shopId: string): Promise<StoreDNA> {
  const settings = await prisma.merchantSettings.findUniqueOrThrow({ where: { shopId } });
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });

  const domain = shop.shopDomain.replace('.myshopify.com', '.com');
  const domainIntent = await analyzeDomainAndSave(shopId, domain);

  return {
    shopId,
    domain,
    description: settings.storeDescription || '',
    nicheKeywords: settings.preferredCategories.slice(0, 5),
    audienceSegments: settings.targetAudience,
    toneAttributes: ['trendy', 'youthful'],
    pricePositioning: 'mid',
    brandVibe: `${domain.split('.')[0]} store`,
    catalogGaps: [],
    catalogStrengths: settings.preferredCategories.slice(0, 3),
    topCategories: settings.preferredCategories,
    avgPrice: settings.priceRangeMin && settings.priceRangeMax
      ? (settings.priceRangeMin + settings.priceRangeMax) / 2 : null,
    domainIntent,
  };
}

/**
 * Run the full research pipeline for a shop
 */
export async function runResearchPipeline(shopId: string): Promise<ResearchResult> {
  const batchId = uuid();
  console.log(`[Research] Starting pipeline for shop ${shopId}, batch ${batchId}`);

  // Step 1: Build store DNA (lightweight, no external APIs)
  const dna = await buildLightDNA(shopId);
  console.log(`[Research] DNA built for ${dna.domain}`);

  // Step 2: Load settings
  const settings = await prisma.merchantSettings.findUniqueOrThrow({ where: { shopId } });
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

  // Step 3: Generate search keywords
  const keywords = [
    ...settings.preferredCategories.slice(0, 5),
    ...(dna.domainIntent?.categoryBias?.slice(0, 3) || []),
  ];
  if (keywords.length === 0) keywords.push('trending gadgets', 'viral products');
  console.log(`[Research] Keywords: ${keywords.join(', ')}`);

  // Step 4: Fetch from ALL providers
  const rawProducts: NormalizedProduct[] = [];
  for (const kw of keywords) {
    try {
      const results = await providerRegistry.searchAll({
        keywords: [kw],
        minPrice: settingsData.priceRangeMin ?? undefined,
        maxPrice: settingsData.priceRangeMax ?? undefined,
        limit: 20,
      });
      rawProducts.push(...results);
    } catch (err) {
      console.warn(`[Research] Provider search failed for "${kw}":`, err);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = rawProducts.filter((p) => {
    const key = `${p.providerType}-${p.providerProductId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`[Research] Fetched ${rawProducts.length}, unique: ${unique.length}`);

  // Step 5: Filter banned categories
  const filtered = unique.filter((p) => {
    const cat = (p.category || '').toLowerCase();
    return !settingsData.bannedCategories.some((b) => cat.includes(b.toLowerCase()));
  });

  // Step 6: Score all (NO AI for now - pure code scoring)
  const scored: (NormalizedProduct & { score: any })[] = [];
  for (const product of filtered) {
    try {
      const score = await scoreProduct(product, dna, settingsData, DEFAULT_SCORE_WEIGHTS, false);
      scored.push({ ...product, score });
    } catch (err) {
      console.warn(`[Research] Scoring failed for "${product.title}":`, err);
    }
  }

  // Sort by score
  scored.sort((a, b) => b.score.finalScore - a.score.finalScore);
  const topN = scored.slice(0, settingsData.maxCandidatesPerRun);
  console.log(`[Research] Scored ${scored.length}, saving top ${topN.length}`);

  // Step 7: Save to database
  let savedCount = 0;
  for (const product of topN) {
    try {
      const existing = await prisma.candidateProduct.findFirst({
        where: {
          shopId,
          providerType: product.providerType,
          providerProductId: product.providerProductId,
        },
      });

      if (existing) {
        await prisma.candidateScore.upsert({
          where: { candidateId: existing.id },
          create: {
            candidateId: existing.id,
            domainFit: product.score.domainFit,
            storeFit: product.score.storeFit,
            audienceFit: product.score.audienceFit,
            trendFit: product.score.trendFit,
            visualVirality: product.score.visualVirality,
            novelty: product.score.novelty,
            priceFit: product.score.priceFit,
            marginFit: product.score.marginFit,
            shippingFit: product.score.shippingFit,
            saturationInverse: product.score.saturationInverse,
            refundRiskInverse: product.score.refundRiskInverse,
            finalScore: product.score.finalScore,
            confidence: product.score.confidence,
            explanation: product.score.explanation,
            fitReasons: product.score.fitReasons,
            concerns: product.score.concerns,
            scoredAt: new Date(),
          },
          update: {
            domainFit: product.score.domainFit,
            storeFit: product.score.storeFit,
            audienceFit: product.score.audienceFit,
            trendFit: product.score.trendFit,
            visualVirality: product.score.visualVirality,
            novelty: product.score.novelty,
            priceFit: product.score.priceFit,
            marginFit: product.score.marginFit,
            shippingFit: product.score.shippingFit,
            saturationInverse: product.score.saturationInverse,
            refundRiskInverse: product.score.refundRiskInverse,
            finalScore: product.score.finalScore,
            confidence: product.score.confidence,
            explanation: product.score.explanation,
            fitReasons: product.score.fitReasons,
            concerns: product.score.concerns,
            scoredAt: new Date(),
          },
        });
        continue;
      }

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
          variants: product.variants as any,
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
          rawData: product.rawData as any,
          researchBatchId: batchId,
          status: 'CANDIDATE',
        },
      });

      await prisma.candidateScore.create({
        data: {
          candidateId: candidate.id,
          domainFit: product.score.domainFit,
          storeFit: product.score.storeFit,
          audienceFit: product.score.audienceFit,
          trendFit: product.score.trendFit,
          visualVirality: product.score.visualVirality,
          novelty: product.score.novelty,
          priceFit: product.score.priceFit,
          marginFit: product.score.marginFit,
          shippingFit: product.score.shippingFit,
          saturationInverse: product.score.saturationInverse,
          refundRiskInverse: product.score.refundRiskInverse,
          finalScore: product.score.finalScore,
          confidence: product.score.confidence,
          explanation: product.score.explanation,
          fitReasons: product.score.fitReasons,
          concerns: product.score.concerns,
          scoredAt: new Date(),
        },
      });

      savedCount++;
    } catch (err) {
      console.warn(`[Research] Failed to save "${product.title}":`, err);
    }
  }

  // Step 8: Audit log
  await prisma.auditLog.create({
    data: {
      shopId,
      action: 'RESEARCH_COMPLETED',
      details: {
        batchId,
        totalFetched: rawProducts.length,
        unique: unique.length,
        scored: scored.length,
        saved: savedCount,
      } as any,
    },
  });

  console.log(`[Research] Complete! Saved ${savedCount} candidates.`);

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
