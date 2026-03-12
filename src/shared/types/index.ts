// ==============================================
// FlexHunter - Shared Types
// ==============================================

// ── Store DNA ──────────────────────────────────

export interface StoreDNA {
  shopId: string;
  domain: string;
  description: string;
  nicheKeywords: string[];
  audienceSegments: string[];
  toneAttributes: string[];
  pricePositioning: 'budget' | 'mid' | 'premium' | 'luxury';
  brandVibe: string;
  catalogGaps: string[];
  catalogStrengths: string[];
  topCategories: string[];
  avgPrice: number | null;
  domainIntent: DomainIntent;
}

export interface DomainIntent {
  domain: string;
  extractedWords: string[];
  detectedSlang: string[];
  inferredTone: string[];
  inferredAgeGroup: string | null;
  psychographicHints: string[];
  categoryBias: string[];
  domainFitKeywords: string[];
  vibeScore: {
    youthful: number;
    premium: number;
    playful: number;
    technical: number;
    lifestyle: number;
    social: number;
  };
}

// ── Scoring ────────────────────────────────────

export interface ScoreWeights {
  domainFit: number;
  storeFit: number;
  audienceFit: number;
  trendFit: number;
  visualVirality: number;
  novelty: number;
  priceFit: number;
  marginFit: number;
  shippingFit: number;
  saturationInverse: number;
  refundRiskInverse: number;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  domainFit: 0.12,
  storeFit: 0.12,
  audienceFit: 0.14,
  trendFit: 0.12,
  visualVirality: 0.10,
  novelty: 0.06,
  priceFit: 0.08,
  marginFit: 0.10,
  shippingFit: 0.06,
  saturationInverse: 0.05,
  refundRiskInverse: 0.05,
};

export interface ProductScoreBreakdown {
  domainFit: number;
  storeFit: number;
  audienceFit: number;
  trendFit: number;
  visualVirality: number;
  novelty: number;
  priceFit: number;
  marginFit: number;
  shippingFit: number;
  saturationInverse: number;
  refundRiskInverse: number;
  finalScore: number;
  confidence: number;
  explanation: string;
  fitReasons: string[];
  concerns: string[];
}

// ── Product Source ──────────────────────────────

export interface NormalizedProduct {
  providerType: 'ALIEXPRESS' | 'CJ_DROPSHIPPING' | 'CSV_FEED' | 'MANUAL';
  providerProductId: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  imageUrls: string[];
  variants: ProductVariant[];
  costPrice: number;
  suggestedPrice?: number;
  currency: string;
  shippingCost?: number;
  shippingDays?: number;
  shippingSpeed: 'EXPRESS' | 'STANDARD' | 'ECONOMY' | 'UNKNOWN';
  warehouseCountry?: string;
  reviewCount?: number;
  reviewRating?: number;
  orderVolume?: number;
  supplierRating?: number;
  sourceUrl?: string;
  sourceName?: string;
  rawData?: Record<string, unknown>;
}

export interface ProductVariant {
  title: string;
  sku?: string;
  price?: number;
  costPrice?: number;
  inventory?: number;
  options: Record<string, string>;
}

// ── Research Pipeline ──────────────────────────

export interface ResearchContext {
  shopId: string;
  storeDNA: StoreDNA;
  settings: MerchantSettingsData;
  batchId: string;
}

export interface MerchantSettingsData {
  storeDescription: string | null;
  targetAudience: string[];
  targetCountries: string[];
  preferredCategories: string[];
  bannedCategories: string[];
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  minimumMarginPercent: number;
  desiredShippingSpeed: string;
  replacementMode: string;
  maxCandidatesPerRun: number;
}

// ── Performance ────────────────────────────────

export interface PerformanceMetrics {
  views: number;
  addToCarts: number;
  checkoutsStarted: number;
  conversions: number;
  revenue: number;
  costOfGoods: number;
  margin: number;
  refunds: number;
  refundAmount: number;
  conversionRate: number;
  revenuePerView: number;
  marginPercent: number;
  healthScore: number;
  daysSinceLaunch: number;
}

