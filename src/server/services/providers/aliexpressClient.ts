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

  // Handle both response formats (wrapped in .result or direct)
  const resultList = data?.result?.resultList || data?.resultList || [];

  const products: NormalizedProduct[] = [];

  for (const entry of resultList) {
    const item = entry.item || entry;
    if (!item.title) continue;

    // Extract product ID from URL
    const urlMatch = (item.itemUrl || '').match(/item\/(\d+)/);
    const productId = urlMatch ? urlMatch[1] : `ae-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Parse price — could be string or number
    const price = parseFloat(item.promotionPrice || item.salePrice || item.price || '0');

    // Clean image URL (sometimes starts with //)
    let imageUrl = item.image || item.imgUrl || '';
    if (imageUrl.startsWith('//')) imageUrl = `https:${imageUrl}`;

    // Clean product URL
    let productUrl = item.itemUrl || '';
    if (productUrl.startsWith('//')) productUrl = `https:${productUrl}`;

    products.push({
      providerType: 'ALIEXPRESS',
      providerProductId: productId,
      title: item.title,
      description: item.title, // Search results don't include full description
      category: item.categoryName || 'General',
      subcategory: '',
      imageUrls: [imageUrl].filter(Boolean),
      variants: [],
      costPrice: price,
      suggestedPrice: Math.round(price * 2.8 * 100) / 100, // ~2.8x markup
      currency: 'USD',
      shippingCost: parseFloat(item.shippingFee || '0'),
      shippingDays: 12,
      shippingSpeed: 'STANDARD',
      warehouseCountry: 'CN',
      reviewCount: parseInt(item.totalTranpro3 || item.reviewCount || '0') || 0,
      reviewRating: parseFloat(item.averageStarRate || item.starRating || '4.5') || 4.5,
      orderVolume: parseInt(item.sales || item.totalOrders || '0') || 0,
      supplierRating: 4.6,
      sourceUrl: productUrl || `https://www.aliexpress.com/item/${productId}.html`,
      sourceName: 'AliExpress',
    });
  }

  console.log(`[AliExpress] Live search "${params.keyword}" returned ${products.length} products`);
  return products;
}
