// ==============================================
// Product Scoring Engine
// ==============================================
// Computes a multi-dimensional weighted score for
// each candidate product against the store's DNA.
// Uses code-based scoring first, AI enrichment second.

import {
  StoreDNA,
  NormalizedProduct,
  ProductScoreBreakdown,
  ScoreWeights,
  DEFAULT_SCORE_WEIGHTS,
  MerchantSettingsData,
} from '../../../shared/types';
import { aiAnalyzeProductFit, aiGenerateExplanation } from '../../utils/ai';

// ── Helper: Clamp score to 0-100 ──────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

// ── Individual Scoring Functions ───────────────

/**
 * DOMAIN FIT: How well does the product match the domain's semantic signals?
 *
 * Formula: Base 30 + keyword_overlap_bonus + vibe_alignment_bonus + category_bias_bonus
 */
function scoreDomainFit(product: NormalizedProduct, dna: StoreDNA): number {
  const domainIntent = dna.domainIntent;
  if (!domainIntent) return 50;

  let score = 30;
  const productText = `${product.title} ${product.description} ${product.category}`.toLowerCase();

  // Keyword overlap with domain-fit keywords
  const keywordMatches = domainIntent.domainFitKeywords.filter((kw) =>
    productText.includes(kw.toLowerCase())
  );
  score += Math.min(30, keywordMatches.length * 10);

  // Category bias alignment
  const categoryMatches = domainIntent.categoryBias.filter((cat) =>
    productText.includes(cat.toLowerCase())
  );
  score += Math.min(20, categoryMatches.length * 10);

  // Vibe alignment - if domain is youthful and product feels youthful
  const vibeScore = domainIntent.vibeScore;
  if (vibeScore.youthful > 60 && isYouthfulProduct(product)) score += 10;
  if (vibeScore.social > 60 && isSocialProduct(product)) score += 10;
  if (vibeScore.technical > 60 && isTechProduct(product)) score += 5;

  return clamp(score);
}

/**
 * STORE FIT: How well does the product fit the store's current catalog and niche?
 *
 * Formula: Base 40 + niche_keyword_match + category_match + gap_fill_bonus
 */
function scoreStoreFit(product: NormalizedProduct, dna: StoreDNA): number {
  let score = 40;
  const productText = `${product.title} ${product.description} ${product.category}`.toLowerCase();

  // Niche keyword match
  const nicheMatches = dna.nicheKeywords.filter((kw) =>
    productText.includes(kw.toLowerCase())
  );
  score += Math.min(20, nicheMatches.length * 7);

  // Category alignment
  const catMatch = dna.topCategories.some((cat) =>
    productText.includes(cat.toLowerCase())
  );
  if (catMatch) score += 10;

  // Gap-filling bonus - products in missing categories get a boost
  const gapMatch = dna.catalogGaps.some((gap) =>
    productText.includes(gap.toLowerCase())
  );
  if (gapMatch) score += 15;

  // Tone alignment
  const toneMatch = dna.toneAttributes.some((tone) =>
    productText.includes(tone.toLowerCase())
  );
  if (toneMatch) score += 5;

  return clamp(score);
}

/**
 * AUDIENCE FIT: How well does the product match the target audience?
 *
 * Formula: Checks audience segment keyword overlap with product description
 */
function scoreAudienceFit(product: NormalizedProduct, dna: StoreDNA): number {
  let score = 40;
  const productText = `${product.title} ${product.description} ${product.category}`.toLowerCase();

  const audienceKeywordMap: Record<string, string[]> = {
    'gen-z': ['tiktok', 'viral', 'aesthetic', 'vibe', 'mood', 'setup', 'led', 'rgb', 'neon', 'retro', 'pixel'],
    'teenagers': ['cool', 'gaming', 'room', 'desk', 'phone', 'gadget', 'trend'],
    'young adults': ['apartment', 'lifestyle', 'setup', 'creative', 'smart', 'wireless'],
    'gamers': ['gaming', 'rgb', 'desk', 'mouse', 'keyboard', 'headset', 'controller', 'pixel'],
    'creators': ['creator', 'content', 'ring light', 'tripod', 'mic', 'camera', 'studio'],
    'tiktok users': ['tiktok', 'viral', 'trend', 'satisfying', 'unboxing', 'review'],
  };

  for (const segment of dna.audienceSegments) {
    const keywords = audienceKeywordMap[segment.toLowerCase()] || [];
    const matches = keywords.filter((kw) => productText.includes(kw));
    score += Math.min(15, matches.length * 5);
  }

  return clamp(score);
}

/**
 * PRICE FIT: Does the suggested price fall within the store's range?
 *
 * Formula: 100 if within range, decreasing penalty as distance increases
 */
function scorePriceFit(
  product: NormalizedProduct,
  settings: MerchantSettingsData
): number {
  const price = product.suggestedPrice || product.costPrice * 2.5;
  const min = settings.priceRangeMin || 10;
  const max = settings.priceRangeMax || 100;

  if (price >= min && price <= max) return 90;

  // How far outside the range?
  const range = max - min;
  if (price < min) {
    const dist = (min - price) / range;
    return clamp(90 - dist * 80);
  }
  const dist = (price - max) / range;
  return clamp(90 - dist * 80);
}

