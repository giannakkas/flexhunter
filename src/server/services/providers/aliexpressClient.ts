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
    // Log ALL fields to find where prices live
    const allKeys = Object.keys(item).join(', ');
    console.log(`[AliExpress] Item fields: ${allKeys}`);
    console.log(`[AliExpress] Sample price fields:`, JSON.stringify({
      promotionPrice: item.promotionPrice, salePrice: item.salePrice,
      price: item.price, originalPrice: item.originalPrice,
      minPrice: item.minPrice, min_price: item.min_price,
      sku: item.sku?.def, prices: item.prices, trade: item.trade,
      target_sale_price: item.target_sale_price,
      app_sale_price: item.app_sale_price,
      formattedPrice: item.formattedPrice,
    }).slice(0, 500));
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

    // Parse price — handle ALL possible formats from AliExpress API
    const rawPrice = item.promotionPrice ?? item.salePrice ?? item.price ?? item.originalPrice
      ?? item.minPrice ?? item.min_price ?? item.productMinPrice
      ?? item.sku?.def?.price ?? item.sku?.def?.promotionPrice
      ?? item.prices?.salePrice ?? item.prices?.originalPrice
      ?? item.trade?.tradePrice ?? item.target_sale_price ?? item.target_original_price
      ?? item.app_sale_price ?? item.original_price ?? item.product_small_image_urls
      ?? 0;
    let price = 0;
    if (typeof rawPrice === 'number') {
      price = rawPrice;
    } else {
      // Strip currency symbols and take first number from range
      const cleaned = String(rawPrice).replace(/[^0-9.,\-\s]/g, '').trim();
      const firstNum = cleaned.match(/[\d]+[.,]?[\d]*/);
      price = firstNum ? parseFloat(firstNum[0].replace(',', '.')) : 0;
    }

    // Skip products with no valid price — try even more fields
    if (price <= 0) {
      price = parseFloat(item.productMinPrice || item.productMaxPrice || item.tradePrice
        || item.formattedPrice || item.priceStr || '0') || 0;
    }
    // Last resort: check if price is in a formatted string like "US $12.99"
    if (price <= 0 && item.trade?.tradeDesc) {
      const m = String(item.trade.tradeDesc).match(/[\d]+[.,][\d]+/);
      if (m) price = parseFloat(m[0].replace(',', '.'));
    }

    // Log if still 0 (helps debug)
    if (price <= 0) {
      console.warn(`[AliExpress] $0 price for "${item.title?.slice(0, 40)}" — raw fields:`, JSON.stringify({
        promotionPrice: item.promotionPrice, salePrice: item.salePrice, price: item.price,
        originalPrice: item.originalPrice, minPrice: item.minPrice, sku: item.sku?.def,
        target_sale_price: item.target_sale_price, app_sale_price: item.app_sale_price,
      }).slice(0, 300));
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
