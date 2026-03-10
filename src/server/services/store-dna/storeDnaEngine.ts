// ==============================================
// Store DNA Engine
// ==============================================
// Combines store description, domain analysis,
// existing catalog, and merchant settings into
// a unified store profile for scoring.

import { StoreDNA, DomainIntent } from '../../../shared/types';
import { analyzeDomainAndSave } from '../domain/domainEngine';
import { fetchShopifyProducts, fetchShopifyCollections } from '../shopify/shopifyClient';
import { aiComplete } from '../../utils/ai';
import prisma from '../../utils/db';

interface CatalogSnapshot {
  productCount: number;
  collectionCount: number;
  avgPrice: number | null;
  priceRange: { min: number; max: number } | null;
  topCategories: string[];
  titles: string[];
  tags: string[];
}

/**
 * Analyze existing Shopify catalog
 */
async function analyzeCatalog(shopDomain: string, accessToken: string): Promise<CatalogSnapshot> {
  const products = await fetchShopifyProducts(shopDomain, accessToken, 50);
  const collections = await fetchShopifyCollections(shopDomain, accessToken);

  const prices = products
    .flatMap((p) => p.variants?.map((v: any) => parseFloat(v.price)) || [])
    .filter((p) => !isNaN(p) && p > 0);

  const tags = products.flatMap((p) => (p.tags || '').split(',').map((t: string) => t.trim().toLowerCase())).filter(Boolean);
  const titles = products.map((p) => p.title);

  // Extract categories from tags and product types
  const categorySignals = [
    ...products.map((p) => p.product_type).filter(Boolean),
    ...tags,
  ];

  const categoryCounts: Record<string, number> = {};
  for (const cat of categorySignals) {
    const key = cat.toLowerCase();
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  }

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cat]) => cat);

  return {
    productCount: products.length,
    collectionCount: collections.length,
    avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    priceRange: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    topCategories,
    titles,
    tags: [...new Set(tags)].slice(0, 50),
  };
}

/**
 * Use AI to extract deeper store DNA from description + catalog
 */
async function extractDNAWithAI(
  description: string,
  audience: string[],
  catalog: CatalogSnapshot,
  domainIntent: DomainIntent
): Promise<{
  nicheKeywords: string[];
  toneAttributes: string[];
  pricePositioning: string;
  brandVibe: string;
  catalogGaps: string[];
  catalogStrengths: string[];
}> {
  const prompt = `Analyze this e-commerce store and return JSON with store DNA insights.

STORE DESCRIPTION: ${description}
TARGET AUDIENCE: ${audience.join(', ')}
DOMAIN: ${domainIntent.domain}
DOMAIN KEYWORDS: ${domainIntent.domainFitKeywords.join(', ')}
DOMAIN VIBE: ${JSON.stringify(domainIntent.vibeScore)}
CURRENT PRODUCTS (${catalog.productCount}): ${catalog.titles.slice(0, 20).join(', ')}
CURRENT TAGS: ${catalog.tags.slice(0, 30).join(', ')}
TOP CATEGORIES: ${catalog.topCategories.join(', ')}
AVG PRICE: $${catalog.avgPrice?.toFixed(2) || 'N/A'}
PRICE RANGE: ${catalog.priceRange ? `$${catalog.priceRange.min} - $${catalog.priceRange.max}` : 'N/A'}

Return JSON with:
- nicheKeywords: array of 5-10 niche keywords
- toneAttributes: array of 3-5 brand tone words (e.g., "edgy", "fun", "youthful")
- pricePositioning: one of "budget", "mid", "premium", "luxury"
- brandVibe: 1 sentence describing the brand vibe
- catalogGaps: array of 3-5 product categories missing from the store
- catalogStrengths: array of 2-4 things the store does well

Return ONLY valid JSON.`;

  return aiComplete(prompt, {
    temperature: 0.3,
    systemPrompt: 'You are an e-commerce brand strategist. Return only valid JSON.',
  });
}

// ── Main Store DNA Builder ─────────────────────