/**
 * MARGIN FIT: Can the merchant hit their minimum margin?
 *
 * Formula: margin_percent / target_margin * 100, capped at 100
 */
function scoreMarginFit(
  product: NormalizedProduct,
  settings: MerchantSettingsData
): number {
  const cost = product.costPrice + (product.shippingCost || 0);
  const price = product.suggestedPrice || cost * 2.5;
  const marginPercent = ((price - cost) / price) * 100;
  const target = settings.minimumMarginPercent || 30;

  if (marginPercent >= target) {
    // Bonus for exceeding target, up to 100
    return clamp(70 + (marginPercent - target) * 1.5);
  }

  // Penalty for missing target
  return clamp((marginPercent / target) * 70);
}

/**
 * SHIPPING FIT: Does shipping speed match merchant preference?
 */
function scoreShippingFit(
  product: NormalizedProduct,
  settings: MerchantSettingsData
): number {
  const days = product.shippingDays || 20;
  const preferred = settings.desiredShippingSpeed;

  const thresholds: Record<string, number> = {
    EXPRESS: 5,
    STANDARD: 15,
    ECONOMY: 25,
    UNKNOWN: 20,
  };

  const target = thresholds[preferred] || 15;

  if (days <= target) return 90;
  if (days <= target * 1.5) return 65;
  if (days <= target * 2) return 40;
  return 20;
}

/**
 * SATURATION INVERSE: Less saturated = higher score
 *
 * Uses order volume as a proxy. Very high volumes suggest saturation.
 */
function scoreSaturationInverse(product: NormalizedProduct): number {
  const volume = product.orderVolume || 0;

  if (volume < 1000) return 85; // Low saturation, but also unproven
  if (volume < 10000) return 90; // Sweet spot - proven but not oversaturated
  if (volume < 50000) return 70; // Getting saturated
  if (volume < 200000) return 50;
  return 30; // Highly saturated
}

/**
 * REFUND RISK INVERSE: Lower refund risk = higher score
 *
 * Uses review rating and review count as proxies
 */
function scoreRefundRiskInverse(product: NormalizedProduct): number {
  const rating = product.reviewRating || 0;
  const count = product.reviewCount || 0;

  if (count < 10) return 40; // Too few reviews, uncertain
  if (rating >= 4.5 && count > 100) return 95;
  if (rating >= 4.0) return 75;
  if (rating >= 3.5) return 55;
  if (rating >= 3.0) return 35;
  return 20;
}

// ── Product Heuristics ─────────────────────────

const YOUTHFUL_KEYWORDS = ['led', 'rgb', 'neon', 'gaming', 'tiktok', 'viral', 'aesthetic', 'vibe', 'pixel', 'retro', 'cool'];
const SOCIAL_KEYWORDS = ['viral', 'tiktok', 'instagram', 'photo', 'content', 'show', 'display', 'aesthetic', 'unbox'];
const TECH_KEYWORDS = ['smart', 'bluetooth', 'wifi', 'wireless', 'usb', 'digital', 'app', 'sensor', 'programmable'];

function isYouthfulProduct(p: NormalizedProduct): boolean {
  const text = `${p.title} ${p.description}`.toLowerCase();
  return YOUTHFUL_KEYWORDS.some((kw) => text.includes(kw));
}

function isSocialProduct(p: NormalizedProduct): boolean {
  const text = `${p.title} ${p.description}`.toLowerCase();
  return SOCIAL_KEYWORDS.some((kw) => text.includes(kw));
}

function isTechProduct(p: NormalizedProduct): boolean {
  const text = `${p.title} ${p.description}`.toLowerCase();
  return TECH_KEYWORDS.some((kw) => text.includes(kw));
}

// ── Main Scoring Pipeline ──────────────────────

/**
 * Score a product against the store's DNA.
 * Returns a full breakdown with explanation.
 */
