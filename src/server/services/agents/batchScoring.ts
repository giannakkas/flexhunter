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
    return `${i}. "${p.title.slice(0, 60)}" | $${p.suggestedPrice || '?'} cost:$${p.costPrice || '?'} | ${p.orderVolume || 0} orders | ${p.reviewRating || 0}★`;
  }).join('\n');

  const prompt = `Score ${products.length} products for a "${storeDesc}" store. Price range: $${settings.priceRangeMin || 5}-$${settings.priceRangeMax || 100}.

${productSummaries}

For each product return: storeFit(0-100), saturation(0-100), viralScore(0-100), trendStage, winnerScore(0-100), storeFitReason(short), viralReason(short), problemSolving(bool), wowFactor(bool), adFriendly(bool), giftWorthy(bool), impulsePrice(bool).

SCORING GUIDE — USE THE FULL RANGE:
- winnerScore 90-100: Perfect dropshipping product — high demand, great margins, fits this store perfectly
- winnerScore 80-89: Strong winner — most signals are positive, worth importing
- winnerScore 70-79: Decent product — some positive signals but not a clear winner
- winnerScore 50-69: Mediocre — average product, nothing special
- winnerScore 0-49: Bad fit — wrong niche, poor margins, or saturated

Products that match the store niche, have good margins (>40%), are under $50, and are visual/shareable SHOULD score 85+.
Be GENEROUS with winnerScore for genuinely good products. Don't default everything to 60-75.

trendStage options: early_acceleration, breakout_candidate, rising_trend, stable_trend, saturated.

Return ONLY a JSON array of ${products.length} objects:
[{"storeFit":85,"saturation":70,"viralScore":78,"trendStage":"rising_trend","winnerScore":82,"storeFitReason":"perfect for outdoor niche","viralReason":"shareable survival content","problemSolving":true,"wowFactor":true,"adFriendly":true,"giftWorthy":true,"impulsePrice":true}]`;

  // Try up to 2 times
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const results = await aiComplete<BatchAIResult[]>(prompt, {
        temperature: 0.2,
        maxTokens: 200 * products.length,
        systemPrompt: `Product analyst. Return ONLY a JSON array of ${products.length} objects. No markdown, no explanation.`,
      });

      if (Array.isArray(results) && results.length > 0) {
        while (results.length < products.length) results.push(null as any);
        console.log(`[BatchScore] AI scored ${results.filter(Boolean).length}/${products.length} products (attempt ${attempt})`);
        return results;
      }
      console.warn(`[BatchScore] AI returned non-array (attempt ${attempt}):`, typeof results);
    } catch (err: any) {
      console.warn(`[BatchScore] AI failed (attempt ${attempt}): ${err.message?.slice(0, 100)}`);
      if (attempt === 1) {
        // Wait 2s before retry
        await new Promise(r => setTimeout(r, 2000));
      }
    }
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

    // Final score: 50% AI winnerScore + 50% weighted dimensions
    const aiWinner = Math.min(100, Math.max(0, ai?.winnerScore || 50));
    const dimensionScore = Math.round(
      storeFit.score * 0.25 +
      profit.score * 0.15 +
      trend.score * 0.15 +
      viral.viralScore * 0.20 +
      saturation.score * 0.10 +
      supplier.score * 0.15
    );
    
    let finalScore = Math.round(aiWinner * 0.50 + dimensionScore * 0.50);
    finalScore = Math.min(100, Math.max(0, finalScore));

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
