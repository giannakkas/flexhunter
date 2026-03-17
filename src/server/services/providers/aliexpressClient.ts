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

  // Log first item's price for verification
  const firstEntry = data?.result?.resultList?.[0] || data?.resultList?.[0];
  if (firstEntry) {
    const item = firstEntry.item || firstEntry;
    console.log(`[AliExpress] First item: "$${item.sku?.def?.promotionPrice}" — "${item.title?.slice(0, 40)}"`);
  }

  // Handle both response formats (wrapped in .result or direct)
  const resultList = data?.result?.resultList || data?.resultList || [];

  const products: NormalizedProduct[] = [];

  for (const entry of resultList) {
    const item = entry.item || entry;
    if (!item.title) continue;

    // Product ID — directly from itemId field (confirmed in API response)
    const productId = item.itemId || (() => {
      const urlMatch = (item.itemUrl || '').match(/item\/(\d+)/);
      return urlMatch ? urlMatch[1] : `ae-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    })();

    // Parse price — CONFIRMED structure: item.sku.def.promotionPrice or item.sku.def.price
    let price = 0;
    
    // Primary: sku.def.promotionPrice (most common)
    if (item.sku?.def?.promotionPrice) {
      price = parseFloat(item.sku.def.promotionPrice);
    } else if (item.sku?.def?.price) {
      price = parseFloat(item.sku.def.price);
    }
    
    // Fallbacks for other API versions
    if (price <= 0) {
      const rawPrice = item.promotionPrice ?? item.salePrice ?? item.price ?? item.originalPrice
        ?? item.minPrice ?? item.target_sale_price ?? item.app_sale_price ?? 0;
      if (typeof rawPrice === 'number' && rawPrice > 0) {
        price = rawPrice;
      } else if (rawPrice) {
        const cleaned = String(rawPrice).replace(/[^0-9.,]/g, '').trim();
        const firstNum = cleaned.match(/[\d]+[.,]?[\d]*/);
        price = firstNum ? parseFloat(firstNum[0].replace(',', '.')) : 0;
      }
    }

    // Clean image URL (sometimes starts with //)
    let imageUrl = item.image || item.imgUrl || item.productImage || '';
    if (imageUrl.startsWith('//')) imageUrl = `https:${imageUrl}`;

    // Clean product URL
    let productUrl = item.itemUrl || item.productUrl || '';
    if (productUrl.startsWith('//')) productUrl = `https:${productUrl}`;

    // Dynamic markup based on cost tier (realistic dropshipping margins)
    // Low-cost items can sustain higher markups, expensive items need lower
    let markup = 2.5;
    if (price > 50) markup = 1.8;
    else if (price > 30) markup = 2.0;
    else if (price > 15) markup = 2.3;
    else if (price > 5) markup = 2.8;
    else if (price > 0) markup = 3.5; // Very cheap items need high markup to cover ad spend
    const suggestedPrice = price > 0 ? Math.round(price * markup * 100) / 100 : 0;

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
      reviewRating: parseFloat(item.averageStarRate ?? item.starRating ?? item.evaluateScore ?? '0') || 0,
      orderVolume: Number(item.sales ?? item.totalOrders ?? 0) || 0,
      supplierRating: 4.6,
      sourceUrl: productUrl || `https://www.aliexpress.com/item/${productId}.html`,
      sourceName: 'AliExpress',
    });
  }

  console.log(`[AliExpress] Live search "${params.keyword}" returned ${products.length} products`);
  return products;
}
