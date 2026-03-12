// ==============================================
// Google Trends Client
// ==============================================
// Fetches interest-over-time data for product keywords.
// Uses RapidAPI Google Trends endpoint (same RAPIDAPI_KEY).

const TRENDS_HOST = 'google-trends8.p.rapidapi.com';

export interface TrendData {
  keyword: string;
  interest: number;         // 0-100 (current interest level)
  change7d: number;         // % change over 7 days
  change30d: number;        // % change over 30 days
  isRising: boolean;
  isBreakout: boolean;      // >5000% increase
  relatedQueries: string[];
  timestamp: string;
}

/**
 * Get interest over time for a keyword
 */
export async function getGoogleTrends(keyword: string): Promise<TrendData | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.warn('[GoogleTrends] No RAPIDAPI_KEY set');
    return null;
  }

  try {
    const params = new URLSearchParams({
      keyword,
      property: '',
      geo: '',
      dataSource: 'web',
    });

    const res = await fetch(`https://${TRENDS_HOST}/interestOverTime?${params}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': TRENDS_HOST,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      // If trends API isn't subscribed, fail gracefully
      if (res.status === 403 || res.status === 429) {
        console.warn(`[GoogleTrends] API returned ${res.status} for "${keyword}" — may need RapidAPI subscription`);
        return null;
      }
      return null;
    }

    const data = await res.json();

    // Parse the response — format varies by endpoint
    if (data?.interest_over_time?.timeline_data) {
      const points = data.interest_over_time.timeline_data;
      if (points.length < 2) return null;

      const recent = points.slice(-4);  // last ~4 weeks
      const older = points.slice(-8, -4); // 4-8 weeks ago

      const recentAvg = recent.reduce((s: number, p: any) => s + (parseInt(p.values?.[0]?.extracted_value) || 0), 0) / recent.length;
      const olderAvg = older.length > 0
        ? older.reduce((s: number, p: any) => s + (parseInt(p.values?.[0]?.extracted_value) || 0), 0) / older.length
        : recentAvg;

      const change30d = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
      const last2 = points.slice(-2);
      const change7d = last2.length === 2
        ? ((parseInt(last2[1]?.values?.[0]?.extracted_value) || 0) - (parseInt(last2[0]?.values?.[0]?.extracted_value) || 0)) / Math.max(parseInt(last2[0]?.values?.[0]?.extracted_value) || 1, 1) * 100
        : 0;

      return {
        keyword,
        interest: Math.round(recentAvg),
        change7d: Math.round(change7d),
        change30d: Math.round(change30d),
        isRising: change30d > 20,
        isBreakout: change30d > 200,
        relatedQueries: (data.related_queries?.rising || []).slice(0, 5).map((q: any) => q.query || q),
        timestamp: new Date().toISOString(),
      };
    }

    // Simpler response format
    if (Array.isArray(data) && data.length > 0) {
      const values = data.map((d: any) => d.value || d.interest || 0);
      const recent = values.slice(-4);
      const older = values.slice(-8, -4);
      const recentAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
      const olderAvg = older.length > 0 ? older.reduce((a: number, b: number) => a + b, 0) / older.length : recentAvg;
      const change30d = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

      return {
        keyword,
        interest: Math.round(recentAvg),
        change7d: 0,
        change30d: Math.round(change30d),
        isRising: change30d > 20,
        isBreakout: change30d > 200,
        relatedQueries: [],
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.warn(`[GoogleTrends] Timeout for "${keyword}"`);
    } else {
      console.warn(`[GoogleTrends] Error for "${keyword}":`, err.message);
    }
    return null;
  }
}

/**
 * Batch fetch trends for multiple keywords (with concurrency limit)
 */
export async function batchGoogleTrends(keywords: string[], concurrency = 3): Promise<Map<string, TrendData>> {
  const results = new Map<string, TrendData>();
  const queue = [...keywords];

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const kw = queue.shift();
      if (!kw) break;
      const data = await getGoogleTrends(kw);
      if (data) results.set(kw, data);
      // Rate limit: 200ms between requests
      await new Promise(r => setTimeout(r, 200));
    }
  });

  await Promise.all(workers);
  console.log(`[GoogleTrends] Fetched ${results.size}/${keywords.length} keywords`);
  return results;
}