export async function buildStoreDNA(shopId: string): Promise<StoreDNA> {
  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
    include: { settings: true },
  });

  const settings = shop.settings;
  if (!settings) throw new Error('Merchant settings not found. Complete onboarding first.');

  // 1. Domain analysis
  const domain = shop.shopDomain.replace('.myshopify.com', '.com');
  const domainIntent = await analyzeDomainAndSave(shopId, domain);

  // 2. Catalog analysis
  let catalog: CatalogSnapshot;
  try {
    catalog = await analyzeCatalog(shop.shopDomain, shop.accessToken);
  } catch {
    catalog = {
      productCount: 0, collectionCount: 0, avgPrice: null,
      priceRange: null, topCategories: [], titles: [], tags: [],
    };
  }

  // 3. AI-enhanced DNA extraction
  const aiDNA = await extractDNAWithAI(
    settings.storeDescription || '',
    settings.targetAudience,
    catalog,
    domainIntent
  );

  // 4. Compose final StoreDNA
  const storeDNA: StoreDNA = {
    shopId,
    domain,
    description: settings.storeDescription || '',
    nicheKeywords: aiDNA.nicheKeywords,
    audienceSegments: settings.targetAudience,
    toneAttributes: aiDNA.toneAttributes,
    pricePositioning: aiDNA.pricePositioning as StoreDNA['pricePositioning'],
    brandVibe: aiDNA.brandVibe,
    catalogGaps: aiDNA.catalogGaps,
    catalogStrengths: aiDNA.catalogStrengths,
    topCategories: catalog.topCategories,
    avgPrice: catalog.avgPrice,
    domainIntent,
  };

  // 5. Persist to database
  await prisma.storeProfile.upsert({
    where: { shopId },
    create: {
      shopId,
      nicheKeywords: storeDNA.nicheKeywords,
      audienceSegments: storeDNA.audienceSegments,
      toneAttributes: storeDNA.toneAttributes,
      pricePositioning: storeDNA.pricePositioning,
      brandVibe: storeDNA.brandVibe,
      catalogGaps: storeDNA.catalogGaps,
      catalogStrengths: storeDNA.catalogStrengths,
      productCount: catalog.productCount,
      collectionCount: catalog.collectionCount,
      avgPrice: catalog.avgPrice,
      priceRange: catalog.priceRange,
      topCategories: catalog.topCategories,
      catalogSnapshot: catalog,
      categoryProfile: aiDNA,
    },
    update: {
      nicheKeywords: storeDNA.nicheKeywords,
      audienceSegments: storeDNA.audienceSegments,
      toneAttributes: storeDNA.toneAttributes,
      pricePositioning: storeDNA.pricePositioning,
      brandVibe: storeDNA.brandVibe,
      catalogGaps: storeDNA.catalogGaps,
      catalogStrengths: storeDNA.catalogStrengths,
      productCount: catalog.productCount,
      collectionCount: catalog.collectionCount,
      avgPrice: catalog.avgPrice,
      priceRange: catalog.priceRange,
      topCategories: catalog.topCategories,
      catalogSnapshot: catalog,
      categoryProfile: aiDNA,
      analyzedAt: new Date(),
    },
  });

  return storeDNA;
}

/**
 * Quick-load existing Store DNA from database (no re-analysis)
 */
export async function loadStoreDNA(shopId: string): Promise<StoreDNA | null> {
  const [profile, domainAnalysis, settings] = await Promise.all([
    prisma.storeProfile.findUnique({ where: { shopId } }),
    prisma.domainAnalysis.findUnique({ where: { shopId } }),
    prisma.merchantSettings.findUnique({ where: { shopId } }),
  ]);

  if (!profile || !domainAnalysis || !settings) return null;

  return {
    shopId,
    domain: domainAnalysis.domain,
    description: settings.storeDescription || '',
    nicheKeywords: profile.nicheKeywords,
    audienceSegments: profile.audienceSegments,
    toneAttributes: profile.toneAttributes,
    pricePositioning: (profile.pricePositioning as StoreDNA['pricePositioning']) || 'mid',
    brandVibe: profile.brandVibe || '',
    catalogGaps: profile.catalogGaps,
    catalogStrengths: profile.catalogStrengths,
    topCategories: profile.topCategories,
    avgPrice: profile.avgPrice,
    domainIntent: domainAnalysis.semanticAnalysis as unknown as DomainIntent,
  };
}
