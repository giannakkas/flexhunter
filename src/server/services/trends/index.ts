// ==============================================
// Trend Aggregator
// ==============================================
// Combines Google Trends, TikTok, and Amazon data
// into a unified trend signal for each keyword.

import { getGoogleTrends, TrendData } from './googleTrends';
import { getTikTokTrends, TikTokTrend } from './tiktokTrends';
import { getAmazonTrends, AmazonTrend } from './amazonTrends';

export interface AggregatedTrend {
  keyword: string;
  overallScore: number;      // 0-100
  trendDirection: 'surging' | 'rising' | 'stable' | 'declining' | 'unknown';
  google: TrendData | null;
  tiktok: TikTokTrend | null;
  amazon: AmazonTrend | null;
  signals: string[];
  confidence: number;
}

/**
 * Aggregate trend data from all available sources for a keyword
 */
export async function aggregateTrend(keyword: string): Promise<AggregatedTrend> {
  // Fetch all sources in parallel
  const [google, tiktok, amazon] = await Promise.all([
    getGoogleTrends(keyword).catch(() => null),
    getTikTokTrends(keyword).catch(() => null),
    getAmazonTrends(keyword).catch(() => null),
  ]);

  let score = 40; // baseline
  const signals: string[] = [];
  let sourcesResponded = 0;

  // ── Google Trends signals ────────
  if (google) {
    sourcesResponded++;
    if (google.isBreakout) {
      score += 30;
      signals.push(`🔥 Google: BREAKOUT trend (+${google.change30d}% in 30d)`);
    } else if (google.isRising) {
      score += 20;
      signals.push(`📈 Google: Rising interest (+${google.change30d}% in 30d)`);
    } else if (google.interest > 60) {
      score += 10;
      signals.push(`📊 Google: Strong interest (${google.interest}/100)`);
    } else if (google.interest > 30) {
      score += 5;
      signals.push(`📊 Google: Moderate interest (${google.interest}/100)`);
    } else {
      signals.push(`📉 Google: Low interest (${google.interest}/100)`);
    }

    if (google.change7d > 30) {
      score += 10;
      signals.push(`⚡ Google: +${google.change7d}% this week`);
    }
  }

  // ── TikTok signals ────────
  if (tiktok) {
    sourcesResponded++;
    if (tiktok.isViral) {
      score += 25;
      signals.push(`🔥 TikTok: VIRAL — ${formatNumber(tiktok.viewCount)} views`);
    } else if (tiktok.viewCount > 1_000_000) {
      score += 15;
      signals.push(`📱 TikTok: ${formatNumber(tiktok.viewCount)} views, ${formatNumber(tiktok.videoCount)} videos`);
    } else if (tiktok.viewCount > 100_000) {
      score += 8;
      signals.push(`📱 TikTok: ${formatNumber(tiktok.viewCount)} views`);
    } else if (tiktok.videoCount > 100) {
      score += 5;
      signals.push(`📱 TikTok: Growing presence (${tiktok.videoCount} videos)`);
    }

    if (tiktok.growthRate > 50) {
      score += 10;
      signals.push(`🚀 TikTok: +${tiktok.growthRate}% growth`);
    }
  }

  // ── Amazon signals ────────
  if (amazon) {
    sourcesResponded++;
    if (amazon.demandSignal === 'high') {
      score += 15;
      signals.push(`🛒 Amazon: High demand (${amazon.productCount}+ listings, avg $${amazon.avgPrice})`);
    } else if (amazon.demandSignal === 'medium') {
      score += 8;
      signals.push(`🛒 Amazon: Moderate demand (${amazon.productCount} listings)`);
    } else {
      signals.push(`🛒 Amazon: Low demand`);
    }

    if (amazon.avgRating >= 4.5) {
      score += 5;
      signals.push(`⭐ Amazon: ${amazon.avgRating}★ avg rating — customers love it`);
    }
  }

  // No sources responded — very low confidence
  if (sourcesResponded === 0) {
    signals.push('⚠️ No external trend data available');
  }

  score = Math.min(100, Math.max(0, score));

  // Determine direction
  let trendDirection: AggregatedTrend['trendDirection'] = 'unknown';
  if (google?.isBreakout || (tiktok?.isViral && google?.isRising)) trendDirection = 'surging';
  else if (google?.isRising || (tiktok?.growthRate || 0) > 30) trendDirection = 'rising';
  else if (google && google.change30d < -20) trendDirection = 'declining';
  else if (sourcesResponded > 0) trendDirection = 'stable';

  return {
    keyword,
    overallScore: score,
    trendDirection,
    google,
    tiktok,
    amazon,
    signals,
    confidence: sourcesResponded / 3,
  };
}

/**
 * Get aggregated trends for multiple keywords
 */
export async function batchAggregateTrends(keywords: string[]): Promise<AggregatedTrend[]> {
  // Process 3 at a time to respect rate limits
  const results: AggregatedTrend[] = [];
  for (let i = 0; i < keywords.length; i += 3) {
    const batch = keywords.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map(kw => aggregateTrend(kw)));
    results.push(...batchResults);
  }

  console.log(`[TrendAggregator] Processed ${results.length} keywords, avg score: ${Math.round(results.reduce((s, r) => s + r.overallScore, 0) / results.length)}`);
  return results;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}
