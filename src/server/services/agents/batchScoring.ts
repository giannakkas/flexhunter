// ==============================================
// Batch AI Scoring — 1 call per 5 products
// ==============================================
// Combines storeFit + saturation + viral into a SINGLE
// AI call for multiple products. Reduces API usage by ~90%.
//
// Before: 3 AI calls × 27 products = 81 calls
// After:  1 AI call × 6 batches = 6 calls

import { aiComplete } from '../../utils/ai';
import { NormalizedProduct, StoreDNA, MerchantSettingsData } from '../../../shared/types';
import { AgentResult, MultiAgentScore } from './index';
import { profitAgent, trendAgent, supplierQualityAgent } from './index';
import { ViralPrediction } from './viralPredictionAgent';

interface BatchAIResult {
  storeFit: number;
  saturation: number;
  viralScore: number;
  trendStage: string;
  storeFitReason: string;
  saturationReason: string;
  viralReason: string;
  storeFitSignals: string[];
  isTikTokFriendly: boolean;
  // NEW: winning product signals
  winnerScore: number;
  winnerSignals: string[];
  adFriendly: boolean;
  problemSolving: boolean;
  wowFactor: boolean;
  giftWorthy: boolean;
  impulsePrice: boolean;
  repeatPurchase: boolean;
}

/**
 * Score multiple products in a single AI call.
 * Replaces 3 separate AI agents (storeFit + saturation + viral)
 * with 1 combined prompt for up to 5 products.
 */
export async function batchAIScore(
  products: NormalizedProduct[],
  dna: StoreDNA,
  settings: MerchantSettingsData,
): Promise<(BatchAIResult | null)[]> {
  const storeDesc = dna.description || settings.storeDescription || 'dropshipping store';

  const productSummaries = products.map((p, i) => {
    const margin = p.suggestedPrice && p.costPrice ? ((p.suggestedPrice - p.costPrice) / p.suggestedPrice * 100).toFixed(0) : '?';
    const ratingStr = p.reviewRating ? `${p.reviewRating}★` : 'no rating';
    return `${i}. "${p.title.slice(0, 60)}" | sell:$${p.suggestedPrice || '?'} cost:$${p.costPrice || '?'} margin:${margin}% | ${p.orderVolume || 0} orders | ${ratingStr} | ships:${p.shippingDays || '?'}d from ${p.warehouseCountry || '?'}`;
  }).join('\n');

  const prompt = `You are a dropshipping product analyst. Score ${products.length} products for a "${storeDesc}" store.
Target customers: ${settings.targetAudience?.join(', ') || 'general'}
Price range: $${settings.priceRangeMin || 5}-$${settings.priceRangeMax || 100}

${productSummaries}

EVALUATE EACH PRODUCT HONESTLY:
1. storeFit (0-100): Would a customer EXPECT this in a "${storeDesc}" store? Be STRICT — wrong niche = 0-30.
2. saturation (0-100): Market opportunity. 90+ = untapped niche, 50 = moderate competition, <30 = oversaturated.
3. viralScore (0-100): Could this go viral on TikTok/Instagram? Visual, shareable, wow-factor, problem-solving.
4. trendStage: early_acceleration | breakout_candidate | rising_trend | stable_trend | saturated
5. winnerScore (0-100): Overall — would YOU invest money advertising this product?

CRITICAL RULES:
- DIFFERENTIATE clearly. Not every product is a winner. Spread scores across the full 0-100 range.
- A true winner (good niche fit + proven demand + good margins + viral appeal) should score 85-95.
- Average products should score 55-70.
- Poor fits, saturated products, or low-margin items should score 20-50.
- Products with 0 reviews or 0 orders are UNPROVEN — cap winnerScore at 70 max.
- Products over $80 sell price are HARDER to sell via ads — penalize winnerScore.

Return a JSON array of ${products.length} objects:
[{"storeFit":number,"saturation":number,"viralScore":number,"trendStage":"string","winnerScore":number,"storeFitReason":"1 sentence","viralReason":"1 sentence","problemSolving":bool,"wowFactor":bool,"adFriendly":bool,"giftWorthy":bool,"impulsePrice":bool}]`;

  // Try once — the AI cascade already handles provider failover
  try {
    const start = Date.now();
    const results = await aiComplete<BatchAIResult[]>(prompt, {
      temperature: 0.2,
      maxTokens: 200 * products.length,
      systemPrompt: `Product analyst. Return ONLY a JSON array of ${products.length} objects. No markdown, no explanation.`,
    });

    if (Array.isArray(results) && results.length > 0) {
      while (results.length < products.length) results.push(null as any);
      console.log(`[BatchScore] AI scored ${results.filter(Boolean).length}/${products.length} in ${((Date.now() - start) / 1000).toFixed(1)}s`);
      return results;
    }
    console.warn(`[BatchScore] AI returned non-array: ${typeof results}`);
  } catch (err: any) {
    console.warn(`[BatchScore] AI failed: ${err.message?.slice(0, 120)}`);
  }

  console.warn(`[BatchScore] All attempts failed — using algorithmic fallback`);
  return products.map(() => null);
}

/**
 * Full multi-agent scoring using batch AI (1 call per 5 products)
 * + algorithmic agents (profit, trend, supplier — 0 AI calls)
 */
