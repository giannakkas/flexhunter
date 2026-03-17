// ==============================================
// Multi-Agent AI Research System
// ==============================================
// Each agent is a specialist that analyzes one dimension.
// The orchestrator runs them in parallel for speed.

import { aiComplete } from '../../utils/ai';
import { NormalizedProduct, StoreDNA, MerchantSettingsData } from '../../../shared/types';
import { predictViralPotential, ViralPrediction } from './viralPredictionAgent';

// Re-export
export { predictViralPotential, ViralPrediction } from './viralPredictionAgent';

// ── Agent Interfaces ────────────────────────────

export interface AgentResult {
  score: number;        // 0-100
  confidence: number;   // 0-1
  reasoning: string;
  signals: string[];
}

export interface MultiAgentScore {
  storeFit: AgentResult;
  profitability: AgentResult;
  trendPotential: AgentResult;
  viralPrediction: ViralPrediction;
  saturation: AgentResult;
  supplierQuality: AgentResult;
  finalScore: number;
  recommendation: 'strong_buy' | 'buy' | 'maybe' | 'skip' | 'avoid';
  explanation: string;
}

// ── Store Fit Agent ─────────────────────────────

export async function storeFitAgent(
  product: NormalizedProduct,
  dna: StoreDNA,
  settings: MerchantSettingsData,
): Promise<AgentResult> {
  const prompt = `You are a Store Fit analyst. Score how well this product fits the merchant's store.

STORE: "${dna.description || 'dropshipping store'}"
Audience: ${settings.targetAudience?.join(', ') || 'general'}
Price range: $${settings.priceRangeMin || 5}-$${settings.priceRangeMax || 100}
Niche: ${dna.nicheKeywords?.join(', ') || 'general'}

PRODUCT: "${product.title}"
Category: ${product.category}
Price: $${product.suggestedPrice}

Score 0-100:
- 90-100: Perfect fit, exactly what this store should sell
- 70-89: Good fit, customers would expect this
- 50-69: Borderline, loosely related
- 30-49: Poor fit, doesn't match the store
- 0-29: Completely irrelevant, wrong niche entirely

Return JSON: {"score": number, "confidence": number 0-1, "reasoning": "1 sentence", "signals": ["reason1", "reason2"]}`;

  try {
    return await aiComplete<AgentResult>(prompt, {
      temperature: 0.1,
      maxTokens: 200,
      systemPrompt: `Store fit analyst for a "${dna.description}" store. Be STRICT — irrelevant products get 0-20. Return only JSON.`,
    });
  } catch {
    return { score: 50, confidence: 0.3, reasoning: 'Agent failed', signals: [] };
  }
}

// ── Profit Agent ────────────────────────────────

export async function profitAgent(product: NormalizedProduct): Promise<AgentResult> {
  const cost = product.costPrice || 0;
  const price = product.suggestedPrice || 0;
  const shipping = product.shippingCost || 0;
  const totalCost = cost + shipping;
  const margin = price > 0 ? ((price - totalCost) / price) * 100 : 0;
  const profit = price - totalCost;

  let score = 0;
  const signals: string[] = [];

  if (cost <= 0 && price <= 0) {
    return { score: 40, confidence: 0.2, reasoning: 'No price data available', signals: ['Price unknown'] };
  }

  // Margin scoring
  if (margin >= 70) { score = 92; signals.push('Excellent margin >70%'); }
  else if (margin >= 60) { score = 80; signals.push('Strong margin >60%'); }
  else if (margin >= 50) { score = 68; signals.push('Good margin >50%'); }
  else if (margin >= 40) { score = 52; signals.push('Decent margin >40%'); }
  else if (margin >= 30) { score = 35; signals.push('Thin margin 30-40%'); }
  else { score = 18; signals.push('Very low margin <30%'); }

  // Profit per unit — critical for ad-driven dropshipping
  if (profit >= 30) { score += 8; signals.push(`$${profit.toFixed(0)} profit per unit`); }
  else if (profit >= 15) { score += 4; signals.push(`$${profit.toFixed(0)} profit per unit`); }
  else if (profit >= 8) { signals.push(`$${profit.toFixed(0)} profit — tight for paid ads`); }
  else if (profit > 0) { score -= 5; signals.push(`Only $${profit.toFixed(0)} profit — may not cover ad spend`); }

  // Impulse price range ($15-$45 = sweet spot for paid social ads)
  if (price >= 15 && price <= 45) { score += 5; signals.push('Impulse-buy price range ($15-45)'); }
  else if (price > 100) { score -= 5; signals.push('High price — harder to sell via ads'); }

  // Low cost = room for discounts and bundles
  if (cost < 10 && cost > 0) { score += 3; signals.push('Low cost base — room for bundles'); }

  return {
    score: Math.min(100, Math.max(0, score)),
    confidence: cost > 0 ? 0.85 : 0.3,
    reasoning: `${margin.toFixed(0)}% margin, $${profit.toFixed(2)} profit per sale`,
    signals,
  };
}

