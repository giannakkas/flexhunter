// ==============================================
// Product Source Provider Layer
// ==============================================
// Abstracted provider interface so we can plug in
// AliExpress, CJ, CSV feeds, or manual sources.

import { NormalizedProduct } from '../../../shared/types';

// ── Provider Interface ─────────────────────────

export interface SourceProvider {
  type: 'ALIEXPRESS' | 'CJ_DROPSHIPPING' | 'CSV_FEED' | 'MANUAL';
  name: string;

  /**
   * Search for products matching the given criteria
   */
  searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]>;

  /**
   * Get full details for a specific product
   */
  getProductDetails(productId: string): Promise<NormalizedProduct | null>;

  /**
   * Check if provider is configured and ready
   */
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

// ── AliExpress Provider (Mock for V1) ──────────

export class AliExpressProvider implements SourceProvider {
  type = 'ALIEXPRESS' as const;
  name = 'AliExpress';

  isAvailable(): boolean {
    return !!process.env.ALIEXPRESS_API_KEY;
  }

  async searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    // In V1, return mock data structured correctly
    // In production, this would call the AliExpress Affiliate/Dropship API
    console.log(`[AliExpress] Searching: ${params.keywords.join(', ')}`);

    // Mock implementation with realistic product data for FlexBucket testing
    return this.getMockProducts(params);
  }

  async getProductDetails(productId: string): Promise<NormalizedProduct | null> {
    console.log(`[AliExpress] Getting details: ${productId}`);
    return null;
  }

  private getMockProducts(params: ProviderSearchParams): NormalizedProduct[] {
    const mockCatalog: NormalizedProduct[] = [
      {
        providerType: 'ALIEXPRESS',
        providerProductId: 'ali-001',
        title: 'RGB LED Strip Lights 5M Smart WiFi Color Changing',
        description: 'Smart LED strip lights with app control, music sync, 16 million colors. Perfect for gaming room, bedroom aesthetic setup.',
        category: 'LED Lighting',
        subcategory: 'Smart Lights',
        imageUrls: ['https://placeholder.com/led-strip-1.jpg'],
        variants: [{ title: '5M', options: { length: '5M' }, price: 24.99, costPrice: 8.50 }],
        costPrice: 8.50,
        suggestedPrice: 24.99,
        currency: 'USD',
        shippingCost: 0,
        shippingDays: 12,
        shippingSpeed: 'STANDARD',
        warehouseCountry: 'CN',
        reviewCount: 15420,
        reviewRating: 4.6,
        orderVolume: 48000,
        supplierRating: 4.8,
        sourceUrl: 'https://aliexpress.com/item/mock-001',
        sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS',
        providerProductId: 'ali-002',
        title: 'Astronaut Galaxy Star Projector Night Light',
        description: 'Astronaut-shaped galaxy projector with nebula effect, adjustable head, timer. TikTok viral room decor.',
        category: 'Room Decor',
        subcategory: 'Projectors',
        imageUrls: ['https://placeholder.com/astronaut-projector.jpg'],
        variants: [{ title: 'White', options: { color: 'White' } }],
        costPrice: 12.00,
        suggestedPrice: 34.99,
        currency: 'USD',
        shippingCost: 0,
        shippingDays: 15,
        shippingSpeed: 'STANDARD',
        warehouseCountry: 'CN',
        reviewCount: 32100,
        reviewRating: 4.7,
        orderVolume: 120000,
        supplierRating: 4.9,
        sourceUrl: 'https://aliexpress.com/item/mock-002',
        sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS',
        providerProductId: 'ali-003',
        title: 'Magnetic Levitating Bluetooth Speaker Globe',
        description: 'Floating magnetic bluetooth speaker with LED lights. Futuristic desk accessory, great for content creators.',
        category: 'Tech Gadgets',
        subcategory: 'Speakers',
        imageUrls: ['https://placeholder.com/levitating-speaker.jpg'],
        variants: [{ title: 'Black', options: { color: 'Black' } }],
        costPrice: 22.00,
        suggestedPrice: 59.99,
        currency: 'USD',
        shippingCost: 2.50,
        shippingDays: 14,
        shippingSpeed: 'STANDARD',
        warehouseCountry: 'CN',
        reviewCount: 8900,
        reviewRating: 4.4,
        orderVolume: 25000,
        supplierRating: 4.6,
        sourceUrl: 'https://aliexpress.com/item/mock-003',
        sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS',
        providerProductId: 'ali-004',
        title: 'Retro Pixel Art Bluetooth LED Display Screen',
        description: '16x16 programmable pixel LED display. Show custom animations, game art, notifications. Perfect gamer desk accessory.',
        category: 'Gaming Accessories',
        subcategory: 'Desk Decor',
        imageUrls: ['https://placeholder.com/pixel-display.jpg'],
        variants: [{ title: 'Standard', options: {} }],
        costPrice: 18.00,
        suggestedPrice: 44.99,
        currency: 'USD',
        shippingCost: 0,
        shippingDays: 10,
        shippingSpeed: 'STANDARD',
        warehouseCountry: 'CN',
        reviewCount: 5600,
        reviewRating: 4.5,
        orderVolume: 18000,
        supplierRating: 4.7,
        sourceUrl: 'https://aliexpress.com/item/mock-004',
        sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS',
        providerProductId: 'ali-005',
        title: 'Cloud LED Neon Sign Wall Decor',
        description: 'Aesthetic cloud-shaped neon LED sign. USB powered, warm white light. TikTok room decor essential.',
        category: 'Room Decor',
        subcategory: 'Neon Signs',
        imageUrls: ['https://placeholder.com/cloud-neon.jpg'],
        variants: [{ title: 'Warm White', options: { color: 'Warm White' } }],
        costPrice: 6.50,
        suggestedPrice: 19.99,
        currency: 'USD',
        shippingCost: 0,
        shippingDays: 12,
        shippingSpeed: 'STANDARD',
        warehouseCountry: 'CN',
        reviewCount: 22000,
        reviewRating: 4.8,
        orderVolume: 95000,
        supplierRating: 4.9,
        sourceUrl: 'https://aliexpress.com/item/mock-005',
        sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS',
        providerProductId: 'ali-006',
        title: 'Plain White Cotton Dish Towels 12 Pack',
        description: 'Basic white cotton kitchen towels. Absorbent, machine washable.',
        category: 'Kitchen',
        subcategory: 'Towels',
        imageUrls: ['https://placeholder.com/dish-towels.jpg'],
        variants: [{ title: '12 Pack', options: {} }],
        costPrice: 4.00,
        suggestedPrice: 12.99,
        currency: 'USD',
        shippingCost: 3.00,
        shippingDays: 20,
        shippingSpeed: 'ECONOMY',
        warehouseCountry: 'CN',
        reviewCount: 800,
        reviewRating: 4.0,
        orderVolume: 3000,
        supplierRating: 4.2,
        sourceUrl: 'https://aliexpress.com/item/mock-006',
        sourceName: 'AliExpress',
      },
    ];

    // Filter by keywords loosely
    const keywords = params.keywords.map((k) => k.toLowerCase());
    return mockCatalog.filter((p) => {
      if (keywords.length === 0) return true;
      const text = `${p.title} ${p.description} ${p.category}`.toLowerCase();
      return keywords.some((kw) => text.includes(kw));
    }).slice(0, params.limit || 20);
  }
}

