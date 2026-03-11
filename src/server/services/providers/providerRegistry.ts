// ==============================================
// Product Source Provider Layer
// ==============================================
// V1: All providers return curated mock data.
// V2: Connect real APIs per provider.

import { NormalizedProduct } from '../../../shared/types';

// ── Provider Interface ─────────────────────────

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

// ── Helper: build a mock provider from a catalog ──

function mockProvider(
  type: SourceProvider['type'],
  name: string,
  catalog: NormalizedProduct[],
): SourceProvider {
  return {
    type,
    name,
    isAvailable: () => true,
    async searchProducts(params) {
      console.log(`[${name}] Searching: ${params.keywords.join(', ')}`);
      return catalog.slice(0, params.limit || 20);
    },
    async getProductDetails() { return null; },
  };
}

// ════════════════════════════════════════════════
//  MOCK PRODUCT CATALOGS
// ════════════════════════════════════════════════

// ── AliExpress (8 products — CN warehouse, standard ship) ──

const aliexpressProducts: NormalizedProduct[] = [
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
    description: 'USB sunset projection lamp with 180° rotation. Creates viral golden hour lighting for TikTok photos. Multiple color modes.',
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
    description: 'Extra large RGB gaming desk mat 800x300mm with 14 lighting modes. Smooth micro-texture surface. Non-slip rubber base.',
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
    description: 'Compact HD mini projector with native 1080P, WiFi screen mirroring, Bluetooth speakers. Perfect for movie nights.',
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
    description: 'Aesthetic cloud-shaped LED neon sign. USB powered with switch. Warm white glow perfect for bedroom or content creator setup.',
    category: 'Room Decor', subcategory: 'Neon Signs',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6dN.jpg'],
    variants: [{ title: 'Warm White', options: { color: 'Warm' } }],
    costPrice: 6.80, suggestedPrice: 19.99, currency: 'USD',
    shippingCost: 0, shippingDays: 13, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 25400, reviewRating: 4.8, orderVolume: 112000, supplierRating: 4.9,
    sourceUrl: 'https://www.aliexpress.com/item/1005006567890.html', sourceName: 'AliExpress',
  },
  {
    providerType: 'ALIEXPRESS', providerProductId: 'ae-10006',
    title: '60% Mechanical Gaming Keyboard RGB Hot-Swap',
    description: 'Compact 60% mechanical keyboard with RGB backlighting, hot-swappable switches, PBT keycaps. USB-C.',
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
    description: 'Multi-function wireless charging pad with LED ambient light and digital alarm clock. Compatible with iPhone, Samsung, AirPods.',
    category: 'Electronics', subcategory: 'Chargers',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0bJ.jpg'],
    variants: [{ title: 'Black', options: { color: 'Black' } }, { title: 'White', options: { color: 'White' } }],
    costPrice: 13.50, suggestedPrice: 36.99, currency: 'USD',
    shippingCost: 0, shippingDays: 12, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 9200, reviewRating: 4.4, orderVolume: 34000, supplierRating: 4.6,
    sourceUrl: 'https://www.aliexpress.com/item/1005006789012.html', sourceName: 'AliExpress',
  },
  {
    providerType: 'ALIEXPRESS', providerProductId: 'ae-10008',
    title: 'Desktop Cable Management Clip Holder Silicone',
    description: 'Minimalist silicone cable organizer clips. Self-adhesive, holds USB-C, Lightning, HDMI cables. Set of 5.',
    category: 'Desk Setup', subcategory: 'Organization',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2dG.jpg'],
    variants: [{ title: '5 Pack', options: {} }],
    costPrice: 2.30, suggestedPrice: 12.99, currency: 'USD',
    shippingCost: 1.00, shippingDays: 18, shippingSpeed: 'ECONOMY', warehouseCountry: 'CN',
    reviewCount: 41000, reviewRating: 4.8, orderVolume: 230000, supplierRating: 4.9,
    sourceUrl: 'https://www.aliexpress.com/item/1005006890123.html', sourceName: 'AliExpress',
  },
];

// ── CJ Dropshipping (6 products — US warehouse, 3-5 day ship) ──