// ── Trend Agent ─────────────────────────────────

export async function trendAgent(product: NormalizedProduct): Promise<AgentResult> {
  const orders = product.orderVolume || 0;
  const reviews = product.reviewCount || 0;
  const rating = product.reviewRating || 0;

  let score = 30; // lower baseline
  const signals: string[] = [];

  // Order volume — the most honest demand signal
  if (orders > 50000) { score += 35; signals.push(`${(orders/1000).toFixed(0)}K orders — proven bestseller`); }
  else if (orders > 10000) { score += 28; signals.push(`${(orders/1000).toFixed(0)}K orders — high demand`); }
  else if (orders > 3000) { score += 20; signals.push(`${(orders/1000).toFixed(1)}K orders — strong demand`); }
  else if (orders > 500) { score += 12; signals.push(`${orders} orders — growing demand`); }
  else if (orders > 100) { score += 5; signals.push(`${orders} orders — early stage`); }
  else { score -= 5; signals.push('Low order volume — unproven'); }

  // Review signals — only score if data exists
  if (rating > 0) {
    if (rating >= 4.7 && reviews > 500) { score += 18; signals.push(`${rating}★ with ${reviews.toLocaleString()} reviews — excellent`); }
    else if (rating >= 4.5 && reviews > 100) { score += 12; signals.push(`${rating}★ (${reviews} reviews)`); }
    else if (rating >= 4.0) { score += 6; signals.push(`${rating}★ rating`); }
    else if (rating < 3.5) { score -= 12; signals.push('Low rating — quality risk'); }
  } else {
    // No rating data — neutral, don't inflate or penalize
    signals.push('No review data available');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    confidence: orders > 500 ? 0.8 : rating > 0 ? 0.5 : 0.3,
    reasoning: `${orders.toLocaleString()} orders${rating > 0 ? `, ${rating}★` : ''}`,
    signals,
  };
}

// ── Saturation Agent ────────────────────────────

export async function saturationAgent(
  product: NormalizedProduct,
  dna: StoreDNA,
): Promise<AgentResult> {
  const prompt = `You are a market saturation analyst. Estimate how saturated this product is in the market.

PRODUCT: "${product.title}"
Category: ${product.category}
Orders: ${product.orderVolume || 0}

Consider:
- Is this a commonly sold dropshipping product?
- Are there many stores already selling this exact product?
- Is the market oversaturated?
- Is there still opportunity for new sellers?

Score 0-100 (100 = LOW saturation = good opportunity, 0 = extremely saturated):
Return JSON: {"score": number, "confidence": number 0-1, "reasoning": "1 sentence", "signals": ["signal1"]}`;

  try {
    return await aiComplete<AgentResult>(prompt, {
      temperature: 0.2,
      maxTokens: 200,
      systemPrompt: 'Market saturation analyst. Return only JSON.',
    });
  } catch {
    return { score: 50, confidence: 0.3, reasoning: 'Agent failed', signals: [] };
  }
}

// ── Supplier Quality Agent ──────────────────────

export function supplierQualityAgent(product: NormalizedProduct): AgentResult {
  let score = 40; // lower baseline — must earn points
  const signals: string[] = [];

  // Shipping speed — critical for customer satisfaction
  const days = product.shippingDays || 15;
  if (days <= 5) { score += 30; signals.push(`${days}-day shipping — excellent`); }
  else if (days <= 8) { score += 18; signals.push(`${days}-day shipping — good`); }
  else if (days <= 12) { score += 8; signals.push(`${days}-day shipping — acceptable`); }
  else if (days <= 20) { score -= 5; signals.push(`${days}-day shipping — slow`); }
  else { score -= 15; signals.push(`${days}-day shipping — very slow`); }

  // Warehouse location
  if (product.warehouseCountry === 'US' || product.warehouseCountry === 'EU') {
    score += 15;
    signals.push(`${product.warehouseCountry} warehouse — fast local delivery`);
  } else if (product.warehouseCountry === 'CN') {
    signals.push('Ships from China');
  }

  // Supplier rating — only score if we have real data
  const sr = product.supplierRating || 0;
  if (sr >= 4.7) { score += 12; signals.push(`${sr}★ supplier rating — excellent`); }
  else if (sr >= 4.0) { score += 6; signals.push(`${sr}★ supplier rating`); }
  else if (sr > 0 && sr < 3.5) { score -= 15; signals.push('Low supplier rating — risk'); }
  else { signals.push('Supplier rating unknown'); }

  // Express shipping
  if (product.shippingSpeed === 'EXPRESS') {
    score += 5;
    signals.push('Express shipping available');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    confidence: 0.85,
    reasoning: `${days}d ship from ${product.warehouseCountry || 'CN'}, ${sr || 'N/A'} supplier rating`,
    signals,
  };
}

