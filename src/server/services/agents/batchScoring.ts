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
    return `${i}. "${p.title}" | Cat: ${p.category || '?'} | $${p.suggestedPrice || '?'} (cost: $${p.costPrice || '?'}, margin: ${margin}%) | ${p.orderVolume || 0} orders | ${p.reviewRating || 0}★ | Ships: ${p.shippingDays || '?'}d from ${p.warehouseCountry || 'CN'}`;
  }).join('\n');

  const prompt = `You are a product analyst for a store that sells: "${storeDesc}"
Target audience: ${settings.targetAudience?.join(', ') || 'general'}
Price range: $${settings.priceRangeMin || 5}-$${settings.priceRangeMax || 100}

Score these ${products.length} products. For EACH product, evaluate:
1. storeFit (0-100): Does this product belong in this store? 0=completely wrong, 100=perfect fit
2. saturation (0-100): Market opportunity. 100=untapped opportunity, 0=oversaturated
3. viralScore (0-100): Viral/trend potential. Is this TikTok-shareable? Impulse-buy worthy?
4. trendStage: "early_acceleration" | "breakout_candidate" | "rising_trend" | "stable_trend" | "saturated"

PRODUCTS:
${productSummaries}

RULES:
- Be STRICT with storeFit — a sex toy scores 0 in a hunting store
- Products unrelated to "${storeDesc}" get storeFit < 20
- Consider the price range — products outside $${settings.priceRangeMin || 5}-$${settings.priceRangeMax || 100} score lower
- viral products are visual, shareable, gift-worthy, problem-solving

Return ONLY a JSON array with one object per product:
[
  {
    "storeFit": number,
    "saturation": number,
    "viralScore": number,
    "trendStage": "string",
    "storeFitReason": "1 sentence",
    "saturationReason": "1 sentence",
    "viralReason": "1 sentence",
    "storeFitSignals": ["reason1", "reason2"],
    "isTikTokFriendly": boolean
  }
]`;

  try {
    const results = await aiComplete<BatchAIResult[]>(prompt, {
      temperature: 0.2,
      maxTokens: 300 * products.length,
      systemPrompt: `Product analyst for "${storeDesc}" store. Score ALL ${products.length} products. Return a JSON array of ${products.length} objects. Be STRICT with store fit.`,
    });

    if (Array.isArray(results) && results.length > 0) {
      // Pad with nulls if AI returned fewer results
      while (results.length < products.length) results.push(null as any);
      return results;
    }
    return products.map(() => null);
  } catch (err: any) {
    console.warn(`[BatchScore] AI failed: ${err.message}`);
    return products.map(() => null);
  }
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

    if (!ai) {
      results.push(null);
      continue;
    }

    // Algorithmic agents (free, no AI)
    const profit = await profitAgent(product);
    const trend = await trendAgent(product);
    const supplier = supplierQualityAgent(product);

    // Convert batch AI result to agent format
    const storeFit: AgentResult = {
      score: Math.min(100, Math.max(0, ai.storeFit || 0)),
      confidence: 0.7,
      reasoning: ai.storeFitReason || 'AI scored',
      signals: ai.storeFitSignals || [],
    };

    const saturation: AgentResult = {
      score: Math.min(100, Math.max(0, ai.saturation || 50)),
      confidence: 0.6,
      reasoning: ai.saturationReason || 'AI scored',
      signals: [],
    };

    const viral: ViralPrediction = {
      viralScore: Math.min(100, Math.max(0, ai.viralScore || 30)),
      trendStage: (ai.trendStage as any) || 'stable_trend',
      velocity7d: ai.viralScore > 60 ? 25 : 5,
      accelerationRate: ai.trendStage === 'early_acceleration' ? 2.1 : 1.0,
      confidence: 0.6,
      signals: [
        ai.viralReason || '',
        ai.isTikTokFriendly ? 'TikTok-friendly product' : '',
      ].filter(Boolean),
      explanation: ai.viralReason || `${ai.trendStage} with ${ai.viralScore}/100 viral potential`,
    };

    // Weighted score
    const WEIGHTS = { storeFit: 0.25, profitability: 0.15, trendPotential: 0.15, viralPrediction: 0.20, saturation: 0.10, supplierQuality: 0.15 };
    const finalScore = Math.round(
      storeFit.score * WEIGHTS.storeFit +
      profit.score * WEIGHTS.profitability +
      trend.score * WEIGHTS.trendPotential +
      viral.viralScore * WEIGHTS.viralPrediction +
      saturation.score * WEIGHTS.saturation +
      supplier.score * WEIGHTS.supplierQuality
    );

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

    results.push({
      storeFit,
      profitability: profit,
      trendPotential: trend,
      viralPrediction: viral,
      saturation,
      supplierQuality: supplier,
      finalScore,
      recommendation,
      explanation: `Store fit: ${storeFit.score}/100 — ${storeFit.reasoning}. Profit: ${profit.reasoning}. Viral: ${viral.trendStage} (${viral.viralScore}/100). Supplier: ${supplier.reasoning}.`,
    });
  }

  return results;
}
