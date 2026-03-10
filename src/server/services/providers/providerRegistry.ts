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
    return true; // Always available - uses mock data in V1, real API later
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
    // V1: Curated trending products with real data points
    // These represent real product archetypes found on AliExpress/CJ
    const mockCatalog: NormalizedProduct[] = [
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ae-10001',
        title: 'LED Galaxy Projector Astronaut Night Light',
        description: 'Astronaut-shaped galaxy star projector with nebula effect. 360° adjustable head, timer function, remote control. Perfect for bedroom, gaming room, TikTok content creation.',
        category: 'Room Decor', subcategory: 'Projectors',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S5e9f3b6fa8c04b5b80c8d3f13d1f3a1dZ.jpg'],
        variants: [{ title: 'White', options: { color: 'White' } }, { title: 'Black', options: { color: 'Black' } }],
        costPrice: 11.50, suggestedPrice: 34.99, currency: 'USD',
        shippingCost: 0, shippingDays: 12, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 42500, reviewRating: 4.7, orderVolume: 185000, supplierRating: 4.9,
        sourceUrl: 'https://www.aliexpress.com/item/1005006123456.html', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ae-10002',
        title: 'Smart Sunset Lamp Rainbow Projector',
        description: 'USB sunset projection lamp with 180° rotation. Creates viral golden hour lighting for TikTok photos. Multiple color modes including rainbow, sunset, and sun.',
        category: 'Room Decor', subcategory: 'Lighting',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S7c3a6d2e44b84f5c8e3b0d5a2f4c8e3aQ.jpg'],
        variants: [{ title: 'Sunset', options: { mode: 'Sunset' } }, { title: 'Rainbow', options: { mode: 'Rainbow' } }],
        costPrice: 7.20, suggestedPrice: 22.99, currency: 'USD',
        shippingCost: 0, shippingDays: 14, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 31000, reviewRating: 4.6, orderVolume: 145000, supplierRating: 4.8,
        sourceUrl: 'https://www.aliexpress.com/item/1005006234567.html', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ae-10003',
        title: 'RGB Gaming Desk Mat XXL Mouse Pad LED',
        description: 'Extra large RGB gaming desk mat 800x300mm with 14 lighting modes. Smooth micro-texture surface for precise mouse control. Non-slip rubber base.',
        category: 'Gaming', subcategory: 'Desk Accessories',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sf3d2a1b4c5e64a7b9c0d1e2f3a4b5c6dH.jpg'],
        variants: [{ title: '800x300', options: { size: '800x300mm' } }],
        costPrice: 8.90, suggestedPrice: 29.99, currency: 'USD',
        shippingCost: 0, shippingDays: 15, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 19800, reviewRating: 4.5, orderVolume: 78000, supplierRating: 4.7,
        sourceUrl: 'https://www.aliexpress.com/item/1005006345678.html', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ae-10004',
        title: 'Portable Mini Projector 1080P WiFi Bluetooth',
        description: 'Compact HD mini projector with native 1080P, WiFi screen mirroring, Bluetooth speakers. Perfect for movie nights, gaming, outdoor cinema.',
        category: 'Electronics', subcategory: 'Projectors',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3bL.jpg'],
        variants: [{ title: 'White', options: { color: 'White' } }],
        costPrice: 38.00, suggestedPrice: 89.99, currency: 'USD',
        shippingCost: 0, shippingDays: 10, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 15600, reviewRating: 4.3, orderVolume: 52000, supplierRating: 4.6,
        sourceUrl: 'https://www.aliexpress.com/item/1005006456789.html', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ae-10005',
        title: 'Cloud Neon LED Sign Wall Art USB',
        description: 'Aesthetic cloud-shaped LED neon sign. USB powered with switch. Warm white glow perfect for bedroom, living room, or content creator setup.',
        category: 'Room Decor', subcategory: 'Neon Signs',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6dN.jpg'],
        variants: [{ title: 'Warm White', options: { color: 'Warm' } }],
        costPrice: 6.80, suggestedPrice: 19.99, currency: 'USD',
        shippingCost: 0, shippingDays: 13, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 25400, reviewRating: 4.8, orderVolume: 112000, supplierRating: 4.9,
        sourceUrl: 'https://www.aliexpress.com/item/1005006567890.html', sourceName: 'AliExpress',
      },
      {
        providerType: 'CJ_DROPSHIPPING', providerProductId: 'cj-20001',
        title: 'Magnetic Levitation Floating Speaker Bluetooth',
        description: 'Wireless magnetic floating Bluetooth speaker with LED lights. 360° surround sound, NFC pairing. Unique desk accessory for tech lovers.',
        category: 'Electronics', subcategory: 'Speakers',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4cM.jpg'],
        variants: [{ title: 'Black', options: { color: 'Black' } }],
        costPrice: 22.50, suggestedPrice: 59.99, currency: 'USD',
        shippingCost: 2.50, shippingDays: 8, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
        reviewCount: 8700, reviewRating: 4.4, orderVolume: 28000, supplierRating: 4.6,
        sourceUrl: 'https://cjdropshipping.com/product/mock-20001', sourceName: 'CJ Dropshipping',
      },
      {
        providerType: 'CJ_DROPSHIPPING', providerProductId: 'cj-20002',
        title: 'Smart Ring Light 10" with Tripod Phone Mount',
        description: '10 inch LED ring light with extendable tripod, phone holder, 3 color modes, 10 brightness levels. Essential for TikTok, YouTube, Instagram creators.',
        category: 'Creator Tools', subcategory: 'Lighting',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6dP.jpg'],
        variants: [{ title: '10 inch', options: { size: '10"' } }],
        costPrice: 10.50, suggestedPrice: 29.99, currency: 'USD',
        shippingCost: 0, shippingDays: 7, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
        reviewCount: 38000, reviewRating: 4.6, orderVolume: 165000, supplierRating: 4.8,
        sourceUrl: 'https://cjdropshipping.com/product/mock-20002', sourceName: 'CJ Dropshipping',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ae-10006',
        title: '60% Mechanical Gaming Keyboard RGB Hot-Swap',
        description: 'Compact 60% mechanical keyboard with RGB backlighting, hot-swappable switches, PBT keycaps. USB-C connection. Available in multiple switch types.',
        category: 'Gaming', subcategory: 'Keyboards',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9aK.jpg'],
        variants: [{ title: 'Red Switch', options: { switch: 'Red' } }, { title: 'Blue Switch', options: { switch: 'Blue' } }],
        costPrice: 24.00, suggestedPrice: 64.99, currency: 'USD',
        shippingCost: 0, shippingDays: 11, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 12300, reviewRating: 4.5, orderVolume: 45000, supplierRating: 4.7,
        sourceUrl: 'https://www.aliexpress.com/item/1005006678901.html', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ae-10007',
        title: 'Qi Wireless Charger Pad with Ambient Light Clock',
        description: 'Multi-function wireless charging pad with LED ambient light and digital alarm clock. Compatible with iPhone, Samsung, AirPods. Clean desk aesthetic.',
        category: 'Electronics', subcategory: 'Chargers',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0bJ.jpg'],
        variants: [{ title: 'Black', options: { color: 'Black' } }, { title: 'White', options: { color: 'White' } }],
        costPrice: 13.50, suggestedPrice: 36.99, currency: 'USD',
        shippingCost: 0, shippingDays: 12, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 9200, reviewRating: 4.4, orderVolume: 34000, supplierRating: 4.6,
        sourceUrl: 'https://www.aliexpress.com/item/1005006789012.html', sourceName: 'AliExpress',
      },
      {
        providerType: 'CJ_DROPSHIPPING', providerProductId: 'cj-20003',
        title: 'Retro Pixel Art LED Display Programmable',
        description: '16x16 LED pixel display with app control. Create custom animations, game art, text, clocks. Perfect gamer desk decor and gift.',
        category: 'Gaming', subcategory: 'Desk Decor',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1cI.jpg'],
        variants: [{ title: 'Standard', options: {} }],
        costPrice: 18.00, suggestedPrice: 44.99, currency: 'USD',
        shippingCost: 0, shippingDays: 6, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
        reviewCount: 6800, reviewRating: 4.5, orderVolume: 22000, supplierRating: 4.7,
        sourceUrl: 'https://cjdropshipping.com/product/mock-20003', sourceName: 'CJ Dropshipping',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ae-10008',
        title: 'Desktop Cable Management Clip Holder Silicone',
        description: 'Minimalist silicone cable organizer clips. Self-adhesive, holds USB-C, Lightning, HDMI cables. Set of 5 in neutral colors.',
        category: 'Desk Setup', subcategory: 'Organization',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2dG.jpg'],
        variants: [{ title: '5 Pack', options: {} }],
        costPrice: 2.30, suggestedPrice: 12.99, currency: 'USD',
        shippingCost: 1.00, shippingDays: 18, shippingSpeed: 'ECONOMY', warehouseCountry: 'CN',
        reviewCount: 41000, reviewRating: 4.8, orderVolume: 230000, supplierRating: 4.9,
        sourceUrl: 'https://www.aliexpress.com/item/1005006890123.html', sourceName: 'AliExpress',
      },
      {
        providerType: 'CJ_DROPSHIPPING', providerProductId: 'cj-20004',
        title: 'RGB LED Strip Lights 5M Smart WiFi App Control',
        description: 'Smart WiFi LED strip lights 5M with music sync, 16M colors, app and voice control. Works with Alexa and Google Home. Easy peel-and-stick installation.',
        category: 'Room Decor', subcategory: 'LED Lighting',
        imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3eF.jpg'],
        variants: [{ title: '5M', options: { length: '5M' } }, { title: '10M', options: { length: '10M' } }],
        costPrice: 8.00, suggestedPrice: 24.99, currency: 'USD',
        shippingCost: 0, shippingDays: 5, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
        reviewCount: 28500, reviewRating: 4.6, orderVolume: 120000, supplierRating: 4.8,
        sourceUrl: 'https://cjdropshipping.com/product/mock-20004', sourceName: 'CJ Dropshipping',
      },
    ];

    // Return all products for now (mock mode) - real APIs would filter by keywords
    return mockCatalog.slice(0, params.limit || 20);
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

