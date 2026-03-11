// ==============================================
// AliExpress Live API Client (via RapidAPI DataHub)
// ==============================================
// API: aliexpress-datahub on RapidAPI
// Endpoint: GET /item_search_2?q=xxx&page=1&sort=default
// Requires: RAPIDAPI_KEY env var

import { NormalizedProduct } from '../../../shared/types';

const RAPIDAPI_HOST = 'aliexpress-datahub.p.rapidapi.com';

export interface AESearchParams {
  keyword: string;
  page?: number;
  sort?: 'default' | 'priceAsc' | 'priceDesc' | 'orders' | 'rating';
  minPrice?: number;
  maxPrice?: number;
}

export async function searchAliExpressProducts(params: AESearchParams): Promise<NormalizedProduct[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY not configured');

  const query = new URLSearchParams({
    q: params.keyword,
    page: String(params.page || 1),
    sort: params.sort || 'default',
  });
  if (params.minPrice) query.set('priceMin', String(params.minPrice));
  if (params.maxPrice) query.set('priceMax', String(params.maxPrice));

  const res = await fetch(`https://${RAPIDAPI_HOST}/item_search_2?${query}`, {
    headers: {
      'X-Rapidapi-Key': apiKey,
      'X-Rapidapi-Host': RAPIDAPI_HOST,
    },
  });

  if (!res.ok) {
    console.warn(`[AliExpress] API error: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json();

  // DEBUG: log raw response structure to diagnose price issues
  const firstEntry = data?.result?.resultList?.[0] || data?.resultList?.[0];
  if (firstEntry) {
    const item = firstEntry.item || firstEntry;
    console.log(`[AliExpress] Sample response fields:`, JSON.stringify({
      title: item.title,
      promotionPrice: item.promotionPrice,
      salePrice: item.salePrice,
      price: item.price,
      originalPrice: item.originalPrice,
      minPrice: item.minPrice,
      maxPrice: item.maxPrice,
      sales: item.sales,
      image: item.image ? 'present' : 'missing',
    }));
  }

  // Handle both response formats (wrapped in .result or direct)
  const resultList = data?.result?.resultList || data?.resultList || [];

  const products: NormalizedProduct[] = [];

  for (const entry of resultList) {
    const item = entry.item || entry;
    if (!item.title) continue;

    // Extract product ID from URL
    const urlMatch = (item.itemUrl || '').match(/item\/(\d+)/);
    const productId = urlMatch ? urlMatch[1] : `ae-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Parse price — handle all formats: number, "39.56", "US $39.56", "39.56 - 52.99"
    const rawPrice = item.promotionPrice ?? item.salePrice ?? item.price ?? item.originalPrice ?? item.minPrice ?? 0;
    let price = 0;
    if (typeof rawPrice === 'number') {
      price = rawPrice;
    } else {
      // Strip currency symbols and take first number from range
      const cleaned = String(rawPrice).replace(/[^0-9.,\-\s]/g, '').trim();
      const firstNum = cleaned.match(/[\d]+[.,]?[\d]*/);
      price = firstNum ? parseFloat(firstNum[0].replace(',', '.')) : 0;
    }

    // Skip products with no valid price
    if (price <= 0) {
      // Try alternate price fields
      price = parseFloat(item.productMinPrice || item.productMaxPrice || item.tradePrice || '0') || 0;
    }

    // Clean image URL (sometimes starts with //)
    let imageUrl = item.image || item.imgUrl || item.productImage || '';
    if (imageUrl.startsWith('//')) imageUrl = `https:${imageUrl}`;

    // Clean product URL
    let productUrl = item.itemUrl || item.productUrl || '';
    if (productUrl.startsWith('//')) productUrl = `https:${productUrl}`;

    const suggestedPrice = price > 0 ? Math.round(price * 2.8 * 100) / 100 : 0;

    products.push({
      providerType: 'ALIEXPRESS',
      providerProductId: productId,
      title: item.title,
      description: item.title,
      category: item.categoryName || item.category || 'General',
      subcategory: '',
      imageUrls: [imageUrl].filter(Boolean),
      variants: [],
      costPrice: price,
      suggestedPrice,
      currency: 'USD',
      shippingCost: parseFloat(item.shippingFee || item.logisticsPrice || '0') || 0,
      shippingDays: 12,
      shippingSpeed: 'STANDARD',
      warehouseCountry: 'CN',
      reviewCount: parseInt(item.totalTranpro3 || item.reviewCount || item.totalReviews || '0') || 0,
      reviewRating: parseFloat(item.averageStarRate || item.starRating || item.evaluateScore || '4.5') || 4.5,
      orderVolume: parseInt(item.sales || item.totalOrders || item.tradeDesc || '0') || 0,
      supplierRating: 4.6,
      sourceUrl: productUrl || `https://www.aliexpress.com/item/${productId}.html`,
      sourceName: 'AliExpress',
    });
  }

  console.log(`[AliExpress] Live search "${params.keyword}" returned ${products.length} products`);
  return products;
}
