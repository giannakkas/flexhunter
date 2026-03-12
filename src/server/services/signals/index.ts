// ==============================================
// Signal Engine & Feature Store
// ==============================================
// Normalizes all product signals into a unified format.
// Stores computed features persistently for consistent
// scoring and feedback learning.

import prisma from '../../utils/db';
import cache from '../../utils/cache';
import logger from '../../utils/logger';

// ── Normalized Signal Structure ─────────────

export interface ProductSignals {
  productId: string;
  shopId: string;

  // Trend signals
  trendVelocity: number;       // 0-100
  trendStage: string;          // early_acceleration, breakout, rising, stable, saturated
  viralScore: number;          // 0-100
  googleTrendInterest: number; // 0-100
  tiktokViews: number;
  amazonDemand: number;        // 0-100

  // Supplier signals
  supplierRating: number;      // 0-5
  shippingDays: number;
  shippingScore: number;       // 0-100
  warehouseCountry: string;
  hasExpressShipping: boolean;

  // Price signals
  costPrice: number;
  suggestedPrice: number;
  marginPercent: number;       // 0-100
  marginScore: number;         // 0-100
  profitPerUnit: number;
  priceInSweetSpot: boolean;   // $15-45 impulse range

  // Competition signals
  saturationScore: number;     // 0-100 (100 = low saturation = good)
  sellerCount: number;         // estimated
  adSaturation: number;        // 0-100

  // Store-fit signals
  storeFitScore: number;       // 0-100
  domainFitScore: number;      // 0-100
  audienceFitScore: number;    // 0-100
  priceBandFit: boolean;

  // Quality signals
  reviewRating: number;        // 0-5
  reviewCount: number;
  orderVolume: number;

  // Confidence
  evidenceCompleteness: number;  // 0-1 (how much data we actually have)
  signalCount: number;           // how many signals are non-default

  // Metadata
  computedAt: string;
}

// ── Signal Defaults ─────────────────────────

const DEFAULTS: Omit<ProductSignals, 'productId' | 'shopId' | 'computedAt'> = {
  trendVelocity: 40, trendStage: 'stable', viralScore: 30,
  googleTrendInterest: 0, tiktokViews: 0, amazonDemand: 0,
  supplierRating: 0, shippingDays: 15, shippingScore: 40,
  warehouseCountry: 'CN', hasExpressShipping: false,
  costPrice: 0, suggestedPrice: 0, marginPercent: 0,
  marginScore: 40, profitPerUnit: 0, priceInSweetSpot: false,
  saturationScore: 50, sellerCount: 0, adSaturation: 50,
  storeFitScore: 50, domainFitScore: 50, audienceFitScore: 50, priceBandFit: false,
  reviewRating: 0, reviewCount: 0, orderVolume: 0,
  evidenceCompleteness: 0, signalCount: 0,
};

// ── Build Signals from Agent Results ────────

export function buildSignals(
  productId: string,
  shopId: string,
  agentScore: any,
  product: any,
): ProductSignals {
  const signals: ProductSignals = {
    ...DEFAULTS,
    productId,
    shopId,
    computedAt: new Date().toISOString(),
  };

  let filledSignals = 0;

  // From product data
  if (product.costPrice) { signals.costPrice = product.costPrice; filledSignals++; }
  if (product.suggestedPrice) { signals.suggestedPrice = product.suggestedPrice; filledSignals++; }
  if (product.reviewRating) { signals.reviewRating = product.reviewRating; filledSignals++; }
  if (product.reviewCount) { signals.reviewCount = product.reviewCount; filledSignals++; }
  if (product.orderVolume) { signals.orderVolume = product.orderVolume; filledSignals++; }
  if (product.shippingDays) { signals.shippingDays = product.shippingDays; filledSignals++; }
  if (product.warehouseCountry) { signals.warehouseCountry = product.warehouseCountry; filledSignals++; }
  if (product.shippingSpeed === 'EXPRESS') { signals.hasExpressShipping = true; filledSignals++; }
  if (product.supplierRating) { signals.supplierRating = product.supplierRating; filledSignals++; }

  // Calculated price signals
  if (signals.costPrice > 0 && signals.suggestedPrice > 0) {
    signals.marginPercent = ((signals.suggestedPrice - signals.costPrice) / signals.suggestedPrice) * 100;
    signals.profitPerUnit = signals.suggestedPrice - signals.costPrice;
    signals.priceInSweetSpot = signals.suggestedPrice >= 15 && signals.suggestedPrice <= 45;
    filledSignals += 3;
  }

  // From agent scores
  if (agentScore) {
    if (agentScore.storeFit) {
      signals.storeFitScore = agentScore.storeFit.score;
      signals.domainFitScore = agentScore.storeFit.score;
      signals.audienceFitScore = agentScore.storeFit.score;
      filledSignals += 3;
    }
    if (agentScore.profitability) {
      signals.marginScore = agentScore.profitability.score;
      filledSignals++;
    }
    if (agentScore.trendPotential) {
      signals.trendVelocity = agentScore.trendPotential.score;
      filledSignals++;
    }
    if (agentScore.viralPrediction) {
      signals.viralScore = agentScore.viralPrediction.viralScore;
      signals.trendStage = agentScore.viralPrediction.trendStage;
      filledSignals += 2;
    }
    if (agentScore.saturation) {
      signals.saturationScore = agentScore.saturation.score;
      filledSignals++;
    }
    if (agentScore.supplierQuality) {
      signals.shippingScore = agentScore.supplierQuality.score;
      filledSignals++;
    }
  }

  // Evidence completeness: what fraction of signals have real data
  const totalPossibleSignals = 22;
  signals.signalCount = filledSignals;
  signals.evidenceCompleteness = Math.round((filledSignals / totalPossibleSignals) * 100) / 100;

  return signals;
}

