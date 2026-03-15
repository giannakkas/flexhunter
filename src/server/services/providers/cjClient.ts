// ==============================================
// CJ Dropshipping Live API Client
// ==============================================
// Docs: https://developers.cjdropshipping.cn/en/api/api2/api/product.html
// Auth: apiKey → accessToken (15-day TTL, refreshable)

import { NormalizedProduct } from '../../../shared/types';

const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let cachedRefreshToken: string | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 1hr buffer)
  if (cachedToken && Date.now() < tokenExpiry - 3600000) {
    return cachedToken;
  }

  // Try refresh first
  if (cachedRefreshToken) {
    try {
      const res = await fetch(`${CJ_BASE}/authentication/refreshAccessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: cachedRefreshToken }),
      });
      const data = await res.json();
      if (data.code === 200 && data.data) {
        cachedToken = data.data.accessToken;
        cachedRefreshToken = data.data.refreshToken;
        tokenExpiry = new Date(data.data.accessTokenExpiryDate).getTime();
        console.log('[CJ] Token refreshed successfully');
        return cachedToken!;
      }
    } catch (err) {
      console.warn('[CJ] Token refresh failed, getting new token');
    }
  }

  // Get new token with API key
  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) throw new Error('CJ_API_KEY not configured');

  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  const data = await res.json();

  if (data.code !== 200 || !data.data) {
    throw new Error(`CJ auth failed: ${data.message || JSON.stringify(data)}`);
  }

  cachedToken = data.data.accessToken;
  cachedRefreshToken = data.data.refreshToken;
  tokenExpiry = new Date(data.data.accessTokenExpiryDate).getTime();
  console.log(`[CJ] Authenticated, token expires: ${data.data.accessTokenExpiryDate}`);
  return cachedToken!;
}

export interface CJSearchParams {
  keyword: string;
  page?: number;
  size?: number;
  countryCode?: string;
  startSellPrice?: number;
  endSellPrice?: number;
}

export async function searchCJProducts(params: CJSearchParams): Promise<NormalizedProduct[]> {
  const token = await getAccessToken();

  const query = new URLSearchParams({
    keyWord: params.keyword,
    page: String(params.page || 1),
    size: String(params.size || 20),
  });
  if (params.countryCode) query.set('countryCode', params.countryCode);
  if (params.startSellPrice) query.set('startSellPrice', String(params.startSellPrice));
  if (params.endSellPrice) query.set('endSellPrice', String(params.endSellPrice));

  const res = await fetch(`${CJ_BASE}/product/listV2?${query}`, {
    headers: { 'CJ-Access-Token': token },
  });
  const data = await res.json();

  if (data.code !== 200 || !data.data?.content) {
    console.warn(`[CJ] Search failed: ${data.message}`);
    return [];
  }

  const products: NormalizedProduct[] = [];

  for (const group of data.data.content) {
    const list = group.productList || [];
    for (const p of list) {
      products.push({
        providerType: 'CJ_DROPSHIPPING',
        providerProductId: p.id || p.sku,
        title: p.nameEn || p.name || 'Untitled',
        description: p.description || p.nameEn || '',
        category: p.oneCategoryName || 'General',
        subcategory: p.threeCategoryName || p.twoCategoryName || '',
        imageUrls: [p.bigImage].filter(Boolean),
        variants: [],
        costPrice: parseFloat(p.sellPrice || p.nowPrice || '0'),
        suggestedPrice: parseFloat(p.sellPrice || '0') * 2.2, // 2.2x markup
        currency: 'USD',
        shippingCost: 0,
        shippingDays: p.deliveryCycle ? parseInt(p.deliveryCycle) * 24 : 10,
        shippingSpeed: 'STANDARD',
        warehouseCountry: p.countryCode || 'CN',
        reviewCount: p.listedNum || 0,
        reviewRating: 4.5, // CJ doesn't return ratings in search
        orderVolume: p.listedNum || 0,
        supplierRating: 4.7,
        sourceUrl: `https://cjdropshipping.com/product/${p.id || p.sku}`,
        sourceName: 'CJ Dropshipping',
      });
    }
  }

  console.log(`[CJ] Live search "${params.keyword}" returned ${products.length} products`);
  return products;
}
