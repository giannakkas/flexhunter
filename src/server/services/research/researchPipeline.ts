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

  // Fallback — use niche keywords from Store DNA
  const fallback = [
    ...(dna.nicheKeywords || []).slice(0, 8),
    ...(settings.preferredCategories || []).slice(0, 3),
    storeDesc,
  ].filter(Boolean);
  console.log(`[Research] Using fallback keywords: ${fallback.join(', ')}`);
  return fallback;
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
  const allScored: (NormalizedProduct & { agentScore: MultiAgentScore })[] = [];

  // Get shop-specific weights
  const weights = await getWeights(shopId);
  const defaultW = { storeFit: 0.25, profitability: 0.15, trendPotential: 0.15, viralPrediction: 0.20, saturation: 0.10, supplierQuality: 0.15 };
  const isLearned = JSON.stringify(weights) !== JSON.stringify(defaultW);
  if (isLearned) console.log(`[Research] Using learned weights for shop ${shopId}`);

  const batchSize = 5;
  let aiCallCount = 0;
  let nullCount = 0;
  let avoidCount = 0;

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    let scores: (MultiAgentScore | null)[];
    
    try {
      scores = await runBatchMultiAgentScoring(batch, dna, settings);
      aiCallCount++;
    } catch (err: any) {
      console.error(`[Research] Batch scoring FAILED: ${err.message}`);
      scores = batch.map(() => null);
    }

    for (let j = 0; j < batch.length; j++) {
      const score = scores[j];
      if (!score) { nullCount++; continue; }

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

      if (score.recommendation === 'avoid') avoidCount++;

      // Store signals
      try { const signals = buildSignals(batch[j].providerProductId, shopId, score, batch[j]); storeSignals(signals).catch(() => {}); } catch {}

      allScored.push({ ...batch[j], agentScore: score });
    }
  }

  console.log(`[Research] Scoring: ${products.length} products → ${allScored.length} scored, ${nullCount} null, ${avoidCount} avoid, ${aiCallCount} AI calls`);

  // Sort by score
  allScored.sort((a, b) => b.agentScore.finalScore - a.agentScore.finalScore);

  // Filter out "avoid" — but NEVER return 0 results if we have scored products
  const good = allScored.filter(p => p.agentScore.recommendation !== 'avoid');
  
  if (good.length >= 3) {
    return good.slice(0, maxResults);
  }
  
  // If too few passed, return top scored regardless of recommendation
  console.warn(`[Research] Only ${good.length} non-avoid products — returning top ${Math.min(allScored.length, maxResults)} by score`);
  return allScored.slice(0, maxResults);
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
  let relevant = await filterRelevant(allProducts, storeDesc);

  if (relevant.length === 0) {
    // If filter was too strict, take top by order volume as fallback
    console.warn(`[Research] Relevance filter returned 0! Using top ${maxCandidates} by volume.`);
    relevant.push(...allProducts.sort((a, b) => (b.orderVolume || 0) - (a.orderVolume || 0)).slice(0, maxCandidates));
  }

  // Step 4.5: Keyword-based store-fit safety net (NO AI needed)
  // Removes products that clearly don't match the store niche
  const nicheKeywords = (dna.nicheKeywords || []).map(k => k.toLowerCase());
  const storeWords = storeDesc.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const allNicheWords = [...new Set([...nicheKeywords, ...storeWords])].filter(Boolean);

  if (allNicheWords.length > 0) {
    const beforeCount = relevant.length;
    relevant = relevant.filter(p => {
      const titleLower = (p.title + ' ' + p.category + ' ' + p.description).toLowerCase();
      // Product must match at least 1 niche keyword
      const matches = allNicheWords.some(kw => titleLower.includes(kw));
      return matches;
    });

    // If keyword filter removed too many, keep top half by volume
    if (relevant.length < 5 && beforeCount > 5) {
      console.warn(`[Research] Keyword filter too strict (${beforeCount} → ${relevant.length}). Relaxing...`);
      relevant = allProducts.sort((a, b) => (b.orderVolume || 0) - (a.orderVolume || 0)).slice(0, maxCandidates);
    } else {
      console.log(`[Research] Step 4.5: Keyword filter: ${beforeCount} → ${relevant.length} (matched niche: ${allNicheWords.slice(0, 5).join(', ')})`);
    }
  }

  console.log(`[Research] Step 4/6: ${relevant.length} relevant products`);

  // Step 5: Multi-Agent Deep Scoring
  console.log(`[Research] Step 5/6: Running BATCH AI scoring (1 call per 5 products)...`);
  let scored: (NormalizedProduct & { agentScore: MultiAgentScore })[] = [];
  
  try {
    scored = await deepScore(relevant, dna, settingsData, maxCandidates, shopId);
  } catch (err: any) {
    console.error(`[Research] ❌ SCORING CRASHED: ${err.message}`);
    console.error(err.stack?.slice(0, 300));
  }

  // ABSOLUTE FALLBACK: if scoring produced nothing, create basic scores algorithmically
  if (scored.length === 0 && relevant.length > 0) {
    console.warn(`[Research] ⚠️ Scoring returned 0 — using ALGORITHMIC FALLBACK for ${relevant.length} products`);
    const { supplierQualityAgent, profitAgent, trendAgent } = await import('../agents');
    
    for (const p of relevant.slice(0, maxCandidates)) {
      try {
        const profit = await profitAgent(p);
        const trend = await trendAgent(p);
        const supplier = supplierQualityAgent(p);
        const finalScore = Math.round(profit.score * 0.30 + trend.score * 0.30 + supplier.score * 0.20 + 50 * 0.20);
        
        scored.push({
          ...p,
          agentScore: {
            storeFit: { score: 50, confidence: 0.2, reasoning: 'Default score — limited data', signals: [] },
            profitability: profit,
            trendPotential: trend,
            viralPrediction: { viralScore: 30, trendStage: 'stable_trend' as any, velocity7d: 0, accelerationRate: 1, confidence: 0.2, signals: ['⚠️ Limited data — basic scoring applied'], explanation: 'Limited data available' },
            saturation: { score: 50, confidence: 0.2, reasoning: 'Default score — limited data', signals: [] },
            supplierQuality: supplier,
            finalScore,
            recommendation: finalScore >= 60 ? 'maybe' : 'skip',
            explanation: `Algorithmic fallback — AI unavailable. Profit: ${profit.reasoning}. Trend: ${trend.reasoning}. [AI scoring failed — results may be less accurate]`,
          },
        });
      } catch {}
    }
    scored.sort((a, b) => b.agentScore.finalScore - a.agentScore.finalScore);
  }

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
      message: 'Scoring returned 0 products. This usually means the AI service is rate-limited. Please wait a minute and try again.',
      topCandidates: [],
    };
  }

  // Delete old candidates that haven't been imported
  // First find IDs of candidates that HAVE been imported (to exclude them)
  const importedCandidateIds = await prisma.importedProduct.findMany({
    where: { shopId },
    select: { candidateId: true },
  }).then(items => items.map(i => i.candidateId).filter(Boolean));

  const deletedOld = await prisma.candidateProduct.deleteMany({
    where: {
      shopId,
      id: { notIn: importedCandidateIds },
    },
  });
  console.log(`[Research] Step 6/6: Cleared ${deletedOld.count} old candidates (preserved ${importedCandidateIds.length} imported), saving ${scored.length} new`);

  let savedCount = 0;
  const saveErrors: string[] = [];
  
  for (const product of scored) {
    try {
      const agentScore = product.agentScore;

      // Build explanation safely
      let explanation = agentScore.explanation || 'AI scored';
      try {
        const signals = buildSignals(product.providerProductId || 'unknown', shopId, agentScore, product);
        const evLevel = signals.evidenceCompleteness >= 0.7 ? 'HIGH' : signals.evidenceCompleteness >= 0.4 ? 'MEDIUM' : 'LOW';
        explanation = `[${evLevel} confidence, ${signals.signalCount}/22 signals] ${explanation}`;
      } catch {}

      // Safe array access
      const fitReasons = [
        ...(Array.isArray(agentScore.storeFit?.signals) ? agentScore.storeFit.signals.slice(0, 3) : []),
        ...(Array.isArray(agentScore.profitability?.signals) ? agentScore.profitability.signals.slice(0, 2) : []),
        ...(Array.isArray(agentScore.viralPrediction?.signals) ? agentScore.viralPrediction.signals.slice(0, 2) : []),
      ].filter(s => typeof s === 'string' && s.length > 0);

      const concerns = [
        ...(agentScore.storeFit?.score < 60 ? ['Moderate store fit'] : []),
        ...(agentScore.saturation?.score < 40 ? ['High market saturation'] : []),
        ...(agentScore.supplierQuality?.score < 40 ? ['Shipping quality concerns'] : []),
      ];

      const candidate = await prisma.candidateProduct.create({
        data: {
          shopId,
          providerType: product.providerType || 'ALIEXPRESS',
          providerProductId: product.providerProductId || `gen-${Date.now()}-${savedCount}`,
          sourceUrl: product.sourceUrl || '',
          sourceName: product.sourceName || 'Unknown',
          title: product.title || 'Untitled Product',
          description: product.description || '',
          category: product.category || 'General',
          subcategory: product.subcategory || '',
          imageUrls: product.imageUrls || [],
          variants: (product.variants as any) || [],
          costPrice: product.costPrice || 0,
          suggestedPrice: product.suggestedPrice || 0,
          currency: product.currency || 'USD',
          shippingCost: product.shippingCost || 0,
          shippingDays: product.shippingDays || 15,
          shippingSpeed: product.shippingSpeed || 'STANDARD',
          warehouseCountry: product.warehouseCountry || 'CN',
          reviewCount: product.reviewCount || 0,
          reviewRating: product.reviewRating || 0,
          orderVolume: product.orderVolume || 0,
          supplierRating: product.supplierRating || 0,
          rawData: (product.rawData as any) || {},
          researchBatchId: batchId,
          status: 'CANDIDATE',
        },
      });

      await prisma.candidateScore.create({
        data: {
          candidateId: candidate.id,
          domainFit: agentScore.storeFit?.score || 50,
          storeFit: agentScore.storeFit?.score || 50,
          audienceFit: agentScore.storeFit?.score || 50,
          trendFit: agentScore.trendPotential?.score || 50,
          visualVirality: agentScore.viralPrediction?.viralScore || 30,
          novelty: agentScore.saturation?.score || 50,
          priceFit: agentScore.profitability?.score || 50,
          marginFit: agentScore.profitability?.score || 50,
          shippingFit: agentScore.supplierQuality?.score || 50,
          saturationInverse: agentScore.saturation?.score || 50,
          refundRiskInverse: agentScore.supplierQuality?.score || 50,
          finalScore: agentScore.finalScore || 50,
          confidence: agentScore.storeFit?.confidence || 0.5,
          explanation,
          fitReasons,
          concerns,
          scoredAt: new Date(),
        },
      });

      savedCount++;
    } catch (err: any) {
      const msg = err.message?.slice(0, 200) || 'Unknown error';
      console.error(`[Research] ❌ SAVE FAILED for "${product.title?.slice(0, 40)}": ${msg}`);
      saveErrors.push(msg);
    }
  }

  if (saveErrors.length > 0) {
    console.error(`[Research] Save errors (${saveErrors.length}/${scored.length}): ${saveErrors[0]}`);
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

  // Step 7 (background): Enrich top products with real trend data
  // Fire-and-forget — doesn't block the response
  if (savedCount > 0) {
    (async () => {
      try {
        console.log(`[Research] Background: enriching top products with trend data...`);
        const { aggregateTrend } = await import('../trends');
        const topCandidates = await prisma.candidateProduct.findMany({
          where: { shopId, researchBatchId: batchId },
          include: { score: true },
          orderBy: { score: { finalScore: 'desc' } },
          take: 5,
        });

        const enrichPromises = topCandidates.map(async (candidate) => {
          try {
            const searchTerms = candidate.title
              .replace(/[^a-zA-Z\s]/g, '')
              .split(/\s+/)
              .filter((w: string) => w.length > 3)
              .slice(0, 3)
              .join(' ');
            if (searchTerms.length <= 5 || !candidate.score) return;

            const trend = await aggregateTrend(searchTerms);
            if (trend.confidence <= 0) return;

            const trendBoost = Math.round((trend.overallScore - 40) * 0.4);
            const newViralScore = Math.min(100, Math.max(0, (candidate.score.visualVirality || 50) + trendBoost));

            // Update score in DB
            await prisma.candidateScore.update({
              where: { id: candidate.score.id },
              data: {
                visualVirality: newViralScore,
                explanation: candidate.score.explanation + (
                  trend.trendDirection === 'surging' ? ' 🌊 Confirmed surging trend.' :
                  trend.trendDirection === 'rising' ? ' 📈 Rising trend confirmed.' :
                  trend.trendDirection === 'declining' ? ' 📉 Declining trend detected.' : ''
                ),
              },
            });
          } catch {}
        });

        await Promise.race([
          Promise.allSettled(enrichPromises),
          new Promise(resolve => setTimeout(resolve, 15_000)),
        ]);
        console.log(`[Research] Background: trend enrichment complete`);
      } catch (err: any) {
        console.warn(`[Research] Background enrichment failed: ${err.message}`);
      }
    })(); // Fire and forget — no await
  }

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
