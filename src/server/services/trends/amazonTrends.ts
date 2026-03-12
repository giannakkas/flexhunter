// ==============================================
// Amazon Movers & Shakers / BSR Client
// ==============================================
// Fetches Amazon trending product data via RapidAPI.

const AMAZON_HOST = 'real-time-amazon-data.p.rapidapi.com';

export interface AmazonTrend {
  keyword: string;
  productCount: number;
  avgPrice: number;
  avgRating: number;
  topProducts: { title: string; price: number; rating: number; bsr?: number }[];
  demandSignal: 'high' | 'medium' | 'low';
  source: 'amazon';
  timestamp: string;
}

/**
 * Search Amazon to gauge demand for a product keyword
 */
export async function getAmazonTrends(keyword: string): Promise<AmazonTrend | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      query: keyword,
      page: '1',
      country: 'US',
    });

    const res = await fetch(`https://${AMAZON_HOST}/search?${params}`, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': AMAZON_HOST,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        console.warn(`[Amazon] API returned ${res.status} for "${keyword}"`);
        return await aiEstimateAmazonDemand(keyword);
      }
      return null;
    }

    const data = await res.json();
    const products = data?.data?.products || data?.products || [];

    if (products.length === 0) {
      return await aiEstimateAmazonDemand(keyword);
    }

    const prices = products.map((p: any) => parseFloat(p.product_price?.replace(/[^0-9.]/g, '') || '0')).filter((p: number) => p > 0);
    const ratings = products.map((p: any) => parseFloat(p.product_star_rating || '0')).filter((r: number) => r > 0);

    const avgPrice = prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0;
    const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;

    return {
      keyword,
      productCount: products.length,
      avgPrice: Math.round(avgPrice * 100) / 100,
      avgRating: Math.round(avgRating * 10) / 10,
      topProducts: products.slice(0, 3).map((p: any) => ({
        title: p.product_title?.slice(0, 80) || 'Unknown',
        price: parseFloat(p.product_price?.replace(/[^0-9.]/g, '') || '0'),
        rating: parseFloat(p.product_star_rating || '0'),
      })),
      demandSignal: products.length >= 15 ? 'high' : products.length >= 5 ? 'medium' : 'low',
      source: 'amazon',
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn(`[Amazon] Error for "${keyword}":`, err.message);
    return await aiEstimateAmazonDemand(keyword);
  }
}

/**
 * AI fallback for Amazon demand estimation
 */
async function aiEstimateAmazonDemand(keyword: string): Promise<AmazonTrend | null> {
  try {
    const { aiComplete } = await import('../../utils/ai');
    const result = await aiComplete<{
      demandLevel: string;
      estimatedProducts: number;
      estimatedAvgPrice: number;
    }>(`Estimate Amazon marketplace demand for: "${keyword}"
Is this a product with high, medium, or low demand on Amazon?
Return JSON: {"demandLevel": "high"|"medium"|"low", "estimatedProducts": number, "estimatedAvgPrice": number}`, {
      temperature: 0.2,
      maxTokens: 100,
      systemPrompt: 'Amazon market analyst. Return only JSON.',
    });

    return {
      keyword,
      productCount: result.estimatedProducts || 0,
      avgPrice: result.estimatedAvgPrice || 0,
      avgRating: 4.0,
      topProducts: [],
      demandSignal: (result.demandLevel as any) || 'medium',
      source: 'amazon',
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