// ── Zendrop Provider ───────────────────────────

export class ZendropProvider implements SourceProvider {
  type = 'CJ_DROPSHIPPING' as const; // Uses same type for DB compat, differentiated by name
  name = 'Zendrop';

  isAvailable(): boolean { return !!process.env.ZENDROP_API_KEY; }
  async searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    console.log(`[Zendrop] Searching: ${params.keywords.join(', ')}`);
    return []; // API integration placeholder
  }
  async getProductDetails(_id: string): Promise<NormalizedProduct | null> { return null; }
}

// ── Spocket Provider ───────────────────────────

export class SpocketProvider implements SourceProvider {
  type = 'CJ_DROPSHIPPING' as const;
  name = 'Spocket';

  isAvailable(): boolean { return !!process.env.SPOCKET_API_KEY; }
  async searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    console.log(`[Spocket] Searching: ${params.keywords.join(', ')}`);
    return [];
  }
  async getProductDetails(_id: string): Promise<NormalizedProduct | null> { return null; }
}

// ── Alibaba Provider ───────────────────────────

export class AlibabaProvider implements SourceProvider {
  type = 'ALIEXPRESS' as const; // Similar data model
  name = 'Alibaba';

  isAvailable(): boolean { return !!process.env.ALIBABA_API_KEY; }
  async searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    console.log(`[Alibaba] Searching: ${params.keywords.join(', ')}`);
    return [];
  }
  async getProductDetails(_id: string): Promise<NormalizedProduct | null> { return null; }
}

