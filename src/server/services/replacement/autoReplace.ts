// ==============================================
// Automated Replacement Engine
// ==============================================
// Detects weak products and suggests replacements
// from the latest research candidates.

import prisma from '../../utils/db';
import { aiComplete } from '../../utils/ai';

export interface ReplacementSuggestion {
  weakProductId: string;
  weakProductTitle: string;
  replacementCandidateId: string;
  replacementTitle: string;
  reason: string;
  confidence: number;
  estimatedImprovement: string;
}

/**
 * Scan for weak products and suggest replacements
 */
export async function scanForReplacements(shopId: string): Promise<ReplacementSuggestion[]> {
  // Find weak products (low health, no orders after testing period)
  const weakProducts = await prisma.importedProduct.findMany({
    where: {
      shopId,
      OR: [
        { status: 'WEAK' },
        {
          status: 'TESTING',
          testStartedAt: { lt: new Date(Date.now() - 14 * 86400000) }, // 14+ days
        },
      ],
    },
    include: { performance: true, candidate: { include: { score: true } } },
  });

  if (weakProducts.length === 0) {
    console.log('[Replace] No weak products found');
    return [];
  }

  // Find available replacement candidates (not yet imported, good score)
  const candidates = await prisma.candidateProduct.findMany({
    where: {
      shopId,
      status: 'CANDIDATE',
      importedProduct: null,
    },
    include: { score: true },
    orderBy: { score: { finalScore: 'desc' } },
    take: 20,
  });

  if (candidates.length === 0) {
    console.log('[Replace] No replacement candidates available');
    return [];
  }

  const suggestions: ReplacementSuggestion[] = [];

  for (const weak of weakProducts) {
    // Find best replacement candidate using AI
    const candidateSummary = candidates.slice(0, 10).map(c => ({
      id: c.id,
      title: c.title,
      score: c.score?.finalScore || 0,
      price: c.suggestedPrice,
      category: c.category,
    }));

    try {
      const result = await aiComplete<{ bestReplacementIdx: number; reason: string; estimatedImprovement: string }>(`
A product in the store is underperforming: "${weak.importedTitle}" (${weak.performance?.orders || 0} orders, $${weak.performance?.revenue?.toFixed(0) || 0} revenue in ${Math.floor((Date.now() - new Date(weak.importedAt).getTime()) / 86400000)} days).

Here are potential replacements:
${candidateSummary.map((c, i) => `${i}. "${c.title}" (score: ${c.score}, $${c.price})`).join('\n')}

Which product would be the best replacement? Consider: similar category, higher score, better market potential.

Return JSON: {"bestReplacementIdx": number, "reason": "why this is better", "estimatedImprovement": "e.g., 3x more orders expected"}`, {
        temperature: 0.2,
        maxTokens: 200,
        systemPrompt: 'Product replacement analyst. Return only JSON.',
      });

      if (result.bestReplacementIdx !== undefined && candidateSummary[result.bestReplacementIdx]) {
        const replacement = candidateSummary[result.bestReplacementIdx];
        suggestions.push({
          weakProductId: weak.id,
          weakProductTitle: weak.importedTitle,
          replacementCandidateId: replacement.id,
          replacementTitle: replacement.title,
          reason: result.reason,
          confidence: replacement.score > 70 ? 0.8 : 0.5,
          estimatedImprovement: result.estimatedImprovement,
        });
      }
    } catch {}
  }

  // Save replacement decisions
  for (const suggestion of suggestions) {
    await prisma.replacementDecision.create({
      data: {
        shopId,
        currentProductId: suggestion.weakProductId,
        replacementCandidateId: suggestion.replacementCandidateId,
        action: 'SUGGESTED',
        confidence: suggestion.confidence,
        reason: suggestion.reason,
        fitExplanation: suggestion.estimatedImprovement,
      },
    }).catch(() => {});
  }

  console.log(`[Replace] Found ${suggestions.length} replacement suggestions for ${weakProducts.length} weak products`);
  return suggestions;
}
