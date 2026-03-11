// ==============================================
// AI-Powered Deep Research Pipeline
// ==============================================
// Uses GPT to generate keywords, curate products,
// and deeply score candidates for the store.

import { v4 as uuid } from 'uuid';
import prisma from '../../utils/db';
import { analyzeDomainAndSave } from '../domain/domainEngine';
import { providerRegistry } from '../providers/providerRegistry';
import { scoreProduct } from '../scoring/scoringEngine';
import { aiComplete } from '../../utils/ai';
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
 * Build a lightweight store DNA from settings only
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
 * Use AI to generate highly targeted search keywords
 */
async function aiGenerateKeywords(dna: StoreDNA, settings: MerchantSettingsData): Promise<string[]> {
  const prompt = `You are an expert e-commerce niche researcher. Generate 8-12 search keywords to find products for this store.

STORE PROFILE:
- Domain: ${dna.domain}
- Description: ${dna.description || 'dropshipping store'}
- Target audience: ${settings.targetAudience?.join(', ') || 'general'}
- Preferred categories: ${settings.preferredCategories?.join(', ') || 'none'}
- Price range: $${settings.priceRangeMin || 5} - $${settings.priceRangeMax || 100}
- Brand vibe: ${dna.brandVibe}
- Niche keywords: ${dna.nicheKeywords?.join(', ') || 'none'}

CRITICAL RULES:
- ALL keywords MUST belong to ONE cohesive store niche/theme
- A customer browsing this store should see products that NATURALLY go together
- Think: "What kind of store is this?" then ONLY suggest products for THAT type of store
- For example: if it's a gaming store, ALL keywords should be gaming-related
- If it's a home decor store, ALL keywords should be home decor
- If categories are broad/unclear, pick the STRONGEST niche signal and focus on that
- NEVER mix unrelated categories (no gaming keyboards + bicycle lights + leather bags)
- Each keyword: 2-4 words, specific enough for product search
- Focus on the price range — don't suggest expensive items for a budget store

Return ONLY a JSON array of strings.`;

  try {
    const keywords = await aiComplete<string[]>(prompt, {
      temperature: 0.5,
      maxTokens: 500,
      systemPrompt: 'You are a niche product researcher. Return only valid JSON arrays. All keywords must be for ONE cohesive store theme.',
    });
    if (Array.isArray(keywords) && keywords.length > 0) {
      console.log(`[Research] AI generated ${keywords.length} niche-focused keywords: ${keywords.join(', ')}`);
      return keywords;
    }
  } catch (err) {
    console.warn('[Research] AI keyword generation failed, using fallback:', err);
  }

  return [
    ...settings.preferredCategories.slice(0, 5),
    ...(dna.domainIntent?.categoryBias?.slice(0, 3) || []),
  ].filter(Boolean);
}

/**
 * Use AI to curate and rank the best products for this store
 */
async function aiCurateProducts(
  products: NormalizedProduct[],
  dna: StoreDNA,
  settings: MerchantSettingsData,
  maxResults: number
): Promise<{ selectedIndices: number[]; reasoning: string }> {
  // Only send essential info to AI to save tokens
  const productSummaries = products.slice(0, 60).map((p, i) => ({
    idx: i,
    title: p.title,
    category: p.category,
    cost: p.costPrice,
    price: p.suggestedPrice,
    rating: p.reviewRating,
    orders: p.orderVolume,
    ship: p.shippingDays,
    source: p.sourceName,
  }));

  const prompt = `You are a product curator for a FOCUSED niche dropshipping store. From ${productSummaries.length} products, select the BEST ${maxResults} that ALL belong together in ONE cohesive store.

STORE PROFILE:
- Domain: ${dna.domain}
- Description: ${dna.description || 'dropshipping store'}
- Target audience: ${settings.targetAudience?.join(', ') || 'general'}
- Categories: ${settings.preferredCategories?.join(', ') || 'general'}
- Price range: $${settings.priceRangeMin || 5} - $${settings.priceRangeMax || 100}
- Brand vibe: ${dna.brandVibe}

PRODUCTS:
${JSON.stringify(productSummaries, null, 1)}

CRITICAL — NICHE COHERENCE:
- ALL selected products MUST look like they belong in the SAME store
- A customer should think "this store sells [one type of thing]"
- REJECT products that don't fit the store's main theme even if they score well individually
- Better to return 10 coherent products than 20 random ones
- If products are mixed categories, pick the dominant niche and ONLY select from that niche

OTHER CRITERIA:
1. Profit margin — at least 50% markup potential
2. Quality signals — good reviews, order volume
3. Visual appeal — photogenic for social media
4. Price fit — within the store's range

Return ONLY a JSON object with:
- "selectedIndices": array of product idx numbers (ONLY coherent products)
- "reasoning": what niche you focused on and why`;

  try {
    const result = await aiComplete<{ selectedIndices: number[]; reasoning: string }>(prompt, {
      temperature: 0.3,
      maxTokens: 1000,
      systemPrompt: 'You are a product-market fit analyst. Return only valid JSON.',
    });

    if (result.selectedIndices && Array.isArray(result.selectedIndices)) {
      console.log(`[Research] AI curated ${result.selectedIndices.length} products: ${result.reasoning}`);
      return result;
    }
  } catch (err) {
    console.warn('[Research] AI curation failed, using score-based fallback:', err);
  }

  // Fallback: just take top N by basic metrics
  return {
    selectedIndices: products.slice(0, maxResults).map((_, i) => i),
    reasoning: 'Fallback: selected by order volume and rating.',
  };
}