const cjProducts: NormalizedProduct[] = [
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'cj-20001',
    title: 'Magnetic Levitation Floating Speaker Bluetooth',
    description: 'Wireless magnetic floating Bluetooth speaker with LED lights. 360° surround sound, NFC pairing. Unique desk accessory.',
    category: 'Electronics', subcategory: 'Speakers',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4cM.jpg'],
    variants: [{ title: 'Black', options: { color: 'Black' } }],
    costPrice: 22.50, suggestedPrice: 59.99, currency: 'USD',
    shippingCost: 2.50, shippingDays: 5, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 8700, reviewRating: 4.4, orderVolume: 28000, supplierRating: 4.6,
    sourceUrl: 'https://cjdropshipping.com/product/mock-20001', sourceName: 'CJ Dropshipping',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'cj-20002',
    title: 'Smart Ring Light 10" with Tripod Phone Mount',
    description: '10 inch LED ring light with extendable tripod, phone holder, 3 color modes, 10 brightness levels. Essential for creators.',
    category: 'Creator Tools', subcategory: 'Lighting',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6dP.jpg'],
    variants: [{ title: '10 inch', options: { size: '10"' } }],
    costPrice: 10.50, suggestedPrice: 29.99, currency: 'USD',
    shippingCost: 0, shippingDays: 4, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 38000, reviewRating: 4.6, orderVolume: 165000, supplierRating: 4.8,
    sourceUrl: 'https://cjdropshipping.com/product/mock-20002', sourceName: 'CJ Dropshipping',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'cj-20003',
    title: 'Retro Pixel Art LED Display Programmable',
    description: '16x16 LED pixel display with app control. Create custom animations, game art, text. Perfect gamer desk decor.',
    category: 'Gaming', subcategory: 'Desk Decor',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1cI.jpg'],
    variants: [{ title: 'Standard', options: {} }],
    costPrice: 18.00, suggestedPrice: 44.99, currency: 'USD',
    shippingCost: 0, shippingDays: 4, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 6800, reviewRating: 4.5, orderVolume: 22000, supplierRating: 4.7,
    sourceUrl: 'https://cjdropshipping.com/product/mock-20003', sourceName: 'CJ Dropshipping',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'cj-20004',
    title: 'RGB LED Strip Lights 5M Smart WiFi App Control',
    description: 'Smart WiFi LED strip lights 5M with music sync, 16M colors. Works with Alexa and Google Home.',
    category: 'Room Decor', subcategory: 'LED Lighting',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/S8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3eF.jpg'],
    variants: [{ title: '5M', options: { length: '5M' } }, { title: '10M', options: { length: '10M' } }],
    costPrice: 8.00, suggestedPrice: 24.99, currency: 'USD',
    shippingCost: 0, shippingDays: 3, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 28500, reviewRating: 4.6, orderVolume: 120000, supplierRating: 4.8,
    sourceUrl: 'https://cjdropshipping.com/product/mock-20004', sourceName: 'CJ Dropshipping',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'cj-20005',
    title: 'Portable Neck Fan Bladeless Hands-Free',
    description: 'Wearable bladeless neck fan with 3 speeds. USB-C rechargeable, 8hr battery. Ultra-quiet for outdoor, gym, commute.',
    category: 'Personal Tech', subcategory: 'Fans',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Scj20005neckfanportableblackwhiteUSA.jpg'],
    variants: [{ title: 'White', options: { color: 'White' } }, { title: 'Black', options: { color: 'Black' } }],
    costPrice: 9.80, suggestedPrice: 28.99, currency: 'USD',
    shippingCost: 0, shippingDays: 4, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 15200, reviewRating: 4.5, orderVolume: 67000, supplierRating: 4.7,
    sourceUrl: 'https://cjdropshipping.com/product/mock-20005', sourceName: 'CJ Dropshipping',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'cj-20006',
    title: 'Mini Thermal Printer Portable Bluetooth Label Maker',
    description: 'Pocket thermal printer for labels, stickers, notes, photos. No ink needed. Bluetooth app. Perfect for organization.',
    category: 'Office', subcategory: 'Printers',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Scj20006thermalprinterminilabelpinkgreen.jpg'],
    variants: [{ title: 'Pink', options: { color: 'Pink' } }, { title: 'Green', options: { color: 'Green' } }],
    costPrice: 12.00, suggestedPrice: 32.99, currency: 'USD',
    shippingCost: 0, shippingDays: 5, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 21000, reviewRating: 4.6, orderVolume: 89000, supplierRating: 4.8,
    sourceUrl: 'https://cjdropshipping.com/product/mock-20006', sourceName: 'CJ Dropshipping',
  },
];

// ── Zendrop (6 products — US-based, quality focused) ──

