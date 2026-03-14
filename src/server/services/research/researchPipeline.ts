// ==============================================
// Multi-Agent AI Research Pipeline
// ==============================================
// Uses specialized AI agents to find, filter,
// and score products for the merchant's store.

import { v4 as uuid } from 'uuid';
import prisma from '../../utils/db';
import { analyzeDomainAndSave } from '../domain/domainEngine';
import { providerRegistry } from '../providers/providerRegistry';
import { aiComplete } from '../../utils/ai';
import { relevanceFilterAgent, MultiAgentScore } from '../agents';
import { runBatchMultiAgentScoring } from '../agents/batchScoring';
import { buildSignals, storeSignals } from '../signals';
import { getWeights } from '../signals/feedbackLoop';
import { StoreDNA, NormalizedProduct, MerchantSettingsData, DEFAULT_SCORE_WEIGHTS } from '../../../shared/types';

export interface ResearchResult {
  batchId: string;
  totalFetched: number;
  totalRelevant?: number;
  totalScored: number;
  totalSaved: number;
  message?: string;
  topCandidates: { title: string; category: string; finalScore: number; explanation: string; }[];
}

// ── Step 1: Build Store DNA ──────────────────────

async function buildLightDNA(shopId: string): Promise<StoreDNA> {
  const settings = await prisma.merchantSettings.findUniqueOrThrow({ where: { shopId } });
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
  const domain = shop.shopDomain.replace('.myshopify.com', '.com');
  const domainIntent = await analyzeDomainAndSave(shopId, domain);

  return {
    shopId, domain,
    description: settings.storeDescription || '',
    nicheKeywords: settings.preferredCategories.slice(0, 5),
    audienceSegments: settings.targetAudience,
    toneAttributes: ['trendy', 'youthful'],
    pricePositioning: 'mid',
    brandVibe: `${domain.split('.')[0]} store`,
    catalogGaps: [], catalogStrengths: settings.preferredCategories.slice(0, 3),
    topCategories: settings.preferredCategories,
    avgPrice: settings.priceRangeMin && settings.priceRangeMax
      ? (settings.priceRangeMin + settings.priceRangeMax) / 2 : null,
    domainIntent,
  };
}

// ── Step 2: AI Keyword Generation ────────────────

async function generateKeywords(dna: StoreDNA, settings: MerchantSettingsData): Promise<string[]> {
  const storeDesc = dna.description || settings.preferredCategories?.join(', ') || 'general products';

  const prompt = `Generate exactly 15 product search keywords for a store that sells: "${storeDesc}"
Target audience: ${settings.targetAudience?.join(', ') || 'general'}
Price range: $${settings.priceRangeMin || 5}-$${settings.priceRangeMax || 100}

RULES:
- ALL keywords must be for products in the "${storeDesc}" niche
- Each keyword should find a DIFFERENT product type (not variations of the same thing)
- Keywords should be 2-4 words, specific enough for product search
- Think like a customer shopping in this store — what would they search for?
- Include both core products and complementary accessories

Return a JSON array of exactly 15 strings.`;

  try {
    const result = await aiComplete<string[]>(prompt, {
      temperature: 0.5,
      maxTokens: 500,
      systemPrompt: `Product keyword generator for "${storeDesc}" store. Return only a JSON array of 15 strings.`,
    });
    if (Array.isArray(result) && result.length > 0) {
      console.log(`[Research] AI keywords (${result.length}): ${result.join(', ')}`);
      return result;
    }
  } catch (err) {
    console.warn('[Research] Keyword generation failed:', err);
  }

  // Fallback
  return [...(settings.preferredCategories || []).slice(0, 5), storeDesc].filter(Boolean);
}

// ── Step 3: Fetch Products ───────────────────────