/**
 * Use AI to deeply score a single product
 */
async function aiDeepScore(
  product: NormalizedProduct,
  dna: StoreDNA,
  settings: MerchantSettingsData,
): Promise<{
  audienceFit: number; trendFit: number; visualVirality: number; novelty: number;
  explanation: string; fitReasons: string[]; concerns: string[];
}> {
  const prompt = `Score this product for the store. Return JSON only.

PRODUCT: "${product.title}" | ${product.category} | $${product.costPrice} cost → $${product.suggestedPrice} sell | ${product.reviewRating} stars | ${product.orderVolume} orders | ${product.sourceName} | Ships in ${product.shippingDays}d from ${product.warehouseCountry}
DESCRIPTION: ${(product.description || '').slice(0, 200)}

STORE: ${dna.domain} | ${dna.description || 'dropshipping store'} | Audience: ${settings.targetAudience?.join(', ')} | Categories: ${settings.preferredCategories?.join(', ')} | Vibe: ${dna.brandVibe}

Score 0-100:
- audienceFit: how well does this match the target audience?
- trendFit: how trending/current is this product?
- visualVirality: how shareable on social media?
- novelty: how unique vs common dropship products?

Also provide:
- explanation: 1-2 sentence fit summary
- fitReasons: 2-3 specific reasons it fits
- concerns: 0-2 potential concerns

Return ONLY valid JSON.`;

  try {
    return await aiComplete(prompt, {
      model: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 400,
      systemPrompt: 'Product analyst. Return only JSON.',
    });
  } catch {
    return {
      audienceFit: 60, trendFit: 55, visualVirality: 50, novelty: 45,
      explanation: 'AI scoring unavailable, using algorithmic estimates.',
      fitReasons: ['Available from supplier'], concerns: ['AI scoring failed'],
    };
  }
}

/**
 * Run the full AI-powered research pipeline
 */