const zendropProducts: NormalizedProduct[] = [
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'zd-30001',
    title: 'Bamboo Wireless Charging Stand Eco-Friendly',
    description: 'Natural bamboo wireless charging stand. 15W fast charge, anti-slip base. Eco-friendly desk upgrade.',
    category: 'Electronics', subcategory: 'Chargers',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Szd30001bamboochargerstand15w.jpg'],
    variants: [{ title: 'Bamboo', options: { material: 'Bamboo' } }],
    costPrice: 11.00, suggestedPrice: 34.99, currency: 'USD',
    shippingCost: 0, shippingDays: 5, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 7800, reviewRating: 4.7, orderVolume: 31000, supplierRating: 4.8,
    sourceUrl: 'https://zendrop.com/product/mock-30001', sourceName: 'Zendrop',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'zd-30002',
    title: 'Smart Water Bottle Temperature Display LED',
    description: 'Insulated smart water bottle with LED temperature display on lid. 500ml double-wall stainless steel. Hot 12h / cold 24h.',
    category: 'Lifestyle', subcategory: 'Drinkware',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Szd30002smartwaterbottleLEDtemp.jpg'],
    variants: [{ title: 'Black', options: { color: 'Black' } }, { title: 'Rose Gold', options: { color: 'Rose Gold' } }],
    costPrice: 8.50, suggestedPrice: 26.99, currency: 'USD',
    shippingCost: 0, shippingDays: 5, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 19500, reviewRating: 4.6, orderVolume: 85000, supplierRating: 4.7,
    sourceUrl: 'https://zendrop.com/product/mock-30002', sourceName: 'Zendrop',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'zd-30003',
    title: 'Posture Corrector Smart Vibration Reminder',
    description: 'Intelligent posture corrector with vibration alert when you slouch. Lightweight, invisible under clothing. USB rechargeable.',
    category: 'Health', subcategory: 'Posture',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Szd30003posturecorrectorsmartvibes.jpg'],
    variants: [{ title: 'One Size', options: {} }],
    costPrice: 14.00, suggestedPrice: 39.99, currency: 'USD',
    shippingCost: 0, shippingDays: 6, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 11200, reviewRating: 4.3, orderVolume: 42000, supplierRating: 4.6,
    sourceUrl: 'https://zendrop.com/product/mock-30003', sourceName: 'Zendrop',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'zd-30004',
    title: 'Aroma Diffuser Flame Effect Humidifier USB',
    description: 'Ultrasonic aroma diffuser with realistic flame effect. 130ml, auto shut-off, whisper quiet. Essential oil compatible.',
    category: 'Home', subcategory: 'Aromatherapy',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Szd30004flamediffuserUSBblack.jpg'],
    variants: [{ title: 'Black', options: { color: 'Black' } }, { title: 'White', options: { color: 'White' } }],
    costPrice: 10.50, suggestedPrice: 32.99, currency: 'USD',
    shippingCost: 0, shippingDays: 5, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 24000, reviewRating: 4.7, orderVolume: 98000, supplierRating: 4.8,
    sourceUrl: 'https://zendrop.com/product/mock-30004', sourceName: 'Zendrop',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'zd-30005',
    title: 'Magnetic Phone Mount for Car Dashboard',
    description: 'Ultra-strong N52 magnetic car phone mount. 360° rotation, one-hand operation. Sleek minimalist design.',
    category: 'Car Accessories', subcategory: 'Mounts',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Szd30005magneticcarphoneholder360.jpg'],
    variants: [{ title: 'Silver', options: { color: 'Silver' } }],
    costPrice: 5.50, suggestedPrice: 18.99, currency: 'USD',
    shippingCost: 0, shippingDays: 4, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 33000, reviewRating: 4.5, orderVolume: 140000, supplierRating: 4.7,
    sourceUrl: 'https://zendrop.com/product/mock-30005', sourceName: 'Zendrop',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'zd-30006',
    title: 'Foldable Laptop Stand Adjustable Aluminum',
    description: 'Ergonomic aluminum laptop stand with 6 angle adjustments. Foldable, portable. Fits 10-17 inch laptops.',
    category: 'Office', subcategory: 'Stands',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Szd30006foldablelaptopstandaluminum.jpg'],
    variants: [{ title: 'Silver', options: { color: 'Silver' } }, { title: 'Space Gray', options: { color: 'Space Gray' } }],
    costPrice: 9.00, suggestedPrice: 27.99, currency: 'USD',
    shippingCost: 0, shippingDays: 5, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 16000, reviewRating: 4.6, orderVolume: 72000, supplierRating: 4.8,
    sourceUrl: 'https://zendrop.com/product/mock-30006', sourceName: 'Zendrop',
  },
];

// ── Spocket (6 products — US/EU suppliers, premium quality) ──

