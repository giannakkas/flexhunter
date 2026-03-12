// ==============================================
// Pairwise Product Ranking
// ==============================================
// Instead of scoring products independently,
// compares them head-to-head to determine
// which is a better opportunity for the store.

import { aiComplete } from '../../utils/ai';

export interface PairwiseResult {
  winnerId: string;
  loserId: string;
  winnerTitle: string;
  loserTitle: string;
  confidence: number;
  reason: string;
  dimensions: {
    storeFit: 'A' | 'B' | 'tie';
    profitability: 'A' | 'B' | 'tie';
    trendPotential: 'A' | 'B' | 'tie';
    supplierQuality: 'A' | 'B' | 'tie';
  };
}

/**
 * Compare two products head-to-head for a specific store
 */
export async function compareProducts(
  productA: { id: string; title: string; score: number; price: number; cost: number; orders: number; rating: number; shippingDays: number; category: string },
  productB: { id: string; title: string; score: number; price: number; cost: number; orders: number; rating: number; shippingDays: number; category: string },
  storeDescription: string,
): Promise<PairwiseResult> {
  const prompt = `Compare these two products for a store that sells: "${storeDescription}"

PRODUCT A: "${productA.title}"
- Price: $${productA.price}, Cost: $${productA.cost}, Margin: ${productA.price > 0 ? ((productA.price - productA.cost) / productA.price * 100).toFixed(0) : 0}%
- Orders: ${productA.orders}, Rating: ${productA.rating}★, Shipping: ${productA.shippingDays}d
- Category: ${productA.category}
- AI Score: ${productA.score}/100

PRODUCT B: "${productB.title}"
- Price: $${productB.price}, Cost: $${productB.cost}, Margin: ${productB.price > 0 ? ((productB.price - productB.cost) / productB.price * 100).toFixed(0) : 0}%
- Orders: ${productB.orders}, Rating: ${productB.rating}★, Shipping: ${productB.shippingDays}d
- Category: ${productB.category}
- AI Score: ${productB.score}/100

Which product is the BETTER opportunity for this store? Consider:
1. Store fit — which one belongs better in a "${storeDescription}" store?
2. Profit potential — which has better margins for dropshipping?
3. Trend potential — which is more likely to sell well right now?
4. Supplier quality — which has better shipping and reviews?

Return JSON:
{
  "winner": "A" or "B",
  "confidence": 0.0-1.0,
  "reason": "1-2 sentence explanation",
  "storeFit": "A" or "B" or "tie",
  "profitability": "A" or "B" or "tie",
  "trendPotential": "A" or "B" or "tie",
  "supplierQuality": "A" or "B" or "tie"
}`;

  try {
    const result = await aiComplete<{
      winner: 'A' | 'B';
      confidence: number;
      reason: string;
      storeFit: 'A' | 'B' | 'tie';
      profitability: 'A' | 'B' | 'tie';
      trendPotential: 'A' | 'B' | 'tie';
      supplierQuality: 'A' | 'B' | 'tie';
    }>(prompt, {
      temperature: 0.2,
      maxTokens: 250,
      systemPrompt: `Product comparison analyst for a "${storeDescription}" store. Return only JSON.`,
    });

    const isA = result.winner === 'A';
    return {
      winnerId: isA ? productA.id : productB.id,
      loserId: isA ? productB.id : productA.id,
      winnerTitle: isA ? productA.title : productB.title,
      loserTitle: isA ? productB.title : productA.title,
      confidence: result.confidence || 0.5,
      reason: result.reason || 'AI comparison',
      dimensions: {
        storeFit: result.storeFit || 'tie',
        profitability: result.profitability || 'tie',
        trendPotential: result.trendPotential || 'tie',
        supplierQuality: result.supplierQuality || 'tie',
      },
    };
  } catch {
    // Fallback to score-based comparison
    const isA = productA.score >= productB.score;
    return {
      winnerId: isA ? productA.id : productB.id,
      loserId: isA ? productB.id : productA.id,
      winnerTitle: isA ? productA.title : productB.title,
      loserTitle: isA ? productB.title : productA.title,
      confidence: 0.4,
      reason: `Score-based: ${isA ? productA.title : productB.title} scored higher (${Math.max(productA.score, productB.score)} vs ${Math.min(productA.score, productB.score)})`,
      dimensions: { storeFit: 'tie', profitability: 'tie', trendPotential: 'tie', supplierQuality: 'tie' },
    };
  }
}

/**
 * Rank a list of products using tournament-style pairwise comparisons
 * More accurate than independent scoring for top-N selection
 */
export async function tournamentRank(
  products: { id: string; title: string; score: number; price: number; cost: number; orders: number; rating: number; shippingDays: number; category: string }[],
  storeDescription: string,
  topN: number = 5,
): Promise<{ ranked: typeof products; comparisons: PairwiseResult[] }> {
  if (products.length <= 1) return { ranked: products, comparisons: [] };

  const comparisons: PairwiseResult[] = [];

  // Take top candidates by score and do head-to-head
  const candidates = [...products].sort((a, b) => b.score - a.score).slice(0, Math.min(products.length, topN * 2));

  // Round-robin top candidates
  const wins = new Map<string, number>();
  candidates.forEach(p => wins.set(p.id, 0));

  for (let i = 0; i < candidates.length - 1; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (comparisons.length >= 15) break; // Cap at 15 comparisons
      const result = await compareProducts(candidates[i], candidates[j], storeDescription);
      comparisons.push(result);
      wins.set(result.winnerId, (wins.get(result.winnerId) || 0) + 1);
    }
    if (comparisons.length >= 15) break;
  }

  // Sort by wins, then by original score
  const ranked = candidates.sort((a, b) => {
    const winsA = wins.get(a.id) || 0;
    const winsB = wins.get(b.id) || 0;
    if (winsA !== winsB) return winsB - winsA;
    return b.score - a.score;
  });

  return { ranked: ranked.slice(0, topN), comparisons };
}