// ── Replacement ────────────────────────────────

export interface ReplacementSuggestion {
  currentProductId: string;
  replacementCandidateId: string;
  confidence: number;
  reason: string;
  fitExplanation: string;
  currentMetrics: PerformanceMetrics;
}

// ── API Responses ──────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// ── Dashboard Stats ────────────────────────────

export interface DashboardStats {
  totalCandidates: number;
  totalImported: number;
  totalTesting: number;
  totalWinners: number;
  totalWeak: number;
  pendingReplacements: number;
  totalRevenue: number;
  avgHealthScore: number;
  lastResearchAt: string | null;
  lastSyncAt: string | null;
}

// ── Agent Results ─────────────────────────────

export interface AgentResult {
  score: number;
  confidence: number;
  reasoning: string;
  signals: string[];
}

export interface ViralPrediction {
  viralScore: number;
  trendStage: 'early_acceleration' | 'breakout_candidate' | 'rising_trend' | 'stable_trend' | 'saturated' | 'declining';
  velocity7d: number;
  accelerationRate: number;
  confidence: number;
  signals: string[];
  explanation: string;
}

export interface MultiAgentScore {
  storeFit: AgentResult;
  profitability: AgentResult;
  trendPotential: AgentResult;
  viralPrediction: ViralPrediction;
  saturation: AgentResult;
  supplierQuality: AgentResult;
  finalScore: number;
  recommendation: 'strong_buy' | 'buy' | 'maybe' | 'skip' | 'avoid';
  explanation: string;
}

// ── Product Signals (Feature Store) ───────────

export interface ProductSignals {
  productId: string;
  shopId: string;
  trendVelocity: number;
  trendStage: string;
  viralScore: number;
  googleTrendInterest: number;
  tiktokViews: number;
  amazonDemand: number;
  supplierRating: number;
  shippingDays: number;
  shippingScore: number;
  warehouseCountry: string;
  hasExpressShipping: boolean;
  costPrice: number;
  suggestedPrice: number;
  marginPercent: number;
  marginScore: number;
  profitPerUnit: number;
  priceInSweetSpot: boolean;
  saturationScore: number;
  sellerCount: number;
  adSaturation: number;
  storeFitScore: number;
  domainFitScore: number;
  audienceFitScore: number;
  priceBandFit: boolean;
  reviewRating: number;
  reviewCount: number;
  orderVolume: number;
  evidenceCompleteness: number;
  signalCount: number;
  computedAt: string;
}

// ── Pairwise Ranking ──────────────────────────

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

// ── Notifications ─────────────────────────────

export interface Notification {
  id: string;
  shopId: string;
  type: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  message: string;
  action?: { label: string; url: string };
  read: boolean;
  createdAt: string;
}

// ── Trend Data ────────────────────────────────

export interface TrendData {
  keyword: string;
  interest: number;
  change7d: number;
  change30d: number;
  isRising: boolean;
  isBreakout: boolean;
  relatedQueries: string[];
}

export interface AggregatedTrend {
  keyword: string;
  overallScore: number;
  trendDirection: 'surging' | 'rising' | 'stable' | 'declining' | 'unknown';
  signals: string[];
  confidence: number;
}

// ── Scoring Trace ─────────────────────────────

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

// ── Billing ───────────────────────────────────

export interface Plan {
  name: string;
  price: number;
  researches: number;
  imports: number;
}

export type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise';

// ── SEO ───────────────────────────────────────

export interface SeoOptimizationResult {
  originalTitle: string;
  optimizedTitle: string;
  originalDescription: string;
  optimizedDescription: string;
  metaTitle: string;
  metaDescription: string;
  suggestedKeywords: string[];
  suggestedHandle: string;
  altTextSuggestions: string[];
  suggestedTags: string[];
  confidence: number;
}