const spocketProducts: NormalizedProduct[] = [
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'sp-40001',
    title: 'Handmade Soy Candle Gift Set 3-Pack',
    description: 'Artisan soy wax candle set. Lavender, vanilla, and cedar scents. Hand-poured in California. 40hr burn time each.',
    category: 'Home', subcategory: 'Candles',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Ssp40001soycandle3packgiftset.jpg'],
    variants: [{ title: '3-Pack', options: {} }],
    costPrice: 16.00, suggestedPrice: 44.99, currency: 'USD',
    shippingCost: 3.99, shippingDays: 4, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 4200, reviewRating: 4.9, orderVolume: 15000, supplierRating: 4.9,
    sourceUrl: 'https://spocket.co/product/mock-40001', sourceName: 'Spocket',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'sp-40002',
    title: 'Organic Cotton Tote Bag Minimalist Design',
    description: '100% GOTS certified organic cotton tote. Screen-printed minimalist design. Made in Portugal. Interior pocket.',
    category: 'Fashion', subcategory: 'Bags',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Ssp40002organiccottontotebagEU.jpg'],
    variants: [{ title: 'Natural', options: { color: 'Natural' } }, { title: 'Black', options: { color: 'Black' } }],
    costPrice: 8.00, suggestedPrice: 24.99, currency: 'USD',
    shippingCost: 2.99, shippingDays: 5, shippingSpeed: 'EXPRESS', warehouseCountry: 'EU',
    reviewCount: 6100, reviewRating: 4.8, orderVolume: 23000, supplierRating: 4.8,
    sourceUrl: 'https://spocket.co/product/mock-40002', sourceName: 'Spocket',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'sp-40003',
    title: 'Ceramic Pour-Over Coffee Dripper Handmade',
    description: 'Handcrafted ceramic pour-over coffee dripper. Fits standard mugs. Includes 40 paper filters. Made in Brooklyn.',
    category: 'Kitchen', subcategory: 'Coffee',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Ssp40003ceramicpourovercoffeebrooklyn.jpg'],
    variants: [{ title: 'Matte White', options: { color: 'Matte White' } }, { title: 'Sage Green', options: { color: 'Sage Green' } }],
    costPrice: 14.50, suggestedPrice: 38.99, currency: 'USD',
    shippingCost: 4.99, shippingDays: 3, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 2800, reviewRating: 4.9, orderVolume: 9500, supplierRating: 4.9,
    sourceUrl: 'https://spocket.co/product/mock-40003', sourceName: 'Spocket',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'sp-40004',
    title: 'Linen Throw Pillow Cover Set Boho 18x18',
    description: 'Set of 2 natural linen pillow covers. Boho textured weave with hidden zipper. Machine washable. Handwoven in Lithuania.',
    category: 'Home', subcategory: 'Pillows',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Ssp40004linenpillowcoverbohoEU.jpg'],
    variants: [{ title: 'Oatmeal', options: { color: 'Oatmeal' } }, { title: 'Terracotta', options: { color: 'Terracotta' } }],
    costPrice: 12.00, suggestedPrice: 34.99, currency: 'USD',
    shippingCost: 3.49, shippingDays: 6, shippingSpeed: 'EXPRESS', warehouseCountry: 'EU',
    reviewCount: 5400, reviewRating: 4.7, orderVolume: 19000, supplierRating: 4.8,
    sourceUrl: 'https://spocket.co/product/mock-40004', sourceName: 'Spocket',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'sp-40005',
    title: 'Natural Jade Gua Sha Face Massage Tool',
    description: 'Genuine jade gua sha facial sculpting tool. Promotes circulation, reduces puffiness. Comes in velvet pouch.',
    category: 'Beauty', subcategory: 'Skincare Tools',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Ssp40005jadeguashafacetoolvelvet.jpg'],
    variants: [{ title: 'Jade Green', options: { material: 'Jade' } }, { title: 'Rose Quartz', options: { material: 'Rose Quartz' } }],
    costPrice: 5.50, suggestedPrice: 22.99, currency: 'USD',
    shippingCost: 2.49, shippingDays: 4, shippingSpeed: 'EXPRESS', warehouseCountry: 'US',
    reviewCount: 14500, reviewRating: 4.6, orderVolume: 58000, supplierRating: 4.7,
    sourceUrl: 'https://spocket.co/product/mock-40005', sourceName: 'Spocket',
  },
  {
    providerType: 'CJ_DROPSHIPPING', providerProductId: 'sp-40006',
    title: 'Cork Yoga Mat Eco-Friendly Non-Slip 5mm',
    description: 'Premium cork surface yoga mat with natural rubber base. Anti-bacterial, eco-friendly. 183x68cm. Made in EU.',
    category: 'Fitness', subcategory: 'Yoga',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Ssp40006corkyogamatecofriendlyEU.jpg'],
    variants: [{ title: '5mm', options: { thickness: '5mm' } }],
    costPrice: 18.00, suggestedPrice: 54.99, currency: 'USD',
    shippingCost: 5.99, shippingDays: 5, shippingSpeed: 'EXPRESS', warehouseCountry: 'EU',
    reviewCount: 3600, reviewRating: 4.8, orderVolume: 12000, supplierRating: 4.9,
    sourceUrl: 'https://spocket.co/product/mock-40006', sourceName: 'Spocket',
  },
];

// ── Alibaba (6 products — wholesale/bulk, lowest cost) ──

