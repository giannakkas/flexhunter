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
    const mockCatalog: NormalizedProduct[] = [
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-001',
        title: 'RGB LED Strip Lights 5M Smart WiFi Color Changing',
        description: 'Smart LED strip lights with app control, music sync, 16 million colors. Perfect for gaming room, bedroom aesthetic setup.',
        category: 'LED Lighting', subcategory: 'Smart Lights',
        imageUrls: ['https://ae01.alicdn.com/kf/led-strip.jpg'],
        variants: [{ title: '5M', options: { length: '5M' }, price: 24.99, costPrice: 8.50 }],
        costPrice: 8.50, suggestedPrice: 24.99, currency: 'USD',
        shippingCost: 0, shippingDays: 12, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 15420, reviewRating: 4.6, orderVolume: 48000, supplierRating: 4.8,
        sourceUrl: 'https://aliexpress.com/item/mock-001', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-002',
        title: 'Astronaut Galaxy Star Projector Night Light',
        description: 'Astronaut-shaped galaxy projector with nebula effect, adjustable head, timer. TikTok viral room decor.',
        category: 'Room Decor', subcategory: 'Projectors',
        imageUrls: ['https://ae01.alicdn.com/kf/astronaut-proj.jpg'],
        variants: [{ title: 'White', options: { color: 'White' } }],
        costPrice: 12.00, suggestedPrice: 34.99, currency: 'USD',
        shippingCost: 0, shippingDays: 15, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 32100, reviewRating: 4.7, orderVolume: 120000, supplierRating: 4.9,
        sourceUrl: 'https://aliexpress.com/item/mock-002', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-003',
        title: 'Magnetic Levitating Bluetooth Speaker Globe',
        description: 'Floating magnetic bluetooth speaker with LED lights. Futuristic desk accessory, great for content creators.',
        category: 'Tech Gadgets', subcategory: 'Speakers',
        imageUrls: ['https://ae01.alicdn.com/kf/lev-speaker.jpg'],
        variants: [{ title: 'Black', options: { color: 'Black' } }],
        costPrice: 22.00, suggestedPrice: 59.99, currency: 'USD',
        shippingCost: 2.50, shippingDays: 14, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 8900, reviewRating: 4.4, orderVolume: 25000, supplierRating: 4.6,
        sourceUrl: 'https://aliexpress.com/item/mock-003', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-004',
        title: 'Retro Pixel Art Bluetooth LED Display Screen',
        description: '16x16 programmable pixel LED display. Show custom animations, game art, notifications. Perfect gamer desk.',
        category: 'Gaming Accessories', subcategory: 'Desk Decor',
        imageUrls: ['https://ae01.alicdn.com/kf/pixel-display.jpg'],
        variants: [{ title: 'Standard', options: {} }],
        costPrice: 18.00, suggestedPrice: 44.99, currency: 'USD',
        shippingCost: 0, shippingDays: 10, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 5600, reviewRating: 4.5, orderVolume: 18000, supplierRating: 4.7,
        sourceUrl: 'https://aliexpress.com/item/mock-004', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-005',
        title: 'Cloud LED Neon Sign Wall Decor',
        description: 'Aesthetic cloud-shaped neon LED sign. USB powered, warm white light. TikTok room decor essential.',
        category: 'Room Decor', subcategory: 'Neon Signs',
        imageUrls: ['https://ae01.alicdn.com/kf/cloud-neon.jpg'],
        variants: [{ title: 'Warm White', options: { color: 'Warm White' } }],
        costPrice: 6.50, suggestedPrice: 19.99, currency: 'USD',
        shippingCost: 0, shippingDays: 12, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 22000, reviewRating: 4.8, orderVolume: 95000, supplierRating: 4.9,
        sourceUrl: 'https://aliexpress.com/item/mock-005', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-006',
        title: 'Mechanical Keyboard 60% RGB Hot-Swappable Gaming',
        description: 'Compact 60% mechanical keyboard with RGB backlighting, hot-swappable switches. Perfect gaming setup.',
        category: 'Gaming Accessories', subcategory: 'Keyboards',
        imageUrls: ['https://ae01.alicdn.com/kf/mech-keyboard.jpg'],
        variants: [{ title: 'Blue Switch', options: { switch: 'Blue' } }],
        costPrice: 25.00, suggestedPrice: 64.99, currency: 'USD',
        shippingCost: 0, shippingDays: 10, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 9800, reviewRating: 4.5, orderVolume: 35000, supplierRating: 4.7,
        sourceUrl: 'https://aliexpress.com/item/mock-006', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-007',
        title: 'Smart Ring Light 10" with Phone Mount & Tripod',
        description: '10 inch ring light with adjustable tripod, phone holder, 3 light modes. Content creator essential.',
        category: 'Creator Tools', subcategory: 'Lighting',
        imageUrls: ['https://ae01.alicdn.com/kf/ring-light.jpg'],
        variants: [{ title: '10 inch', options: { size: '10"' } }],
        costPrice: 11.00, suggestedPrice: 29.99, currency: 'USD',
        shippingCost: 0, shippingDays: 14, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 41000, reviewRating: 4.6, orderVolume: 180000, supplierRating: 4.8,
        sourceUrl: 'https://aliexpress.com/item/mock-007', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-008',
        title: 'Portable Mini Projector 1080P WiFi Bluetooth',
        description: 'Compact mini projector with WiFi, Bluetooth, 1080P support. Movie nights, gaming, bedroom cinema.',
        category: 'Tech Gadgets', subcategory: 'Projectors',
        imageUrls: ['https://ae01.alicdn.com/kf/mini-proj.jpg'],
        variants: [{ title: 'White', options: { color: 'White' } }],
        costPrice: 35.00, suggestedPrice: 79.99, currency: 'USD',
        shippingCost: 0, shippingDays: 12, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 12400, reviewRating: 4.3, orderVolume: 45000, supplierRating: 4.5,
        sourceUrl: 'https://aliexpress.com/item/mock-008', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-009',
        title: 'Desk Mat XXL RGB Gaming Mouse Pad LED Backlit',
        description: 'Extra large RGB desk mat with 14 lighting modes. Smooth surface for gaming. Aesthetic desk upgrade.',
        category: 'Gaming Accessories', subcategory: 'Mouse Pads',
        imageUrls: ['https://ae01.alicdn.com/kf/rgb-deskmat.jpg'],
        variants: [{ title: '800x300', options: { size: '800x300mm' } }],
        costPrice: 9.00, suggestedPrice: 27.99, currency: 'USD',
        shippingCost: 0, shippingDays: 15, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 18500, reviewRating: 4.6, orderVolume: 72000, supplierRating: 4.7,
        sourceUrl: 'https://aliexpress.com/item/mock-009', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-010',
        title: 'Wireless Charging Pad with Ambient Light Clock',
        description: 'Qi wireless charger with LED ambient light and digital clock display. Clean desk aesthetic.',
        category: 'Tech Gadgets', subcategory: 'Chargers',
        imageUrls: ['https://ae01.alicdn.com/kf/wireless-charge.jpg'],
        variants: [{ title: 'Black', options: { color: 'Black' } }],
        costPrice: 14.00, suggestedPrice: 36.99, currency: 'USD',
        shippingCost: 0, shippingDays: 11, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 7600, reviewRating: 4.4, orderVolume: 28000, supplierRating: 4.6,
        sourceUrl: 'https://aliexpress.com/item/mock-010', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-011',
        title: 'Smart Sunset Lamp Projector for Photography',
        description: 'Rainbow sunset projection lamp. Creates viral TikTok golden hour lighting for photos and room vibes.',
        category: 'Room Decor', subcategory: 'Lighting',
        imageUrls: ['https://ae01.alicdn.com/kf/sunset-lamp.jpg'],
        variants: [{ title: 'Sunset', options: { mode: 'Sunset' } }],
        costPrice: 7.50, suggestedPrice: 22.99, currency: 'USD',
        shippingCost: 0, shippingDays: 13, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
        reviewCount: 28000, reviewRating: 4.7, orderVolume: 110000, supplierRating: 4.8,
        sourceUrl: 'https://aliexpress.com/item/mock-011', sourceName: 'AliExpress',
      },
      {
        providerType: 'ALIEXPRESS', providerProductId: 'ali-012',
        title: 'Desktop Cable Organizer Silicone Clip Holder',
        description: 'Clean desk cable management. Silicone clips hold USB, charging cables. Minimal aesthetic desk setup.',
        category: 'Desk Setup', subcategory: 'Organization',
        imageUrls: ['https://ae01.alicdn.com/kf/cable-organizer.jpg'],
        variants: [{ title: '5 Pack', options: {} }],
        costPrice: 2.50, suggestedPrice: 12.99, currency: 'USD',
        shippingCost: 1.00, shippingDays: 18, shippingSpeed: 'ECONOMY', warehouseCountry: 'CN',
        reviewCount: 35000, reviewRating: 4.8, orderVolume: 200000, supplierRating: 4.9,
        sourceUrl: 'https://aliexpress.com/item/mock-012', sourceName: 'AliExpress',
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
