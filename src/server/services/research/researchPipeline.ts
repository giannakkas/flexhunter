// ==============================================
// AI-Powered Deep Research Pipeline
// ==============================================
// Uses AI to generate targeted search queries,
// fetches real products, then uses AI to evaluate
// product-market fit with deep scoring.

import { v4 as uuid } from 'uuid';
import prisma from '../../utils/db';
import { analyzeDomainAndSave } from '../domain/domainEngine';
import { providerRegistry } from '../providers/providerRegistry';
import { scoreProduct } from '../scoring/scoringEngine';
import { aiComplete, aiAnalyzeProductFit } from '../../utils/ai';
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
 * Build store DNA from settings
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
 * Step 1: AI generates targeted search queries based on store profile
 */
async function generateSmartQueries(dna: StoreDNA, settings: MerchantSettingsData): Promise<string[]> {
  console.log(`[Research] Step 1: AI generating search queries...`);

  try {
    const prompt = `You are a product research expert for dropshipping e-commerce stores.

STORE PROFILE:
- Domain: ${dna.domain}
- Description: ${dna.description || 'General e-commerce store'}
- Target audience: ${settings.targetAudience?.join(', ') || 'general consumers'}
- Preferred categories: ${settings.preferredCategories?.join(', ') || 'trending products'}
- Price range: $${settings.priceRangeMin || 5} - $${settings.priceRangeMax || 100}
- Target countries: ${settings.targetCountries?.join(', ') || 'US, worldwide'}
- Brand vibe: ${dna.brandVibe}
- Domain signals: ${dna.domainIntent?.categoryBias?.join(', ') || 'none'}

Generate exactly 10 highly specific product search queries that would find WINNING dropshipping products for this store. 

Rules:
- Each query should be 2-5 words, optimized for product search engines
- Focus on trending, high-demand, high-margin products
- Mix between: proven winners, emerging trends, seasonal opportunities, viral products
- Avoid generic queries like "trending products" - be SPECIFIC
- Consider the store's niche, audience, and price range
- Include product types that have high social media appeal
- Think about what would actually sell well in this store

Return ONLY a JSON array of 10 strings. No explanation.`;

    const queries = await aiComplete<string[]>(prompt, {
      temperature: 0.7,
      maxTokens: 500,
      systemPrompt: 'You are a product research AI. Return only a JSON array of strings.',
    });

    if (Array.isArray(queries) && queries.length > 0) {
      console.log(`[Research] AI generated ${queries.length} queries: ${queries.join(', ')}`);
      return queries.slice(0, 10);
    }
  } catch (err: any) {
    console.warn(`[Research] AI query generation failed: ${err.message}`);
  }

  // Fallback: use categories + domain signals
  const fallback = [
    ...settings.preferredCategories.slice(0, 5),
    ...(dna.domainIntent?.categoryBias?.slice(0, 3) || []),
  ];
  if (fallback.length === 0) fallback.push('trending gadgets', 'viral products', 'unique gifts');
  console.log(`[Research] Using fallback queries: ${fallback.join(', ')}`);
  return fallback;
}

/**
 * Step 2: AI evaluates each product for deep fit analysis
 */
async function aiDeepScore(
  product: NormalizedProduct,
  dna: StoreDNA,
  settings: MerchantSettingsData,
): Promise<{
  aiScore: number;
  explanation: string;
  fitReasons: string[];
  concerns: string[];
  audienceFit: number;
  trendFit: number;
  visualVirality: number;
  novelty: number;
}> {
  try {
    const result = await aiAnalyzeProductFit(
      {
        title: product.title,
        description: product.description || product.title,
        category: product.category || 'General',
      },
      {
        description: dna.description || settings.storeDescription || '',
        audience: settings.targetAudience || [],
        domainKeywords: dna.nicheKeywords || [],
        vibe: dna.brandVibe || '',
        categories: settings.preferredCategories || [],
      }
    );

    const aiScore = Math.round(
      (result.audienceFit * 0.3 + result.trendFit * 0.25 +
       result.visualVirality * 0.25 + result.novelty * 0.2)
    );

    return {
      aiScore,
      explanation: result.explanation || '',
      fitReasons: result.fitReasons || [],
      concerns: result.concerns || [],
      audienceFit: result.audienceFit || 50,
      trendFit: result.trendFit || 50,
      visualVirality: result.visualVirality || 50,
      novelty: result.novelty || 50,
    };
  } catch (err: any) {
    console.warn(`[Research] AI scoring failed for "${product.title}": ${err.message}`);
    return {
      aiScore: 50,
      explanation: 'AI scoring unavailable',
      fitReasons: [],
      concerns: [],
      audienceFit: 50, trendFit: 50, visualVirality: 50, novelty: 50,
    };
  }
}