const alibabaProducts: NormalizedProduct[] = [
  {
    providerType: 'ALIEXPRESS', providerProductId: 'ab-50001',
    title: 'Bulk Custom Logo Tumblers Stainless Steel 20oz',
    description: '20oz vacuum insulated tumbler with custom logo engraving. MOQ 50 pieces. 304 stainless steel, powder coated.',
    category: 'Drinkware', subcategory: 'Tumblers',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sab50001bulktumbler20ozcustomlogo.jpg'],
    variants: [{ title: 'White', options: { color: 'White' } }, { title: 'Black', options: { color: 'Black' } }, { title: 'Navy', options: { color: 'Navy' } }],
    costPrice: 4.20, suggestedPrice: 24.99, currency: 'USD',
    shippingCost: 2.00, shippingDays: 20, shippingSpeed: 'ECONOMY', warehouseCountry: 'CN',
    reviewCount: 52000, reviewRating: 4.6, orderVolume: 320000, supplierRating: 4.8,
    sourceUrl: 'https://alibaba.com/product/mock-50001', sourceName: 'Alibaba',
  },
  {
    providerType: 'ALIEXPRESS', providerProductId: 'ab-50002',
    title: 'Wholesale Silicone Phone Cases Matte Finish',
    description: 'Ultra-slim matte silicone phone case. Soft-touch finish, full camera protection. iPhone 14-16 and Samsung S23-S25. MOQ 100.',
    category: 'Phone Accessories', subcategory: 'Cases',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sab50002wholesalephonecasematte.jpg'],
    variants: [{ title: 'iPhone 16', options: { model: 'iPhone 16' } }, { title: 'Samsung S25', options: { model: 'Samsung S25' } }],
    costPrice: 1.20, suggestedPrice: 14.99, currency: 'USD',
    shippingCost: 0.50, shippingDays: 18, shippingSpeed: 'ECONOMY', warehouseCountry: 'CN',
    reviewCount: 89000, reviewRating: 4.5, orderVolume: 1200000, supplierRating: 4.7,
    sourceUrl: 'https://alibaba.com/product/mock-50002', sourceName: 'Alibaba',
  },
  {
    providerType: 'ALIEXPRESS', providerProductId: 'ab-50003',
    title: 'OEM Fitness Resistance Bands Set 5-Pack',
    description: 'Latex-free TPE resistance bands. 5 levels. Custom color and packaging available. MOQ 200 sets.',
    category: 'Fitness', subcategory: 'Equipment',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sab50003oemresistancebands5pack.jpg'],
    variants: [{ title: '5-Band Set', options: {} }],
    costPrice: 2.80, suggestedPrice: 19.99, currency: 'USD',
    shippingCost: 1.50, shippingDays: 22, shippingSpeed: 'ECONOMY', warehouseCountry: 'CN',
    reviewCount: 34000, reviewRating: 4.4, orderVolume: 450000, supplierRating: 4.6,
    sourceUrl: 'https://alibaba.com/product/mock-50003', sourceName: 'Alibaba',
  },
  {
    providerType: 'ALIEXPRESS', providerProductId: 'ab-50004',
    title: 'Custom Print Microfiber Cleaning Cloth 30x30cm',
    description: 'Premium microfiber cloth with full-color custom printing. 300gsm. Perfect for eyewear, electronics, branded giveaways. MOQ 500.',
    category: 'Accessories', subcategory: 'Cleaning',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sab50004microfiberclothcustomprint.jpg'],
    variants: [{ title: '30x30cm', options: { size: '30x30cm' } }],
    costPrice: 0.45, suggestedPrice: 6.99, currency: 'USD',
    shippingCost: 0.30, shippingDays: 25, shippingSpeed: 'ECONOMY', warehouseCountry: 'CN',
    reviewCount: 120000, reviewRating: 4.7, orderVolume: 2500000, supplierRating: 4.9,
    sourceUrl: 'https://alibaba.com/product/mock-50004', sourceName: 'Alibaba',
  },
  {
    providerType: 'ALIEXPRESS', providerProductId: 'ab-50005',
    title: 'Wholesale LED Desk Lamp Touch Dimmer USB',
    description: 'Foldable LED desk lamp with 3 color temperatures and touch dimming. USB-A charging port built in. MOQ 100.',
    category: 'Office', subcategory: 'Lighting',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sab50005leddesklamptouchdimmer.jpg'],
    variants: [{ title: 'White', options: { color: 'White' } }, { title: 'Black', options: { color: 'Black' } }],
    costPrice: 6.50, suggestedPrice: 29.99, currency: 'USD',
    shippingCost: 2.00, shippingDays: 20, shippingSpeed: 'ECONOMY', warehouseCountry: 'CN',
    reviewCount: 18000, reviewRating: 4.5, orderVolume: 95000, supplierRating: 4.7,
    sourceUrl: 'https://alibaba.com/product/mock-50005', sourceName: 'Alibaba',
  },
  {
    providerType: 'ALIEXPRESS', providerProductId: 'ab-50006',
    title: 'Bulk Bamboo Sunglasses Polarized UV400',
    description: 'Eco-friendly bamboo arm sunglasses with polarized UV400 lenses. Custom logo laser engraving. MOQ 50.',
    category: 'Fashion', subcategory: 'Sunglasses',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sab50006bamboosunglassespolarized.jpg'],
    variants: [{ title: 'Brown Lens', options: { lens: 'Brown' } }, { title: 'Gray Lens', options: { lens: 'Gray' } }],
    costPrice: 3.80, suggestedPrice: 22.99, currency: 'USD',
    shippingCost: 1.00, shippingDays: 18, shippingSpeed: 'ECONOMY', warehouseCountry: 'CN',
    reviewCount: 27000, reviewRating: 4.6, orderVolume: 180000, supplierRating: 4.8,
    sourceUrl: 'https://alibaba.com/product/mock-50006', sourceName: 'Alibaba',
  },
];

// ── Temu Trends (6 products — ultra-cheap viral items) ──