// ── Scoring Agent (Orchestrator) ────────────────

const WEIGHTS = {
  storeFit: 0.25,
  profitability: 0.15,
  trendPotential: 0.15,
  viralPrediction: 0.20,
  saturation: 0.10,
  supplierQuality: 0.15,
};

export async function runMultiAgentScoring(
  product: NormalizedProduct,
  dna: StoreDNA,
  settings: MerchantSettingsData,
): Promise<MultiAgentScore> {
  // Run ALL 6 agents in parallel for speed
  const [fit, profit, trend, viral, saturation, supplier] = await Promise.all([
    storeFitAgent(product, dna, settings),
    profitAgent(product),
    trendAgent(product),
    predictViralPotential(product),
    saturationAgent(product, dna),
    Promise.resolve(supplierQualityAgent(product)),
  ]);

  // Weighted final score
  const finalScore = Math.round(
    fit.score * WEIGHTS.storeFit +
    profit.score * WEIGHTS.profitability +
    trend.score * WEIGHTS.trendPotential +
    viral.viralScore * WEIGHTS.viralPrediction +
    saturation.score * WEIGHTS.saturation +
    supplier.score * WEIGHTS.supplierQuality
  );

  // Recommendation
  let recommendation: MultiAgentScore['recommendation'];
  if (fit.score < 30) recommendation = 'avoid';
  else if (finalScore >= 80 && fit.score >= 70) recommendation = 'strong_buy';
  else if (finalScore >= 65 && fit.score >= 60) recommendation = 'buy';
  else if (finalScore >= 50) recommendation = 'maybe';
  else if (fit.score < 50) recommendation = 'avoid';
  else recommendation = 'skip';

  // Boost strong_buy for early viral products
  if (viral.trendStage === 'early_acceleration' && recommendation === 'buy') {
    recommendation = 'strong_buy';
  }

  const explanation = `Store fit: ${fit.score}/100 — ${fit.reasoning}. ` +
    `Profit: ${profit.reasoning}. Trend: ${trend.reasoning}. ` +
    `Viral: ${viral.trendStage} (${viral.viralScore}/100). ` +
    `Supplier: ${supplier.reasoning}.`;

  return {
    storeFit: fit,
    profitability: profit,
    trendPotential: trend,
    viralPrediction: viral,
    saturation,
    supplierQuality: supplier,
    finalScore,
    recommendation,
    explanation,
  };
}

// ── Relevance Filter Agent ──────────────────────
// Fast binary check: does this product belong in this store at all?

export async function relevanceFilterAgent(
  products: NormalizedProduct[],
  storeDescription: string,
): Promise<number[]> {
  // Send batch of titles to AI for fast filtering
  const titles = products.map((p, i) => `${i}. ${p.title}`).join('\n');

  const prompt = `You are a strict product relevance filter for a store that sells: "${storeDescription}"

Here are ${products.length} products. Return ONLY the index numbers of products that CLEARLY belong in this store.

RULES:
- ONLY include products that a customer would EXPECT to find in a "${storeDescription}" store
- REJECT anything even slightly unrelated
- When in doubt, EXCLUDE
- Return at least 3 if any are relevant, but never include irrelevant products

PRODUCTS:
${titles}

Return JSON: {"relevant": [array of index numbers]}`;

  try {
    const result = await aiComplete<{ relevant: number[] }>(prompt, {
      temperature: 0.1,
      maxTokens: 500,
      systemPrompt: `Strict relevance filter for "${storeDescription}" store. Return only JSON with "relevant" array of index numbers.`,
    });
    if (result.relevant && Array.isArray(result.relevant)) {
      return result.relevant.filter(i => i >= 0 && i < products.length);
    }
  } catch (err) {
    console.warn('[RelevanceFilter] Failed:', err);
  }
  // Fallback: return all
  return products.map((_, i) => i);
}