// ── Feature Store: Persist & Retrieve ───────

export async function storeSignals(signals: ProductSignals): Promise<void> {
  const key = `signals:${signals.shopId}:${signals.productId}`;
  await cache.set(key, signals, 24 * 3600); // 24h TTL

  // Also store in DB as JSON on the candidate score
  try {
    const score = await prisma.candidateScore.findFirst({
      where: { candidate: { id: signals.productId } },
    });
    if (score) {
      await prisma.candidateScore.update({
        where: { id: score.id },
        data: { rawSignals: signals as any },
      });
    }
  } catch {} // rawSignals column may not exist yet — that's OK
}

export async function getSignals(shopId: string, productId: string): Promise<ProductSignals | null> {
  const key = `signals:${shopId}:${productId}`;
  return cache.get<ProductSignals>(key);
}

// ── Scoring Trace — explains why a product scored the way it did ──

export interface ScoringTrace {
  productId: string;
  productTitle: string;
  finalScore: number;
  recommendation: string;
  signals: ProductSignals;
  weights: Record<string, number>;
  breakdown: { dimension: string; rawScore: number; weight: number; weighted: number }[];
  confidenceExplanation: string;
  evidenceCompleteness: string;
  timestamp: string;
}

export function buildScoringTrace(
  productId: string,
  productTitle: string,
  agentScore: any,
  signals: ProductSignals,
): ScoringTrace {
  const weights = {
    storeFit: 0.25, profitability: 0.15, trendPotential: 0.15,
    viralPrediction: 0.20, saturation: 0.10, supplierQuality: 0.15,
  };

  const breakdown = [
    { dimension: 'Store Fit', rawScore: agentScore.storeFit?.score || 0, weight: weights.storeFit, weighted: (agentScore.storeFit?.score || 0) * weights.storeFit },
    { dimension: 'Profitability', rawScore: agentScore.profitability?.score || 0, weight: weights.profitability, weighted: (agentScore.profitability?.score || 0) * weights.profitability },
    { dimension: 'Trend', rawScore: agentScore.trendPotential?.score || 0, weight: weights.trendPotential, weighted: (agentScore.trendPotential?.score || 0) * weights.trendPotential },
    { dimension: 'Viral', rawScore: agentScore.viralPrediction?.viralScore || 0, weight: weights.viralPrediction, weighted: (agentScore.viralPrediction?.viralScore || 0) * weights.viralPrediction },
    { dimension: 'Saturation', rawScore: agentScore.saturation?.score || 0, weight: weights.saturation, weighted: (agentScore.saturation?.score || 0) * weights.saturation },
    { dimension: 'Supplier', rawScore: agentScore.supplierQuality?.score || 0, weight: weights.supplierQuality, weighted: (agentScore.supplierQuality?.score || 0) * weights.supplierQuality },
  ];

  const evidenceLevel = signals.evidenceCompleteness >= 0.7 ? 'high'
    : signals.evidenceCompleteness >= 0.4 ? 'medium' : 'low';

  const confidenceExplanation = signals.evidenceCompleteness >= 0.7
    ? `High confidence — ${signals.signalCount} of 22 signals have real data`
    : signals.evidenceCompleteness >= 0.4
    ? `Medium confidence — ${signals.signalCount} of 22 signals filled. Missing data may affect accuracy.`
    : `Low confidence — only ${signals.signalCount} of 22 signals available. Treat recommendation with caution.`;

  return {
    productId,
    productTitle,
    finalScore: agentScore.finalScore,
    recommendation: agentScore.recommendation,
    signals,
    weights,
    breakdown,
    confidenceExplanation,
    evidenceCompleteness: evidenceLevel,
    timestamp: new Date().toISOString(),
  };
}