const temuProducts: NormalizedProduct[] = [
  {
    providerType: 'MANUAL', providerProductId: 'tm-60001',
    title: 'Cloud Slides Pillow Slippers Ultra Soft',
    description: 'Viral cloud slides with thick EVA cushion sole. Non-slip, waterproof, ultra-lightweight. 500K+ sold on Temu.',
    category: 'Footwear', subcategory: 'Slides',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stm60001cloudslidesevabeige.jpg'],
    variants: [{ title: 'Beige', options: { color: 'Beige' } }, { title: 'Lavender', options: { color: 'Lavender' } }, { title: 'Sage', options: { color: 'Sage' } }],
    costPrice: 3.50, suggestedPrice: 16.99, currency: 'USD',
    shippingCost: 0, shippingDays: 8, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 85000, reviewRating: 4.5, orderVolume: 520000, supplierRating: 4.6,
    sourceUrl: 'https://temu.com/product/mock-60001', sourceName: 'Temu Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'tm-60002',
    title: 'Ice Cube Face Roller Skin Care Tool',
    description: 'Reusable ice mold face roller for de-puffing and skin tightening. Fill with water or serum. Morning skincare essential.',
    category: 'Beauty', subcategory: 'Skincare',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stm60002icecuberollerface.jpg'],
    variants: [{ title: 'Pink', options: { color: 'Pink' } }, { title: 'Purple', options: { color: 'Purple' } }],
    costPrice: 1.80, suggestedPrice: 9.99, currency: 'USD',
    shippingCost: 0, shippingDays: 10, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 62000, reviewRating: 4.4, orderVolume: 380000, supplierRating: 4.5,
    sourceUrl: 'https://temu.com/product/mock-60002', sourceName: 'Temu Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'tm-60003',
    title: 'Cute Cat Paw Desk Pad Wrist Rest Mouse Pad',
    description: 'Kawaii cat paw shaped mouse pad with memory foam wrist rest. Soft lycra cover, non-slip base.',
    category: 'Office', subcategory: 'Mouse Pads',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stm60003catpawmousepadwristrest.jpg'],
    variants: [{ title: 'Gray Cat', options: { design: 'Gray' } }, { title: 'Orange Cat', options: { design: 'Orange' } }],
    costPrice: 2.20, suggestedPrice: 11.99, currency: 'USD',
    shippingCost: 0, shippingDays: 9, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 44000, reviewRating: 4.7, orderVolume: 210000, supplierRating: 4.7,
    sourceUrl: 'https://temu.com/product/mock-60003', sourceName: 'Temu Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'tm-60004',
    title: 'Mini Handheld Fan USB Rechargeable Portable',
    description: 'Pocket-size handheld fan with 3 speeds. USB-C rechargeable, 6hr battery. Doubles as phone stand.',
    category: 'Personal Tech', subcategory: 'Fans',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stm60004minihandheldfanwhitepink.jpg'],
    variants: [{ title: 'White', options: { color: 'White' } }, { title: 'Pink', options: { color: 'Pink' } }],
    costPrice: 2.50, suggestedPrice: 12.99, currency: 'USD',
    shippingCost: 0, shippingDays: 8, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 71000, reviewRating: 4.3, orderVolume: 440000, supplierRating: 4.5,
    sourceUrl: 'https://temu.com/product/mock-60004', sourceName: 'Temu Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'tm-60005',
    title: 'Acrylic Claw Hair Clips Set of 6 Aesthetic',
    description: 'Matte acrylic claw clips in aesthetic earth tones. 6-piece set. Strong hold for thick hair. Y2K and clean girl aesthetic.',
    category: 'Fashion', subcategory: 'Hair Accessories',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stm60005acrylicclawclipset6.jpg'],
    variants: [{ title: 'Earth Tones', options: {} }, { title: 'Pastels', options: {} }],
    costPrice: 1.50, suggestedPrice: 9.99, currency: 'USD',
    shippingCost: 0, shippingDays: 10, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 93000, reviewRating: 4.6, orderVolume: 680000, supplierRating: 4.7,
    sourceUrl: 'https://temu.com/product/mock-60005', sourceName: 'Temu Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'tm-60006',
    title: 'Collapsible Silicone Water Bottle 600ml Travel',
    description: 'Foldable silicone water bottle that collapses flat. BPA-free, dishwasher safe, carabiner clip. Ideal for hiking, gym, travel.',
    category: 'Lifestyle', subcategory: 'Drinkware',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stm60006collapsiblewaterbottleblue.jpg'],
    variants: [{ title: 'Blue', options: { color: 'Blue' } }, { title: 'Green', options: { color: 'Green' } }],
    costPrice: 2.80, suggestedPrice: 14.99, currency: 'USD',
    shippingCost: 0, shippingDays: 9, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 38000, reviewRating: 4.4, orderVolume: 195000, supplierRating: 4.6,
    sourceUrl: 'https://temu.com/product/mock-60006', sourceName: 'Temu Trends',
  },
];

// ── TikTok Trends (6 products — viral social media products) ──

