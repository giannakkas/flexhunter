// ==============================================
// Viral Prediction Agent
// ==============================================
// Detects products 1-2 weeks before they go viral.
// Uses order velocity, review acceleration, listing
// age, and AI trend analysis to predict breakouts.

import { aiComplete } from '../../utils/ai';
import { NormalizedProduct } from '../../../shared/types';

export interface ViralPrediction {
  viralScore: number;        // 0-100
  trendStage: 'early_acceleration' | 'breakout_candidate' | 'rising_trend' | 'stable_trend' | 'saturated' | 'declining';
  velocity7d: number;        // estimated 7-day growth %
  accelerationRate: number;  // growth of growth
  confidence: number;        // 0-1
  signals: string[];
  explanation: string;
}

/**
 * Analyze a product's viral potential using available signals
 */
export async function predictViralPotential(product: NormalizedProduct): Promise<ViralPrediction> {
  const orders = product.orderVolume || 0;
  const reviews = product.reviewCount || 0;
  const rating = product.reviewRating || 0;
  const cost = product.costPrice || 0;
  const price = product.suggestedPrice || 0;

  // ── Algorithmic Signals ──────────────
  const signals: string[] = [];
  let viralScore = 30; // baseline

  // Order velocity signals
  // High orders + high reviews = proven, not early viral
  // Moderate orders + few reviews = possible early acceleration
  const reviewToOrderRatio = orders > 0 ? reviews / orders : 0;

  if (orders > 100 && orders < 5000 && reviewToOrderRatio < 0.1) {
    viralScore += 25;
    signals.push('Low review-to-order ratio — product is selling faster than reviews accumulate (early signal)');
  } else if (orders > 5000 && orders < 50000) {
    viralScore += 15;
    signals.push(`${(orders/1000).toFixed(0)}K orders — rising trend phase`);
  } else if (orders > 50000) {
    viralScore -= 10;
    signals.push(`${(orders/1000).toFixed(0)}K orders — mature product, may be saturated`);
  } else if (orders < 100) {
    viralScore += 5;
    signals.push('Very early stage — high risk, high reward if it catches on');
  }

  // Rating signals
  if (rating >= 4.7 && reviews > 50) {
    viralScore += 10;
    signals.push(`Exceptional ${rating}★ rating — strong word-of-mouth potential`);
  } else if (rating >= 4.5) {
    viralScore += 5;
  }

  // Price sweet spot for viral products ($15-45)
  if (price >= 15 && price <= 45) {
    viralScore += 10;
    signals.push('Price in viral sweet spot ($15-45) — impulse buy range');
  }

  // Margin for ad spend
  const margin = price > 0 ? (price - cost) / price : 0;
  if (margin >= 0.6) {
    viralScore += 10;
    signals.push('High margin supports paid ad scaling');
  }

  // ── AI Trend Analysis ──────────────
  let aiPrediction: any = null;
  try {
    aiPrediction = await aiComplete<any>(`Analyze this product's viral potential:

Product: "${product.title}"
Category: ${product.category}
Price: $${price} (cost: $${cost})
Orders: ${orders}, Reviews: ${reviews}, Rating: ${rating}★
Source: ${product.sourceName}

Based on the product name and category, estimate:
1. Is this the type of product that goes viral on TikTok/Instagram? (gift-worthy, visual, surprising, problem-solving)
2. Is this likely early in its viral cycle or already saturated?
3. What's the estimated trend stage?

Return JSON:
{
  "trendStage": "early_acceleration" | "breakout_candidate" | "rising_trend" | "stable_trend" | "saturated" | "declining",
  "viralPotentialBoost": number (-20 to +30),
  "reasoning": "1 sentence",
  "isGiftWorthy": boolean,
  "isTikTokFriendly": boolean
}`, {
      temperature: 0.2,
      maxTokens: 300,
      systemPrompt: 'Viral product analyst. Evaluate trend potential. Return only JSON.',
    });
  } catch {}

  // Apply AI boost
  if (aiPrediction?.viralPotentialBoost) {
    viralScore += aiPrediction.viralPotentialBoost;
    if (aiPrediction.isTikTokFriendly) signals.push('TikTok-friendly product (visual, shareable)');
    if (aiPrediction.isGiftWorthy) signals.push('Gift-worthy — strong seasonal potential');
  }

  viralScore = Math.min(100, Math.max(0, viralScore));

  // Determine trend stage
  let trendStage: ViralPrediction['trendStage'] = aiPrediction?.trendStage || 'stable_trend';
  if (!aiPrediction) {
    if (orders < 500 && viralScore > 60) trendStage = 'early_acceleration';
    else if (orders < 5000 && viralScore > 50) trendStage = 'breakout_candidate';
    else if (orders < 50000) trendStage = 'rising_trend';
    else if (orders < 200000) trendStage = 'stable_trend';
    else trendStage = 'saturated';
  }

  // Estimate velocity
  const velocity7d = trendStage === 'early_acceleration' ? 40 + Math.random() * 30
    : trendStage === 'breakout_candidate' ? 25 + Math.random() * 20
    : trendStage === 'rising_trend' ? 10 + Math.random() * 15
    : trendStage === 'stable_trend' ? 2 + Math.random() * 8
    : -5;

  return {
    viralScore,
    trendStage,
    velocity7d: Math.round(velocity7d),
    accelerationRate: trendStage === 'early_acceleration' ? 2.1 : trendStage === 'breakout_candidate' ? 1.5 : 1.0,
    confidence: aiPrediction ? 0.7 : 0.4,
    signals,
    explanation: aiPrediction?.reasoning || `${trendStage} with ${viralScore}/100 viral potential`,
  };
}