export async function scoreProduct(
  product: NormalizedProduct,
  dna: StoreDNA,
  settings: MerchantSettingsData,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
  useAI = true
): Promise<ProductScoreBreakdown> {
  // Step 1: Code-based scores
  const domainFit = scoreDomainFit(product, dna);
  const storeFit = scoreStoreFit(product, dna);
  const audienceFit = scoreAudienceFit(product, dna);
  const priceFit = scorePriceFit(product, settings);
  const marginFit = scoreMarginFit(product, settings);
  const shippingFit = scoreShippingFit(product, settings);
  const saturationInverse = scoreSaturationInverse(product);
  const refundRiskInverse = scoreRefundRiskInverse(product);

  // Step 2: AI-enriched scores (visual virality, trend fit, novelty)
  let trendFit = 50;
  let visualVirality = 50;
  let novelty = 50;
  let fitReasons: string[] = [];
  let concerns: string[] = [];
  let aiExplanation = '';

  if (useAI) {
    try {
      const aiResult = await aiAnalyzeProductFit(
        { title: product.title, description: product.description || '', category: product.category },
        {
          description: dna.description,
          audience: dna.audienceSegments,
          domainKeywords: dna.domainIntent?.domainFitKeywords || [],
          vibe: dna.brandVibe,
          categories: dna.topCategories,
        }
      );

      trendFit = clamp(aiResult.trendFit || 50);
      visualVirality = clamp(aiResult.visualVirality || 50);
      novelty = clamp(aiResult.novelty || 50);
      audienceFit; // Keep code-based, but could blend
      fitReasons = aiResult.fitReasons || [];
      concerns = aiResult.concerns || [];
      aiExplanation = aiResult.explanation || '';
    } catch (err) {
      console.warn('AI scoring enrichment failed, using defaults:', err);
    }
  }

  // Step 3: Compute weighted final score
  const scores = {
    domainFit,
    storeFit,
    audienceFit,
    trendFit,
    visualVirality,
    novelty,
    priceFit,
    marginFit,
    shippingFit,
    saturationInverse,
    refundRiskInverse,
  };

  const finalScore =
    scores.domainFit * weights.domainFit +
    scores.storeFit * weights.storeFit +
    scores.audienceFit * weights.audienceFit +
    scores.trendFit * weights.trendFit +
    scores.visualVirality * weights.visualVirality +
    scores.novelty * weights.novelty +
    scores.priceFit * weights.priceFit +
    scores.marginFit * weights.marginFit +
    scores.shippingFit * weights.shippingFit +
    scores.saturationInverse * weights.saturationInverse +
    scores.refundRiskInverse * weights.refundRiskInverse;

  // Confidence based on data completeness
  let confidence = 0.5;
  if (product.reviewCount && product.reviewCount > 50) confidence += 0.15;
  if (product.orderVolume && product.orderVolume > 100) confidence += 0.1;
  if (product.description && product.description.length > 50) confidence += 0.1;
  if (product.imageUrls.length > 0) confidence += 0.05;
  if (useAI && aiExplanation) confidence += 0.1;
  confidence = Math.min(1, confidence);

  // Build explanation
  const explanation = aiExplanation || buildExplanation(product, scores, dna, settings);

  // Auto-generate fit reasons if AI didn't provide them
  if (fitReasons.length === 0) {
    fitReasons = generateFitReasons(scores, dna, product);
  }

  return {
    ...scores,
    finalScore: Math.round(finalScore * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    explanation,
    fitReasons,
    concerns,
  };
}

/**
 * Fallback explanation builder (no AI)
 */
function buildExplanation(
  product: NormalizedProduct,
  scores: Record<string, number>,
  dna: StoreDNA,
  settings: MerchantSettingsData
): string {
  const parts: string[] = [];

  if (scores.domainFit > 70) parts.push(`Strong domain alignment with "${dna.domain}"`);
  if (scores.audienceFit > 70) parts.push(`Good fit for ${dna.audienceSegments.slice(0, 2).join(' & ')} audience`);
  if (scores.marginFit > 70) {
    const cost = product.costPrice + (product.shippingCost || 0);
    const price = product.suggestedPrice || cost * 2.5;
    const margin = ((price - cost) / price * 100).toFixed(0);
    parts.push(`${margin}% estimated margin`);
  }
  if (scores.visualVirality > 70) parts.push('High visual/social media appeal');
  if (scores.shippingFit < 40) parts.push('Shipping speed may be slower than preferred');

  return parts.join('. ') + '.';
}

/**
 * Auto-generate fit reasons from scores
 */
function generateFitReasons(
  scores: Record<string, number>,
  dna: StoreDNA,
  product: NormalizedProduct
): string[] {
  const reasons: string[] = [];

  if (scores.domainFit > 65) reasons.push(`Aligns with "${dna.domain}" brand identity`);
  if (scores.audienceFit > 65) reasons.push(`Matches ${dna.audienceSegments[0]} target audience`);
  if (scores.trendFit > 65) reasons.push('Currently trending product');
  if (scores.visualVirality > 65) reasons.push('Strong visual/social media appeal');
  if (scores.marginFit > 70) reasons.push('Healthy profit margin');
  if (scores.novelty > 65) reasons.push('Unique product with low competition');

  if (reasons.length === 0) reasons.push('General category match');

  return reasons.slice(0, 4);
}

/**
 * Batch score multiple products
 */
export async function scoreProducts(
  products: NormalizedProduct[],
  dna: StoreDNA,
  settings: MerchantSettingsData,
  weights?: ScoreWeights,
  useAI = true
): Promise<(NormalizedProduct & { score: ProductScoreBreakdown })[]> {
  const scored = await Promise.all(
    products.map(async (product) => {
      const score = await scoreProduct(product, dna, settings, weights, useAI);
      return { ...product, score };
    })
  );

  // Sort by final score descending
  return scored.sort((a, b) => b.score.finalScore - a.score.finalScore);
}