// ── Temu Trend Signals ─────────────────────────

export class TemuTrendProvider implements SourceProvider {
  type = 'MANUAL' as const;
  name = 'Temu Trends';

  isAvailable(): boolean { return !!process.env.TEMU_API_KEY; }
  async searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    console.log(`[Temu] Scanning trends: ${params.keywords.join(', ')}`);
    return [];
  }
  async getProductDetails(_id: string): Promise<NormalizedProduct | null> { return null; }
}

// ── TikTok Trend Signals ───────────────────────

export class TikTokTrendProvider implements SourceProvider {
  type = 'MANUAL' as const;
  name = 'TikTok Trends';

  isAvailable(): boolean { return !!process.env.TIKTOK_API_KEY; }
  async searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    console.log(`[TikTok] Scanning viral products: ${params.keywords.join(', ')}`);
    return [];
  }
  async getProductDetails(_id: string): Promise<NormalizedProduct | null> { return null; }
}

// ── Amazon Trend Signals ───────────────────────

export class AmazonTrendProvider implements SourceProvider {
  type = 'MANUAL' as const;
  name = 'Amazon Trends';

  isAvailable(): boolean { return !!process.env.AMAZON_API_KEY; }
  async searchProducts(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    console.log(`[Amazon] Scanning bestsellers: ${params.keywords.join(', ')}`);
    return [];
  }
  async getProductDetails(_id: string): Promise<NormalizedProduct | null> { return null; }
}

// ── Provider Registry ──────────────────────────

export class ProviderRegistry {
  private providers: Map<string, SourceProvider> = new Map();

  constructor() {
    // Product sources
    this.register(new AliExpressProvider());
    this.register(new CJProvider());
    this.register(new ZendropProvider());
    this.register(new SpocketProvider());
    this.register(new AlibabaProvider());

    // Trend signal sources
    this.register(new TemuTrendProvider());
    this.register(new TikTokTrendProvider());
    this.register(new AmazonTrendProvider());

    // Data feeds
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
