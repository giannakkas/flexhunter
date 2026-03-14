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
    return `${i}. "${p.title}" | Cat: ${p.category || '?'} | $${p.suggestedPrice || '?'} (cost: $${p.costPrice || '?'}, margin: ${margin}%) | ${p.orderVolume || 0} orders | ${p.reviewRating || 0}★ | Ships: ${p.shippingDays || '?'}d from ${p.warehouseCountry || 'CN'}`;
  }).join('\n');

  const prompt = `You are an expert product analyst for a store that sells: "${storeDesc}"
Target audience: ${settings.targetAudience?.join(', ') || 'general'}
Price range: $${settings.priceRangeMin || 5}-$${settings.priceRangeMax || 100}

Score these ${products.length} products. For EACH product, evaluate:

1. storeFit (0-100): Does this product belong in this store?
2. saturation (0-100): Market opportunity. 100=untapped, 0=oversaturated
3. viralScore (0-100): TikTok/social media viral potential
4. trendStage: "early_acceleration" | "breakout_candidate" | "rising_trend" | "stable_trend" | "saturated"
5. winnerScore (0-100): Overall "winning product" potential combining ALL factors below:
   - Is it a PROBLEM-SOLVING product? (solves a clear pain point)
   - Does it have a WOW FACTOR? (makes people say "I need this!")
   - Is it AD-FRIENDLY? (easy to demonstrate in a 15-30 sec video)
   - Is it GIFT-WORTHY? (something people buy for others)
   - Is it at an IMPULSE PRICE? ($15-45 sweet spot)
   - Does it have REPEAT PURCHASE potential?

PRODUCTS:
${productSummaries}

RULES:
- Be STRICT with storeFit — unrelated products get storeFit < 20
- A winning product typically has 3+ of: problem-solving, wow-factor, ad-friendly, impulse-price
- Products with high orders AND high viral potential = breakout
- Products with low orders BUT high viral = early_acceleration (MOST VALUABLE — 1-2 weeks early)
- Products with 50K+ orders = saturated unless niche-specific

Return ONLY a JSON array with one object per product:
[
  {
    "storeFit": number,
    "saturation": number,
    "viralScore": number,
    "trendStage": "string",
    "winnerScore": number,
    "storeFitReason": "1 sentence",
    "saturationReason": "1 sentence",
    "viralReason": "1 sentence",
    "storeFitSignals": ["reason1", "reason2"],
    "winnerSignals": ["signal1", "signal2"],
    "isTikTokFriendly": boolean,
    "adFriendly": boolean,
    "problemSolving": boolean,
    "wowFactor": boolean,
    "giftWorthy": boolean,
    "impulsePrice": boolean,
    "repeatPurchase": boolean
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

    // Algorithmic agents (free, no AI calls)
    const profit = await profitAgent(product);
    const trend = await trendAgent(product);
    const supplier = supplierQualityAgent(product);

    // If AI failed, use algorithmic-only defaults
    const storeFit: AgentResult = {
      score: Math.min(100, Math.max(0, ai?.storeFit || 60)),
      confidence: ai ? 0.7 : 0.3,
      reasoning: ai?.storeFitReason || 'Scored without AI — moderate default',
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
        !ai ? '⚠️ AI unavailable — algorithmic score only' : '',
      ].filter(Boolean),
      explanation: ai?.viralReason || `${ai?.trendStage || 'stable'} — ${ai ? 'AI scored' : 'algorithmic only'}`,
    };

    // Use winnerScore to boost final score
    const winnerBonus = ((ai?.winnerScore || 50) - 50) * 0.1; // -5 to +5 points

    // Weighted score
    const WEIGHTS = { storeFit: 0.25, profitability: 0.15, trendPotential: 0.15, viralPrediction: 0.20, saturation: 0.10, supplierQuality: 0.15 };
    let finalScore = Math.round(
      storeFit.score * WEIGHTS.storeFit +
      profit.score * WEIGHTS.profitability +
      trend.score * WEIGHTS.trendPotential +
      viral.viralScore * WEIGHTS.viralPrediction +
      saturation.score * WEIGHTS.saturation +
      supplier.score * WEIGHTS.supplierQuality +
      winnerBonus
    );
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
      explanation: `Store fit: ${storeFit.score}/100 — ${storeFit.reasoning}. Profit: ${profit.reasoning}. Viral: ${viral.trendStage} (${viral.viralScore}/100). Winner: ${ai?.winnerScore || '?'}/100${winnerSignalsList ? ` — ${winnerSignalsList}` : ''}. Supplier: ${supplier.reasoning}.${!ai ? ' [Scored without AI]' : ''}`,
    });
  }

  return results;
}