async function fetchProducts(
  keywords: string[],
  settings: MerchantSettingsData,
): Promise<NormalizedProduct[]> {
  const rawProducts: NormalizedProduct[] = [];

  // Search all keywords across all providers
  for (const kw of keywords) {
    try {
      const results = await providerRegistry.searchAll({
        keywords: [kw],
        minPrice: settings.priceRangeMin ?? undefined,
        maxPrice: settings.priceRangeMax ?? undefined,
        limit: 20,
      });
      rawProducts.push(...results);
      if (results.length > 0) console.log(`[Research]   "${kw}": ${results.length} products`);
    } catch {}
  }

  // Page 2 for first 5 keywords
  for (const kw of keywords.slice(0, 5)) {
    try {
      const results = await providerRegistry.searchAll({ keywords: [kw], limit: 20, page: 2 });
      rawProducts.push(...results);
    } catch {}
  }

  // Deduplicate
  const seen = new Set<string>();
  const seenTitles = new Set<string>();
  return rawProducts.filter(p => {
    const key = `${p.providerType}-${p.providerProductId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const titleKey = (p.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 35);
    if (titleKey.length > 10 && seenTitles.has(titleKey)) return false;
    seenTitles.add(titleKey);
    return true;
  });
}

// ── Step 4: AI Relevance Filtering ──────────────

async function filterRelevant(
  products: NormalizedProduct[],
  storeDescription: string,
): Promise<NormalizedProduct[]> {
  if (products.length === 0) return [];

  // Process in batches of 60 for the relevance filter (1 AI call per batch)
  const batchSize = 60;
  const relevant: NormalizedProduct[] = [];

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const indices = await relevanceFilterAgent(batch, storeDescription);
    for (const idx of indices) {
      if (batch[idx]) relevant.push(batch[idx]);
    }
  }

  console.log(`[Research] Relevance filter: ${products.length} → ${relevant.length} products`);
  return relevant;
}

// ── Step 5: Multi-Agent Deep Scoring ────────────

async function deepScore(
  products: NormalizedProduct[],
  dna: StoreDNA,
  settings: MerchantSettingsData,
  maxResults: number,
  shopId: string,
): Promise<(NormalizedProduct & { agentScore: MultiAgentScore })[]> {
  const results: (NormalizedProduct & { agentScore: MultiAgentScore })[] = [];

  // Get shop-specific weights (learned from outcomes if enough data)
  const weights = await getWeights(shopId);
  const defaultW = { storeFit: 0.25, profitability: 0.15, trendPotential: 0.15, viralPrediction: 0.20, saturation: 0.10, supplierQuality: 0.15 };
  const isLearned = JSON.stringify(weights) !== JSON.stringify(defaultW);
  if (isLearned) console.log(`[Research] Using learned weights for shop ${shopId}`);

  // BATCH SCORING: 1 AI call per 5 products (was 3 calls per 1 product)
  const batchSize = 5;
  let aiCallCount = 0;

  for (let i = 0; i < products.length && results.length < maxResults; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const scores = await runBatchMultiAgentScoring(batch, dna, settings);
    aiCallCount++;

    for (let j = 0; j < batch.length; j++) {
      const score = scores[j];
      if (!score) continue;

      // Recalculate with learned weights
      if (isLearned) {
        score.finalScore = Math.round(
          score.storeFit.score * weights.storeFit +
          score.profitability.score * weights.profitability +
          score.trendPotential.score * weights.trendPotential +
          score.viralPrediction.viralScore * weights.viralPrediction +
          score.saturation.score * weights.saturation +
          score.supplierQuality.score * weights.supplierQuality
        );
      }

      if (score.recommendation === 'avoid') continue;

      // Store signals in feature store
      const signals = buildSignals(batch[j].providerProductId, shopId, score, batch[j]);
      storeSignals(signals).catch(() => {});

      results.push({ ...batch[j], agentScore: score });
    }
  }

  console.log(`[Research] Batch scored ${products.length} products in ${aiCallCount} AI calls`);
  results.sort((a, b) => b.agentScore.finalScore - a.agentScore.finalScore);
  return results.slice(0, maxResults);
}

// ── Main Pipeline ────────────────────────────────

export async function runResearchPipeline(shopId: string): Promise<ResearchResult> {
  const batchId = uuid();
  console.log(`\n[Research] ══════════════════════════════════════`);
  console.log(`[Research] Starting Multi-Agent Research Pipeline`);
  console.log(`[Research] Shop: ${shopId} | Batch: ${batchId}`);
  console.log(`[Research] ══════════════════════════════════════\n`);

  // Pre-check providers
  const available = providerRegistry.getAvailable().filter(p => p.name !== 'CSV Feed' && p.name !== 'Manual Entry');
  if (available.length === 0) {
    throw new Error('No product sources available. Add GEMINI_API_KEY, CJ_API_KEY, or RAPIDAPI_KEY in Railway.');
  }
  console.log(`[Research] Providers: ${available.map(p => p.name).join(', ')}`);

  // Step 1: Build DNA
  const dna = await buildLightDNA(shopId);
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
  const maxCandidates = 27;
  const storeDesc = dna.description || settings.storeDescription || 'products';
  console.log(`[Research] Step 1/6: DNA built — "${storeDesc}"`);

  // Step 2: Generate keywords
  const keywords = await generateKeywords(dna, settingsData);
  console.log(`[Research] Step 2/6: ${keywords.length} keywords generated`);

  // Step 3: Fetch products
  const allProducts = await fetchProducts(keywords, settingsData);
  console.log(`[Research] Step 3/6: ${allProducts.length} unique products fetched`);

  if (allProducts.length === 0) {
    throw new Error(`No products found. Check your API keys (CJ_API_KEY, RAPIDAPI_KEY) and try broader store description.`);
  }

  // Step 4: AI Relevance Filter (fast, batch)
  const relevant = await filterRelevant(allProducts, storeDesc);

  if (relevant.length === 0) {
    // If filter was too strict, take top by order volume as fallback
    console.warn(`[Research] Relevance filter returned 0! Using top ${maxCandidates} by volume.`);
    relevant.push(...allProducts.sort((a, b) => (b.orderVolume || 0) - (a.orderVolume || 0)).slice(0, maxCandidates));
  }
  console.log(`[Research] Step 4/6: ${relevant.length} relevant products`);

  // Step 5: Multi-Agent Deep Scoring
  console.log(`[Research] Step 5/6: Running BATCH AI scoring (1 call per 5 products)...`);
  const scored = await deepScore(relevant, dna, settingsData, maxCandidates, shopId);
  console.log(`[Research] Step 5/6: ${scored.length} products scored and ranked`);

  // Step 6: Save results
  // Only clear old candidates if we actually found new ones
  if (scored.length === 0) {
    console.warn(`[Research] ⚠️ Scoring returned 0 products — keeping existing candidates`);
    return {
      totalFetched: allProducts.length,
      totalRelevant: relevant.length,
      totalScored: 0,
      totalSaved: 0,
      batchId,
      message: 'AI scoring returned 0 products. This usually means the AI service is rate-limited. Please wait a minute and try again.',
      topCandidates: [],
    };
  }

  const deletedOld = await prisma.candidateProduct.deleteMany({
    where: { shopId, status: { in: ['CANDIDATE', 'REJECTED'] }, importedProduct: null },
  });
  console.log(`[Research] Step 6/6: Cleared ${deletedOld.count} old, saving ${scored.length} new`);

  let savedCount = 0;
  for (const product of scored) {
    try {
      const agentScore = product.agentScore;

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
          domainFit: agentScore.storeFit.score,
          storeFit: agentScore.storeFit.score,
          audienceFit: agentScore.storeFit.score,
          trendFit: agentScore.trendPotential.score,
          visualVirality: agentScore.viralPrediction.viralScore,
          novelty: agentScore.saturation.score,
          priceFit: agentScore.profitability.score,
          marginFit: agentScore.profitability.score,
          shippingFit: agentScore.supplierQuality.score,
          saturationInverse: agentScore.saturation.score,
          refundRiskInverse: agentScore.supplierQuality.score,
          finalScore: agentScore.finalScore,
          confidence: agentScore.storeFit.confidence,
          explanation: (() => {
            const signals = buildSignals(candidate.id, shopId, agentScore, product);
            const evLevel = signals.evidenceCompleteness >= 0.7 ? 'HIGH' : signals.evidenceCompleteness >= 0.4 ? 'MEDIUM' : 'LOW';
            return `[${evLevel} confidence, ${signals.signalCount}/22 signals] ${agentScore.explanation}`;
          })(),
          fitReasons: [
            ...agentScore.storeFit.signals,
            ...agentScore.profitability.signals.slice(0, 2),
            ...agentScore.viralPrediction.signals.slice(0, 2),
            ...agentScore.trendPotential.signals.slice(0, 1),
          ],
          concerns: [
            ...(agentScore.storeFit.score < 60 ? ['Moderate store fit'] : []),
            ...(agentScore.saturation.score < 40 ? ['High market saturation'] : []),
            ...(agentScore.supplierQuality.score < 40 ? ['Shipping quality concerns'] : []),
            ...(agentScore.viralPrediction.trendStage === 'saturated' ? ['Product may be past peak'] : []),
          ],
          scoredAt: new Date(),
        },
      });

      savedCount++;
    } catch (err) {
      console.warn(`[Research] Failed to save "${product.title}":`, err);
    }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      shopId,
      action: 'RESEARCH_COMPLETED',
      details: {
        batchId,
        totalFetched: allProducts.length,
        relevantFiltered: relevant.length,
        scored: scored.length,
        saved: savedCount,
        keywords,
        providers: available.map(p => p.name),
      } as any,
    },
  }).catch(() => {});

  console.log(`\n[Research] ══════════════════════════════════════`);
  console.log(`[Research] COMPLETE: ${savedCount} products saved`);
  console.log(`[Research] Pipeline: ${allProducts.length} fetched → ${relevant.length} relevant → ${scored.length} scored → ${savedCount} saved`);
  console.log(`[Research] ══════════════════════════════════════\n`);

  return {
    batchId,
    totalFetched: allProducts.length,
    totalScored: scored.length,
    totalSaved: savedCount,
    topCandidates: scored.slice(0, 5).map(p => ({
      title: p.title,
      category: p.category,
      finalScore: p.agentScore.finalScore,
      explanation: p.agentScore.explanation,
    })),
  };
}