/**
 * Run the full AI-powered research pipeline
 */
export async function runResearchPipeline(shopId: string): Promise<ResearchResult> {
  const batchId = uuid();
  console.log(`[Research] ═══ Starting AI Deep Research ═══ batch ${batchId}`);
  const startTime = Date.now();

  // ── Step 0: Clear old non-imported candidates ──
  const oldCandidates = await prisma.candidateProduct.findMany({
    where: { shopId, status: { in: ['CANDIDATE', 'REJECTED'] }, importedProduct: { is: null } },
    select: { id: true },
  });
  if (oldCandidates.length > 0) {
    const ids = oldCandidates.map(c => c.id);
    await prisma.candidateScore.deleteMany({ where: { candidateId: { in: ids } } });
    await prisma.candidateProduct.deleteMany({ where: { id: { in: ids } } });
  }
  console.log(`[Research] Cleared ${oldCandidates.length} old candidates`);

  // ── Step 1: Build Store DNA ──
  const dna = await buildLightDNA(shopId);
  console.log(`[Research] DNA built for ${dna.domain}`);

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

  // ── Step 2: AI generates smart search queries ──
  const queries = await generateSmartQueries(dna, settingsData);

  // ── Step 3: Fetch products from ALL providers with AI queries ──
  console.log(`[Research] Step 3: Fetching from providers...`);
  const rawProducts: NormalizedProduct[] = [];

  for (const kw of queries) {
    try {
      const results = await providerRegistry.searchAll({
        keywords: [kw],
        minPrice: settingsData.priceRangeMin ?? undefined,
        maxPrice: settingsData.priceRangeMax ?? undefined,
        limit: 10,
      });
      rawProducts.push(...results);
    } catch (err) {
      console.warn(`[Research] Search failed for "${kw}":`, err);
    }
  }

  // Deduplicate by provider+id
  const seen = new Set<string>();
  const unique = rawProducts.filter((p) => {
    const key = `${p.providerType}-${p.providerProductId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`[Research] Fetched ${rawProducts.length} raw, ${unique.length} unique products`);

  // Filter banned categories
  const filtered = unique.filter((p) => {
    const cat = (p.category || '').toLowerCase();
    return !settingsData.bannedCategories.some((b) => cat.includes(b.toLowerCase()));
  });

  // ── Step 4: Initial code-based scoring (fast) ──
  console.log(`[Research] Step 4: Code-based scoring ${filtered.length} products...`);
  const preScored: (NormalizedProduct & { score: any })[] = [];
  for (const product of filtered) {
    try {
      const score = await scoreProduct(product, dna, settingsData, DEFAULT_SCORE_WEIGHTS, false);
      preScored.push({ ...product, score });
    } catch (err) {
      console.warn(`[Research] Pre-scoring failed for "${product.title}"`);
    }
  }

  // Sort by pre-score and take top candidates for AI deep analysis
  preScored.sort((a, b) => b.score.finalScore - a.score.finalScore);
  const topForAI = preScored.slice(0, Math.min(25, settingsData.maxCandidatesPerRun + 5));
  console.log(`[Research] Pre-scored ${preScored.length}, sending top ${topForAI.length} to AI`);

  // ── Step 5: AI Deep Analysis on top candidates ──
  console.log(`[Research] Step 5: AI deep-analyzing ${topForAI.length} products...`);
  const deepScored: (NormalizedProduct & { score: any; aiData: any })[] = [];

  for (const product of topForAI) {
    const aiData = await aiDeepScore(product, dna, settingsData);

    // Blend AI scores with code scores (AI gets 40% weight)
    const blended = { ...product.score };
    blended.audienceFit = blended.audienceFit * 0.6 + aiData.audienceFit * 0.4;
    blended.trendFit = blended.trendFit * 0.6 + aiData.trendFit * 0.4;
    blended.visualVirality = blended.visualVirality * 0.6 + aiData.visualVirality * 0.4;
    blended.novelty = blended.novelty * 0.6 + aiData.novelty * 0.4;

    // Recalculate final score with blended dimensions
    const w = DEFAULT_SCORE_WEIGHTS;
    blended.finalScore = Math.round(
      blended.domainFit * w.domainFit +
      blended.storeFit * w.storeFit +
      blended.audienceFit * w.audienceFit +
      blended.trendFit * w.trendFit +
      blended.visualVirality * w.visualVirality +
      blended.novelty * w.novelty +
      blended.priceFit * w.priceFit +
      blended.marginFit * w.marginFit +
      blended.shippingFit * w.shippingFit +
      blended.saturationInverse * w.saturationInverse +
      blended.refundRiskInverse * w.refundRiskInverse
    );

    // Use AI explanation and fit data
    blended.explanation = aiData.explanation || blended.explanation;
    blended.fitReasons = aiData.fitReasons.length > 0 ? aiData.fitReasons : blended.fitReasons;
    blended.concerns = aiData.concerns.length > 0 ? aiData.concerns : blended.concerns;
    blended.confidence = Math.min(100, (blended.confidence || 60) + 15); // AI boost

    deepScored.push({ ...product, score: blended, aiData });
  }

  // Final sort by AI-enhanced score
  deepScored.sort((a, b) => b.score.finalScore - a.score.finalScore);
  const topN = deepScored.slice(0, settingsData.maxCandidatesPerRun);
  console.log(`[Research] AI analysis complete. Saving top ${topN.length}`);

  // ── Step 6: Save to database ──
  let savedCount = 0;
  for (const product of topN) {
    try {
      const existing = await prisma.candidateProduct.findFirst({
        where: { shopId, providerType: product.providerType, providerProductId: product.providerProductId },
      });

      if (existing) {
        // Update score only
        await prisma.candidateScore.upsert({
          where: { candidateId: existing.id },
          create: { candidateId: existing.id, ...scoreFields(product.score) },
          update: scoreFields(product.score),
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
        data: { candidateId: candidate.id, ...scoreFields(product.score) },
      });

      savedCount++;
    } catch (err) {
      console.warn(`[Research] Failed to save "${product.title}"`);
    }
  }

  // ── Step 7: Ensure minimum time for thorough feel ──
  const elapsed = Date.now() - startTime;
  const minTime = 10000; // 10 seconds minimum
  if (elapsed < minTime) {
    await new Promise(r => setTimeout(r, minTime - elapsed));
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      shopId,
      action: 'RESEARCH_COMPLETED',
      details: {
        batchId,
        totalFetched: rawProducts.length,
        unique: unique.length,
        aiAnalyzed: topForAI.length,
        saved: savedCount,
        queries,
      } as any,
    },
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Research] ═══ Complete! ${savedCount} candidates saved in ${totalTime}s ═══`);

  return {
    batchId,
    totalFetched: rawProducts.length,
    totalScored: deepScored.length,
    totalSaved: savedCount,
    topCandidates: topN.slice(0, 5).map((p) => ({
      title: p.title,
      category: p.category,
      finalScore: p.score.finalScore,
      explanation: p.score.explanation,
    })),
  };
}

// Helper to extract score fields for Prisma
function scoreFields(score: any) {
  return {
    domainFit: score.domainFit,
    storeFit: score.storeFit,
    audienceFit: score.audienceFit,
    trendFit: score.trendFit,
    visualVirality: score.visualVirality,
    novelty: score.novelty,
    priceFit: score.priceFit,
    marginFit: score.marginFit,
    shippingFit: score.shippingFit,
    saturationInverse: score.saturationInverse,
    refundRiskInverse: score.refundRiskInverse,
    finalScore: score.finalScore,
    confidence: score.confidence,
    explanation: score.explanation,
    fitReasons: score.fitReasons,
    concerns: score.concerns,
    scoredAt: new Date(),
  };
}