const tiktokProducts: NormalizedProduct[] = [
  {
    providerType: 'MANUAL', providerProductId: 'tt-70001',
    title: 'Sunset Lamp 2.0 Touch Control 16 Colors',
    description: 'Next-gen sunset lamp with touch-sensitive color cycling. 16 color modes. 50M+ views on TikTok. USB-C, 360° rotation.',
    category: 'Room Decor', subcategory: 'Lighting',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stt70001sunsetlamp16colorstouch.jpg'],
    variants: [{ title: 'Chrome', options: { finish: 'Chrome' } }, { title: 'Matte Black', options: { finish: 'Matte Black' } }],
    costPrice: 9.50, suggestedPrice: 29.99, currency: 'USD',
    shippingCost: 0, shippingDays: 10, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 28000, reviewRating: 4.6, orderVolume: 150000, supplierRating: 4.7,
    sourceUrl: 'https://tiktok.com/trends/mock-70001', sourceName: 'TikTok Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'tt-70002',
    title: 'Mini Portable Blender USB-C Rechargeable',
    description: 'Personal blender that went viral on FoodTok. USB-C rechargeable, 6 blades, 380ml. Smoothies in 30 seconds.',
    category: 'Kitchen', subcategory: 'Blenders',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stt70002miniblenderUSBCportable.jpg'],
    variants: [{ title: 'White', options: { color: 'White' } }, { title: 'Pink', options: { color: 'Pink' } }, { title: 'Green', options: { color: 'Green' } }],
    costPrice: 8.00, suggestedPrice: 26.99, currency: 'USD',
    shippingCost: 0, shippingDays: 12, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 45000, reviewRating: 4.4, orderVolume: 290000, supplierRating: 4.6,
    sourceUrl: 'https://tiktok.com/trends/mock-70002', sourceName: 'TikTok Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'tt-70003',
    title: 'LED Flame Table Lamp Rechargeable Ambient',
    description: 'Viral crystal-style table lamp with flame LED effect. Touch dimmer, rechargeable, cordless. "That lamp" from TikTok home decor.',
    category: 'Room Decor', subcategory: 'Lamps',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stt70003flamelampcrystalambient.jpg'],
    variants: [{ title: 'Crystal Clear', options: { style: 'Crystal' } }, { title: 'Smoky', options: { style: 'Smoky' } }],
    costPrice: 12.00, suggestedPrice: 36.99, currency: 'USD',
    shippingCost: 0, shippingDays: 11, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 32000, reviewRating: 4.7, orderVolume: 175000, supplierRating: 4.8,
    sourceUrl: 'https://tiktok.com/trends/mock-70003', sourceName: 'TikTok Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'tt-70004',
    title: 'Electric Scalp Massager Head Scratcher Spider',
    description: 'Automatic electric head massager with 12 vibrating nodes. Relieves stress and promotes relaxation. Viral ASMR TikTok sensation.',
    category: 'Wellness', subcategory: 'Massage',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stt70004electricscalpmassagerspider.jpg'],
    variants: [{ title: 'Standard', options: {} }],
    costPrice: 7.50, suggestedPrice: 24.99, currency: 'USD',
    shippingCost: 0, shippingDays: 12, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 22000, reviewRating: 4.5, orderVolume: 110000, supplierRating: 4.6,
    sourceUrl: 'https://tiktok.com/trends/mock-70004', sourceName: 'TikTok Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'tt-70005',
    title: 'Magnetic Eyelashes No Glue Kit with Applicator',
    description: 'Reusable magnetic lash kit with mirror applicator tool. No glue needed, applies in seconds. 3 pairs included. BeautyTok favorite.',
    category: 'Beauty', subcategory: 'Lashes',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stt70005magneticeyelashesnokit.jpg'],
    variants: [{ title: 'Natural', options: { style: 'Natural' } }, { title: 'Dramatic', options: { style: 'Dramatic' } }],
    costPrice: 4.50, suggestedPrice: 19.99, currency: 'USD',
    shippingCost: 0, shippingDays: 10, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 56000, reviewRating: 4.3, orderVolume: 340000, supplierRating: 4.5,
    sourceUrl: 'https://tiktok.com/trends/mock-70005', sourceName: 'TikTok Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'tt-70006',
    title: 'Star Projector Galaxy Light with Bluetooth Speaker',
    description: 'Upgraded star projector with built-in Bluetooth speaker and white noise. Timer, app control. Ultimate TikTok bedroom setup.',
    category: 'Room Decor', subcategory: 'Projectors',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Stt70006starprojectorbtspkr.jpg'],
    variants: [{ title: 'Black', options: { color: 'Black' } }, { title: 'White', options: { color: 'White' } }],
    costPrice: 15.00, suggestedPrice: 42.99, currency: 'USD',
    shippingCost: 0, shippingDays: 11, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 19000, reviewRating: 4.6, orderVolume: 88000, supplierRating: 4.7,
    sourceUrl: 'https://tiktok.com/trends/mock-70006', sourceName: 'TikTok Trends',
  },
];

// ── Amazon Trends (6 products — bestseller-style, proven demand) ──