export async function runBatchMultiAgentScoring(
  products: NormalizedProduct[],
  dna: StoreDNA,
  settings: MerchantSettingsData,
): Promise<(MultiAgentScore | null)[]> {
  // 1 AI call for ALL products in this batch
  const aiResults = await batchAIScore(products, dna, settings);

  // Algorithmic agents — no AI calls needed
  const results: (MultiAgentScore | null)[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const ai = aiResults[i];

    // Algorithmic agents (free, no AI calls)
    const profit = await profitAgent(product);
    const trend = await trendAgent(product);
    const supplier = supplierQualityAgent(product);

    // If AI failed, use algorithmic-only defaults
    const storeFit: AgentResult = {
      score: Math.min(100, Math.max(0, ai?.storeFit || 60)),
      confidence: ai ? 0.7 : 0.3,
      reasoning: ai?.storeFitReason || 'Default score — limited data',
      signals: ai?.storeFitSignals || [],
    };

    const saturation: AgentResult = {
      score: Math.min(100, Math.max(0, ai?.saturation || 50)),
      confidence: ai ? 0.6 : 0.3,
      reasoning: ai?.saturationReason || 'Default — no AI data',
      signals: [],
    };

    const viral: ViralPrediction = {
      viralScore: Math.min(100, Math.max(0, ai?.viralScore || 30)),
      trendStage: (ai?.trendStage as any) || 'stable_trend',
      velocity7d: (ai?.viralScore || 30) > 60 ? 25 : 5,
      accelerationRate: ai?.trendStage === 'early_acceleration' ? 2.1 : 1.0,
      confidence: ai ? 0.6 : 0.3,
      signals: [
        ai?.viralReason || '',
        ai?.isTikTokFriendly ? 'TikTok-friendly product' : '',
        ai?.adFriendly ? '📹 Easy to demo in ads' : '',
        ai?.problemSolving ? '🎯 Solves a clear problem' : '',
        ai?.wowFactor ? '✨ High wow factor' : '',
        ai?.giftWorthy ? '🎁 Gift-worthy' : '',
        ai?.impulsePrice ? '💰 Impulse-buy price range' : '',
        ai?.repeatPurchase ? '🔄 Repeat purchase potential' : '',
        !ai ? '⚠️ Limited data — basic scoring applied' : '',
      ].filter(Boolean),
      explanation: ai?.viralReason || `${ai?.trendStage || 'stable'} — ${ai ? 'AI scored' : 'algorithmic only'}`,
    };

    // Final score: 55% AI assessment + 45% algorithmic dimensions
    const aiWinner = Math.min(100, Math.max(0, ai?.winnerScore || 40));
    const dimensionScore = Math.round(
      storeFit.score * 0.25 +
      profit.score * 0.15 +
      trend.score * 0.15 +
      viral.viralScore * 0.20 +
      saturation.score * 0.10 +
      supplier.score * 0.15
    );
    
    let finalScore = Math.round(aiWinner * 0.55 + dimensionScore * 0.45);

    // ── REAL SIGNAL BONUSES (only for products with actual evidence) ──
    // Proven demand — orders don't lie
    if (product.orderVolume && product.orderVolume > 10000) finalScore += 4;
    else if (product.orderVolume && product.orderVolume > 3000) finalScore += 3;
    else if (product.orderVolume && product.orderVolume > 500) finalScore += 1;

    // Verified quality — real reviews
    if (product.reviewRating && product.reviewRating >= 4.7 && product.reviewCount && product.reviewCount > 500) finalScore += 3;
    else if (product.reviewRating && product.reviewRating >= 4.5 && product.reviewCount && product.reviewCount > 100) finalScore += 2;

    // Strong niche fit + good margins = winning combination
    if (storeFit.score >= 80 && profit.score >= 75) finalScore += 3;

    // Viral potential confirmed by AI
    if (ai?.wowFactor && ai?.adFriendly && ai?.problemSolving) finalScore += 2;

    // ── REAL SIGNAL PENALTIES ──
    // Unproven products — no track record
    if (!product.orderVolume || product.orderVolume < 50) finalScore -= 5;
    // No review data — uncertain quality
    if (!product.reviewRating || product.reviewRating === 0) finalScore -= 3;
    // Expensive products — harder to sell via ads
    if (product.suggestedPrice && product.suggestedPrice > 100) finalScore -= 3;
    // Very slow shipping
    if (product.shippingDays && product.shippingDays > 20) finalScore -= 3;

    finalScore = Math.min(99, Math.max(15, finalScore));

    let recommendation: MultiAgentScore['recommendation'];
    if (storeFit.score < 30) recommendation = 'avoid';
    else if (finalScore >= 80 && storeFit.score >= 70) recommendation = 'strong_buy';
    else if (finalScore >= 65 && storeFit.score >= 60) recommendation = 'buy';
    else if (finalScore >= 50) recommendation = 'maybe';
    else if (storeFit.score < 50) recommendation = 'avoid';
    else recommendation = 'skip';

    if (viral.trendStage === 'early_acceleration' && recommendation === 'buy') {
      recommendation = 'strong_buy';
    }

    const winnerSignalsList = (ai?.winnerSignals || []).slice(0, 3).join(', ');

    results.push({
      storeFit,
      profitability: profit,
      trendPotential: trend,
      viralPrediction: viral,
      saturation,
      supplierQuality: supplier,
      finalScore,
      recommendation,
      explanation: `Store fit: ${storeFit.score}/100 — ${storeFit.reasoning}. Profit: ${profit.reasoning}. Viral: ${viral.trendStage} (${viral.viralScore}/100). Winner: ${ai?.winnerScore || '?'}/100${winnerSignalsList ? ` — ${winnerSignalsList}` : ''}. Supplier: ${supplier.reasoning}.${!ai ? ' [Basic scoring]' : ''}`,
    });
  }

  return results;
}
