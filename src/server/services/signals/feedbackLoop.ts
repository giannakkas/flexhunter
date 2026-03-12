// ==============================================
// Outcome Feedback Loop
// ==============================================
// Collects real merchant outcomes (sales, revenue)
// and recalibrates scoring weights based on what
// actually works for each store.

import prisma from '../../utils/db';
import cache from '../../utils/cache';
import logger from '../../utils/logger';

// ── Default Weights ─────────────────────────

export const DEFAULT_WEIGHTS = {
  storeFit: 0.25,
  profitability: 0.15,
  trendPotential: 0.15,
  viralPrediction: 0.20,
  saturation: 0.10,
  supplierQuality: 0.15,
};

// ── Get Shop-Specific Weights ───────────────
// Uses learned weights if available, falls back to defaults

export async function getWeights(shopId: string): Promise<typeof DEFAULT_WEIGHTS> {
  const cached = await cache.get<typeof DEFAULT_WEIGHTS>(`weights:${shopId}`);
  if (cached) return cached;

  // Check if shop has enough data to learn custom weights
  try {
    const importCount = await prisma.importedProduct.count({ where: { shopId } });
    if (importCount < 5) return DEFAULT_WEIGHTS; // Need at least 5 imports

    const learned = await learnWeights(shopId);
    if (learned) {
      await cache.set(`weights:${shopId}`, learned, 6 * 3600); // 6h cache
      return learned;
    }
  } catch {}

  return DEFAULT_WEIGHTS;
}

// ── Learn Weights from Outcomes ─────────────
// Analyzes which scoring dimensions correlated with actual success

async function learnWeights(shopId: string): Promise<typeof DEFAULT_WEIGHTS | null> {
  try {
    const imports = await prisma.importedProduct.findMany({
      where: { shopId },
      include: {
        performance: true,
        candidate: { include: { score: true } },
      },
    });

    if (imports.length < 5) return null;

    // Classify outcomes: winner vs loser
    const outcomes = imports.map(imp => {
      const perf = imp.performance;
      const score = imp.candidate?.score;
      if (!score) return null;

      const isSuccess = (perf?.conversions || 0) > 0 || (perf?.revenue || 0) > 50;
      return {
        isSuccess,
        storeFit: score.storeFit || 50,
        profitability: score.marginFit || 50,
        trendPotential: score.trendFit || 50,
        viralPrediction: score.visualVirality || 50,
        saturation: score.saturationInverse || 50,
        supplierQuality: score.shippingFit || 50,
      };
    }).filter(Boolean) as NonNullable<typeof outcomes[number]>[];

    if (outcomes.length < 5) return null;

    const winners = outcomes.filter(o => o.isSuccess);
    const losers = outcomes.filter(o => !o.isSuccess);

    if (winners.length === 0 || losers.length === 0) return null;

    // Calculate which dimensions differentiate winners from losers
    const dimensions = ['storeFit', 'profitability', 'trendPotential', 'viralPrediction', 'saturation', 'supplierQuality'] as const;
    const deltas: Record<string, number> = {};

    for (const dim of dimensions) {
      const winnerAvg = winners.reduce((s, w) => s + (w[dim] as number), 0) / winners.length;
      const loserAvg = losers.reduce((s, l) => s + (l[dim] as number), 0) / losers.length;
      // Delta = how much this dimension differentiates winners from losers
      deltas[dim] = Math.max(0, winnerAvg - loserAvg);
    }

    // Normalize deltas to sum to 1.0
    const totalDelta = Object.values(deltas).reduce((s, d) => s + d, 0);
    if (totalDelta === 0) return null;

    const learned = {
      storeFit: deltas.storeFit / totalDelta,
      profitability: deltas.profitability / totalDelta,
      trendPotential: deltas.trendPotential / totalDelta,
      viralPrediction: deltas.viralPrediction / totalDelta,
      saturation: deltas.saturation / totalDelta,
      supplierQuality: deltas.supplierQuality / totalDelta,
    };

    // Blend: 60% learned + 40% defaults (don't completely override)
    const blended = {
      storeFit: learned.storeFit * 0.6 + DEFAULT_WEIGHTS.storeFit * 0.4,
      profitability: learned.profitability * 0.6 + DEFAULT_WEIGHTS.profitability * 0.4,
      trendPotential: learned.trendPotential * 0.6 + DEFAULT_WEIGHTS.trendPotential * 0.4,
      viralPrediction: learned.viralPrediction * 0.6 + DEFAULT_WEIGHTS.viralPrediction * 0.4,
      saturation: learned.saturation * 0.6 + DEFAULT_WEIGHTS.saturation * 0.4,
      supplierQuality: learned.supplierQuality * 0.6 + DEFAULT_WEIGHTS.supplierQuality * 0.4,
    };

    // Normalize to sum to 1.0
    const total = Object.values(blended).reduce((s, v) => s + v, 0);
    for (const key of Object.keys(blended) as (keyof typeof blended)[]) {
      blended[key] = Math.round((blended[key] / total) * 1000) / 1000;
    }

    logger.info('Learned custom weights', { shopId, imports: imports.length, winners: winners.length, weights: blended });
    return blended;
  } catch (err: any) {
    logger.warn('Weight learning failed', { shopId, error: err.message });
    return null;
  }
}

// ── Recalibrate on demand ───────────────────

export async function recalibrateWeights(shopId: string): Promise<{
  learned: boolean;
  weights: typeof DEFAULT_WEIGHTS;
  imports: number;
  winners: number;
}> {
  await cache.del(`weights:${shopId}`);

  const imports = await prisma.importedProduct.count({ where: { shopId } });
  const winners = await prisma.importedProduct.count({ where: { shopId, status: 'WINNER' } });

  if (imports < 5) {
    return { learned: false, weights: DEFAULT_WEIGHTS, imports, winners };
  }

  const weights = await getWeights(shopId);
  const isLearned = JSON.stringify(weights) !== JSON.stringify(DEFAULT_WEIGHTS);

  return { learned: isLearned, weights, imports, winners };
}
