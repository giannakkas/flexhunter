// ==============================================
// Product Source Provider Layer — LIVE ONLY
// ==============================================

import { NormalizedProduct } from '../../../shared/types';
import { searchCJProducts } from './cjClient';
import { searchAliExpressProducts } from './aliexpressClient';

export interface SourceProvider {
  type: 'ALIEXPRESS' | 'CJ_DROPSHIPPING' | 'CSV_FEED' | 'MANUAL';
  name: string;
  searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]>;
  getProductDetails(productId: string): Promise<NormalizedProduct | null>;
  isAvailable(): boolean;
}

export interface ProviderSearchParams {
  keywords: string[];
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  shippingCountry?: string;
  limit?: number;
  page?: number;
}

export class ProviderRegistry {
  private providers: Map<string, SourceProvider> = new Map();

  constructor() {
    // ── LIVE providers ──
    this.register({
      type: 'ALIEXPRESS', name: 'AliExpress',
      isAvailable: () => !!process.env.RAPIDAPI_KEY,
      async searchProducts(params) {
        const results = await searchAliExpressProducts({
          keyword: params.keywords.join(' '),
          page: params.page || 1,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
        });
        return results.slice(0, params.limit || 20);
      },
      async getProductDetails() { return null; },
    });

    this.register({
      type: 'CJ_DROPSHIPPING', name: 'CJ Dropshipping',
      isAvailable: () => !!process.env.CJ_API_KEY,
      async searchProducts(params) {
        const results = await searchCJProducts({
          keyword: params.keywords.join(' '),
          page: params.page || 1,
          size: params.limit || 20,
          startSellPrice: params.minPrice,
          endSellPrice: params.maxPrice,
        });
        return results;
      },
      async getProductDetails() { return null; },
    });

    // ── Placeholder providers (no public API — show as unavailable) ──
    for (const [name, type] of [
      ['Zendrop', 'CJ_DROPSHIPPING'],
      ['Spocket', 'CJ_DROPSHIPPING'],
      ['Alibaba', 'ALIEXPRESS'],
      ['Temu Trends', 'MANUAL'],
      ['TikTok Trends', 'MANUAL'],
      ['Amazon Trends', 'MANUAL'],
    ] as [string, SourceProvider['type']][]) {
      this.register({
        type, name,
        isAvailable: () => false,
        async searchProducts() { return []; },
        async getProductDetails() { return null; },
      });
    }

    // Data feeds
    this.register({
      type: 'CSV_FEED', name: 'CSV Feed',
      isAvailable: () => true,
      async searchProducts() { return []; },
      async getProductDetails() { return null; },
    });
    this.register({
      type: 'MANUAL', name: 'Manual Entry',
      isAvailable: () => true,
      async searchProducts() { return []; },
      async getProductDetails() { return null; },
    });
  }

  register(provider: SourceProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): SourceProvider | undefined {
    return this.providers.get(name);
  }

  getAvailable(): SourceProvider[] {
    return [...this.providers.values()].filter((p) => p.isAvailable());
  }

  getAll(): SourceProvider[] {
    return [...this.providers.values()];
  }

  isLive(name: string): boolean {
    if (name === 'AliExpress') return !!process.env.RAPIDAPI_KEY;
    if (name === 'CJ Dropshipping') return !!process.env.CJ_API_KEY;
    return false;
  }

  async searchAll(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    const available = this.getAvailable();
    const results = await Promise.allSettled(
      available.map(async (p) => {
        const start = Date.now();
        try {
          const products = await p.searchProducts(params);
          try { const { trackExternalApi } = require('../../middleware/apiMetrics'); trackExternalApi(p.name, true, Date.now() - start); } catch {}
          return products;
        } catch (err: any) {
          try { const { trackExternalApi } = require('../../middleware/apiMetrics'); trackExternalApi(p.name, false, Date.now() - start, err.message); } catch {}
          throw err;
        }
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<NormalizedProduct[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value);
  }
}

export const providerRegistry = new ProviderRegistry();