const amazonProducts: NormalizedProduct[] = [
  {
    providerType: 'MANUAL', providerProductId: 'am-80001',
    title: 'Noise Cancelling Earbuds ANC Bluetooth 5.3',
    description: 'True wireless earbuds with hybrid ANC, 40hr battery with case, IPX5 waterproof. Amazon #1 Best Seller under $30.',
    category: 'Electronics', subcategory: 'Earbuds',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sam80001ancearbudsbt53waterproof.jpg'],
    variants: [{ title: 'Black', options: { color: 'Black' } }, { title: 'White', options: { color: 'White' } }],
    costPrice: 11.00, suggestedPrice: 29.99, currency: 'USD',
    shippingCost: 0, shippingDays: 8, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 125000, reviewRating: 4.4, orderVolume: 850000, supplierRating: 4.6,
    sourceUrl: 'https://amazon.com/trends/mock-80001', sourceName: 'Amazon Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'am-80002',
    title: 'Electric Milk Frother Handheld USB Rechargeable',
    description: 'Stainless steel milk frother with 3 speeds. USB-C rechargeable. Makes lattes, matcha, protein shakes. Amazon Kitchen bestseller.',
    category: 'Kitchen', subcategory: 'Coffee Tools',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sam80002milkfrotherUSBrechargeable.jpg'],
    variants: [{ title: 'Black', options: { color: 'Black' } }, { title: 'Silver', options: { color: 'Silver' } }],
    costPrice: 4.50, suggestedPrice: 17.99, currency: 'USD',
    shippingCost: 0, shippingDays: 10, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 78000, reviewRating: 4.5, orderVolume: 420000, supplierRating: 4.7,
    sourceUrl: 'https://amazon.com/trends/mock-80002', sourceName: 'Amazon Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'am-80003',
    title: 'LED Desk Organizer with Wireless Charging Pad',
    description: 'Multi-compartment desk organizer with built-in 15W Qi wireless charger and LED night light. Holds pens, phone, cards.',
    category: 'Office', subcategory: 'Organizers',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sam80003deskorganizerqicharger.jpg'],
    variants: [{ title: 'White', options: { color: 'White' } }, { title: 'Black', options: { color: 'Black' } }],
    costPrice: 14.00, suggestedPrice: 39.99, currency: 'USD',
    shippingCost: 0, shippingDays: 12, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 15000, reviewRating: 4.6, orderVolume: 62000, supplierRating: 4.7,
    sourceUrl: 'https://amazon.com/trends/mock-80003', sourceName: 'Amazon Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'am-80004',
    title: 'Portable Car Vacuum Cleaner Cordless 12000PA',
    description: 'Powerful cordless car vacuum with 12000PA suction. HEPA filter, LED light, USB-C rechargeable. Amazon Automotive #1.',
    category: 'Car Accessories', subcategory: 'Cleaning',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sam80004carvacuumcordless12000pa.jpg'],
    variants: [{ title: 'Black', options: { color: 'Black' } }],
    costPrice: 16.00, suggestedPrice: 44.99, currency: 'USD',
    shippingCost: 0, shippingDays: 11, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 42000, reviewRating: 4.3, orderVolume: 195000, supplierRating: 4.5,
    sourceUrl: 'https://amazon.com/trends/mock-80004', sourceName: 'Amazon Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'am-80005',
    title: 'Smart Body Scale Bluetooth BMI Muscle Mass',
    description: 'Smart bathroom scale with 13 body composition metrics via app. BMI, muscle mass, body fat, water. Bluetooth sync.',
    category: 'Health', subcategory: 'Scales',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sam80005smartscalebluetoothbmi.jpg'],
    variants: [{ title: 'White', options: { color: 'White' } }, { title: 'Black', options: { color: 'Black' } }],
    costPrice: 10.00, suggestedPrice: 32.99, currency: 'USD',
    shippingCost: 0, shippingDays: 12, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 55000, reviewRating: 4.5, orderVolume: 280000, supplierRating: 4.7,
    sourceUrl: 'https://amazon.com/trends/mock-80005', sourceName: 'Amazon Trends',
  },
  {
    providerType: 'MANUAL', providerProductId: 'am-80006',
    title: 'Electric Lint Remover Fabric Shaver USB-C',
    description: 'Rechargeable fabric shaver with 6-blade system and 3 speeds. Removes pills from sweaters, couches, blankets. 65K+ 5-star reviews.',
    category: 'Home', subcategory: 'Fabric Care',
    imageUrls: ['https://ae-pic-a1.aliexpress-media.com/kf/Sam80006lintremoverfabricshaver.jpg'],
    variants: [{ title: 'White', options: { color: 'White' } }],
    costPrice: 5.50, suggestedPrice: 19.99, currency: 'USD',
    shippingCost: 0, shippingDays: 10, shippingSpeed: 'STANDARD', warehouseCountry: 'CN',
    reviewCount: 65000, reviewRating: 4.6, orderVolume: 350000, supplierRating: 4.8,
    sourceUrl: 'https://amazon.com/trends/mock-80006', sourceName: 'Amazon Trends',
  },
];

// ════════════════════════════════════════════════
//  PROVIDER REGISTRY
// ════════════════════════════════════════════════

export class ProviderRegistry {
  private providers: Map<string, SourceProvider> = new Map();

  constructor() {
    // Product sources (all have mock data)
    this.register(mockProvider('ALIEXPRESS', 'AliExpress', aliexpressProducts));
    this.register(mockProvider('CJ_DROPSHIPPING', 'CJ Dropshipping', cjProducts));
    this.register(mockProvider('CJ_DROPSHIPPING', 'Zendrop', zendropProducts));
    this.register(mockProvider('CJ_DROPSHIPPING', 'Spocket', spocketProducts));
    this.register(mockProvider('ALIEXPRESS', 'Alibaba', alibabaProducts));

    // Trend signal sources (all have mock data)
    this.register(mockProvider('MANUAL', 'Temu Trends', temuProducts));
    this.register(mockProvider('MANUAL', 'TikTok Trends', tiktokProducts));
    this.register(mockProvider('MANUAL', 'Amazon Trends', amazonProducts));

    // Data feeds (no auto-search data)
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

  async searchAll(params: ProviderSearchParams): Promise<NormalizedProduct[]> {
    const available = this.getAvailable();
    console.log(`[Registry] Searching ${available.length} available providers`);
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
