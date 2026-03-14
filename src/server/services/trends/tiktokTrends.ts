// ==============================================
// TikTok Creative Center Trends Client
// ==============================================
// Uses tiktok-creative-center-api on RapidAPI
// Docs: https://docs.tikfly.io/api-reference/trending/

const TIKTOK_HOST = 'tiktok-creative-center-api.p.rapidapi.com';

export interface TikTokTrendData {
  keyword: string;
  viewCount: number;
  videoCount: number;
  growthRate: number;
  isHot: boolean;
  relatedHashtags: string[];
}

function headers() {
  return {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
    'x-rapidapi-host': TIKTOK_HOST,
  };
}

/**
 * Get trending hashtags related to a keyword
 */
export async function getTikTokTrends(keyword: string): Promise<TikTokTrendData | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;

  try {
    // Try trending keyword endpoint
    const res = await fetch(
      `https://${TIKTOK_HOST}/api/trending/keyword?keyword=${encodeURIComponent(keyword)}&country=us&period=120`,
      { headers: headers(), signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      console.warn(`[TikTok] Trending keyword failed: ${res.status}`);
      return tryHashtagFallback(keyword);
    }

    const data = await res.json();
    
    // Parse response
    const items = data?.data?.keyword_list || data?.data?.list || data?.data || [];
    if (Array.isArray(items) && items.length > 0) {
      const item = items[0];
      return {
        keyword,
        viewCount: item.video_view_count || item.view_count || item.publish_cnt || 0,
        videoCount: item.video_count || item.publish_cnt || 0,
        growthRate: item.trend || item.growth_rate || item.value_change_rate || 0,
        isHot: !!(item.is_hot || item.trend > 50),
        relatedHashtags: (items.slice(1, 4).map((i: any) => i.keyword || i.hashtag_name || '').filter(Boolean)),
      };
    }

    return tryHashtagFallback(keyword);
  } catch (err: any) {
    console.warn(`[TikTok] Error: ${err.message?.slice(0, 80)}`);
    return null;
  }
}

async function tryHashtagFallback(keyword: string): Promise<TikTokTrendData | null> {
  try {
    const res = await fetch(
      `https://${TIKTOK_HOST}/api/trending/hashtag?keyword=${encodeURIComponent(keyword)}&country=us&period=120`,
      { headers: headers(), signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) return null;
    const data = await res.json();
    
    const items = data?.data?.hashtag_list || data?.data?.list || data?.data || [];
    if (Array.isArray(items) && items.length > 0) {
      const item = items[0];
      return {
        keyword,
        viewCount: item.video_view_count || item.view_count || item.publish_cnt || 0,
        videoCount: item.video_count || item.publish_cnt || 0,
        growthRate: item.trend || item.growth_rate || item.value_change_rate || 0,
        isHot: !!(item.is_hot || item.trend > 50),
        relatedHashtags: items.slice(1, 4).map((i: any) => i.hashtag_name || '').filter(Boolean),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get top trending products on TikTok (GOLD for dropshipping)
 */
export async function getTikTokTopProducts(country: string = 'US'): Promise<any[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://${TIKTOK_HOST}/api/trending/top-products?country=${country}&period=7`,
      { headers: headers(), signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data?.data?.product_list || data?.data?.products || data?.data || [];
  } catch {
    return [];
  }
}

/**
 * Batch fetch trends for multiple keywords (with concurrency limit)
 */
export async function batchTikTokTrends(keywords: string[]): Promise<(TikTokTrendData | null)[]> {
  const results: (TikTokTrendData | null)[] = [];
  // Process sequentially to avoid rate limits
  for (const kw of keywords) {
    const result = await getTikTokTrends(kw);
    results.push(result);
    // Small delay between requests
    await new Promise(r => setTimeout(r, 200));
  }
  return results;
}