// ── CJ Dropshipping Provider (Mock for V1) ────

export class CJProvider implements SourceProvider {
  type = 'CJ_DROPSHIPPING' as const;
  name = 'CJ Dropshipping';

  isAvailable(): boolean {
    return !!process.env.CJ_API_KEY;
  }

  async searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    console.log(`[CJ] Searching: ${params.keywords.join(', ')}`);
    // Mock - in production calls CJ API
    return [];
  }

  async getProductDetails(productId: string): Promise<NormalizedProduct | null> {
    return null;
  }
}

// ── CSV Feed Provider ──────────────────────────

export class CsvFeedProvider implements SourceProvider {
  type = 'CSV_FEED' as const;
  name = 'CSV Feed';

  isAvailable(): boolean {
    return true; // Always available for manual uploads
  }

  async searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    // Would parse uploaded CSV and return normalized products
    return [];
  }

  async getProductDetails(productId: string): Promise<NormalizedProduct | null> {
    return null;
  }
}

// ── Manual Provider ────────────────────────────

export class ManualFeedProvider implements SourceProvider {
  type = 'MANUAL' as const;
  name = 'Manual Entry';

  isAvailable(): boolean {
    return true;
  }

  async searchProducts(_params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    return []; // Manual products are added individually
  }

  async getProductDetails(productId: string): Promise<NormalizedProduct | null> {
    return null;
  }
}

// ── Provider Registry ──────────────────────────

export class ProviderRegistry {
  private providers: Map<string, SourceProvider> = new Map();

  constructor() {
    this.register(new AliExpressProvider());
    this.register(new CJProvider());
    this.register(new CsvFeedProvider());
    this.register(new ManualFeedProvider());
  }

  register(provider: SourceProvider): void {
    this.providers.set(provider.type, provider);
  }

  get(type: string): SourceProvider | undefined {
    return this.providers.get(type);
  }

  getAvailable(): SourceProvider[] {
    return [...this.providers.values()].filter((p) => p.isAvailable());
  }

  getAll(): SourceProvider[] {
    return [...this.providers.values()];
  }

  /**
   * Search across all available providers
   */
  async searchAll(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    const available = this.getAvailable();
    const results = await Promise.allSettled(
      available.map((p) => p.searchProducts(params))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<NormalizedProduct[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value);
  }
}

// Singleton
export const providerRegistry = new ProviderRegistry();
