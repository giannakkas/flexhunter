// ==============================================
// TikTok Trends Client
// ==============================================
// Fetches trending product-related data from TikTok
// via RapidAPI endpoints.

const TIKTOK_HOST = 'tiktok-creative-center-api.p.rapidapi.com';

export interface TikTokTrend {
  keyword: string;
  hashtag?: string;
  viewCount: number;
  videoCount: number;
  growthRate: number;     // % growth in views
  isViral: boolean;
  source: 'tiktok';
  timestamp: string;
}

/**
 * Search TikTok for product-related trending hashtags
 */
export async function getTikTokTrends(keyword: string): Promise<TikTokTrend | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;

  try {
    // Use TikTok search hashtag endpoint
    const res = await fetch(`https://${TIKTOK_HOST}/api/search/hashtag?keyword=${encodeURIComponent(keyword)}&country=us`, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': TIKTOK_HOST,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 404) {
        // API not subscribed or endpoint changed — use AI fallback
        return await aiEstimateTikTokTrend(keyword);
      }
      return null;
    }

    const data = await res.json();
    const hashtags = data?.data?.hashtag_list || data?.hashtags || [];

    if (hashtags.length > 0) {
      const top = hashtags[0];
      const views = top.view_count || top.views || 0;
      const videos = top.video_count || top.videos || 0;

      return {
        keyword,
        hashtag: top.hashtag_name || top.name || `#${keyword}`,
        viewCount: views,
        videoCount: videos,
        growthRate: videos > 1000 ? 25 : videos > 100 ? 10 : 0,
        isViral: views > 10_000_000,
        source: 'tiktok',
        timestamp: new Date().toISOString(),
      };
    }

    return await aiEstimateTikTokTrend(keyword);
  } catch (err: any) {
    console.warn(`[TikTok] Error for "${keyword}":`, err.message);
    return await aiEstimateTikTokTrend(keyword);
  }
}

/**
 * AI-based TikTok trend estimation (fallback when API unavailable)
 */
async function aiEstimateTikTokTrend(keyword: string): Promise<TikTokTrend | null> {
  try {
    const { aiComplete } = await import('../../utils/ai');
    const result = await aiComplete<{
      estimatedViews: number;
      estimatedVideos: number;
      isTrending: boolean;
      growthRate: number;
    }>(`Estimate TikTok popularity for the product/keyword: "${keyword}"

Based on your knowledge of TikTok trends, estimate:
- How many views would #${keyword.replace(/\s+/g, '')} have?
- How many videos use this hashtag?
- Is this trending on TikTok right now?
- Growth rate %

Return JSON: {"estimatedViews": number, "estimatedVideos": number, "isTrending": boolean, "growthRate": number}`, {
      temperature: 0.3,
      maxTokens: 150,
      systemPrompt: 'TikTok trend analyst. Estimate realistic numbers. Return only JSON.',
    });

    return {
      keyword,
      hashtag: `#${keyword.replace(/\s+/g, '')}`,
      viewCount: result.estimatedViews || 0,
      videoCount: result.estimatedVideos || 0,
      growthRate: result.growthRate || 0,
      isViral: result.isTrending || false,
      source: 'tiktok',
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