export async function runResearchPipeline(shopId: string): Promise<ResearchResult> {
  const batchId = uuid();
  console.log(`[Research] ====== Starting AI-powered deep research ======`);
  console.log(`[Research] Shop: ${shopId}, Batch: ${batchId}`);

  // Pre-check: verify at least one provider is available
  const availableProviders = providerRegistry.getAvailable().filter(p => p.name !== 'CSV Feed' && p.name !== 'Manual Entry');
  console.log(`[Research] Available live providers: ${availableProviders.map(p => p.name).join(', ') || 'NONE'}`);
  if (availableProviders.length === 0) {
    throw new Error('No product sources available. Please add CJ_API_KEY or RAPIDAPI_KEY in Railway environment variables.');
  }

  // Step 1: Build store DNA
  const dna = await buildLightDNA(shopId);
  console.log(`[Research] Step 1/8: DNA built for ${dna.domain}`);

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

  const maxCandidates = Math.min(settingsData.maxCandidatesPerRun, 25);
  console.log(`[Research] Step 2/8: Settings loaded, targeting ${maxCandidates} candidates`);

  // Step 3: AI generates targeted search keywords
  const keywords = await aiGenerateKeywords(dna, settingsData);
  console.log(`[Research] Step 3/8: AI generated ${keywords.length} search keywords`);

  // Step 4: Fetch from ALL providers using AI keywords
  const rawProducts: NormalizedProduct[] = [];
  for (const kw of keywords.slice(0, 8)) {
    try {
      const results = await providerRegistry.searchAll({
        keywords: [kw],
        minPrice: settingsData.priceRangeMin ?? undefined,
        maxPrice: settingsData.priceRangeMax ?? undefined,
        limit: 15,
      });
      rawProducts.push(...results);
    } catch (err) {
      console.warn(`[Research] Provider search failed for "${kw}":`, err);
    }
  }

  // Deduplicate by provider+productId
  const seen = new Set<string>();
  const unique = rawProducts.filter((p) => {
    const key = `${p.providerType}-${p.providerProductId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`[Research] Step 4/8: Fetched ${rawProducts.length} products, ${unique.length} unique`);

  if (unique.length === 0) {
    throw new Error(`No products found from ${availableProviders.map(p => p.name).join(', ')}. Try broadening your categories or price range in Store DNA.`);
  }

  // Step 5: Filter banned categories
  const filtered = unique.filter((p) => {
    const cat = (p.category || '').toLowerCase();
    const title = (p.title || '').toLowerCase();
    return !settingsData.bannedCategories.some((b) => {
      const bl = b.toLowerCase();
      return cat.includes(bl) || title.includes(bl);
    });
  });
  console.log(`[Research] Step 5/8: ${filtered.length} after banning`);

  // Step 6: AI curates the best products
  const curation = await aiCurateProducts(filtered, dna, settingsData, maxCandidates);
  const curatedProducts = curation.selectedIndices
    .filter(i => i >= 0 && i < filtered.length)
    .map(i => filtered[i]);
  // If AI curation returned nothing, take top products by review/order volume
  const finalCurated = curatedProducts.length > 0
    ? curatedProducts
    : filtered.sort((a, b) => (b.orderVolume || 0) - (a.orderVolume || 0)).slice(0, maxCandidates);
  console.log(`[Research] Step 6/8: AI curated ${finalCurated.length} products (from ${filtered.length} filtered)`);

  // Step 7: Deep score each curated product (AI + algorithmic)
  const scored: (NormalizedProduct & { score: any; aiScore: any })[] = [];
  for (const product of finalCurated) {
    try {
      // Algorithmic scoring
      const algoScore = await scoreProduct(product, dna, settingsData, DEFAULT_SCORE_WEIGHTS, false);

      // AI deep scoring
      const aiScore = await aiDeepScore(product, dna, settingsData);

      // Blend: 40% AI, 60% algorithmic
      const blended = {
        ...algoScore,
        audienceFit: Math.round(algoScore.audienceFit * 0.5 + (aiScore.audienceFit || 60) * 0.5),
        trendFit: Math.round(algoScore.trendFit * 0.5 + (aiScore.trendFit || 55) * 0.5),
        visualVirality: Math.round(algoScore.visualVirality * 0.4 + (aiScore.visualVirality || 50) * 0.6),
        novelty: Math.round(algoScore.novelty * 0.4 + (aiScore.novelty || 45) * 0.6),
        explanation: aiScore.explanation || algoScore.explanation,
        fitReasons: aiScore.fitReasons || algoScore.fitReasons,
        concerns: aiScore.concerns || algoScore.concerns,
      };

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

      scored.push({ ...product, score: blended, aiScore });
    } catch (err) {
      console.warn(`[Research] Scoring failed for "${product.title}":`, err);
    }
  }

  // Sort by blended score
  scored.sort((a, b) => b.score.finalScore - a.score.finalScore);
  console.log(`[Research] Step 7/8: Deep scored ${scored.length} products`);

  // Step 8: Clear old non-imported candidates and save new ones
  const deletedOld = await prisma.candidateProduct.deleteMany({
    where: {
      shopId,
      status: { in: ['CANDIDATE', 'REJECTED'] },
      importedProduct: null,
    },
  });
  console.log(`[Research] Step 8/8: Cleared ${deletedOld.count} old candidates, saving ${scored.length} new`);

  let savedCount = 0;
  for (const product of scored) {
    try {
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

  // Audit log
  await prisma.auditLog.create({
    data: {
      shopId,
      action: 'RESEARCH_COMPLETED',
      details: {
        batchId,
        totalFetched: rawProducts.length,
        unique: unique.length,
        aiCurated: finalCurated.length,
        scored: scored.length,
        saved: savedCount,
        keywords,
        aiReasoning: curation.reasoning,
      } as any,
    },
  });

  console.log(`[Research] ====== Complete! Saved ${savedCount} AI-curated candidates ======`);

  return {
    batchId,
    totalFetched: rawProducts.length,
    totalScored: scored.length,
    totalSaved: savedCount,
    topCandidates: scored.slice(0, 5).map((p) => ({
      title: p.title,
      category: p.category,
      finalScore: p.score.finalScore,
      explanation: p.score.explanation,
    })),
  };
}
