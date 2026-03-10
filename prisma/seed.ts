// ==============================================
// Database Seed - FlexBucket Test Data
// ==============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding FlexBucket test data...');

  // Create shop
  const shop = await prisma.shop.upsert({
    where: { shopDomain: 'flexbucket.myshopify.com' },
    create: {
      shopDomain: 'flexbucket.myshopify.com',
      accessToken: 'dev-token-replace-me',
      name: 'FlexBucket',
      email: 'chris@flexbucket.com',
      currency: 'USD',
      isActive: true,
    },
    update: {},
  });

  console.log(`Shop: ${shop.id}`);

  // Create merchant settings
  await prisma.merchantSettings.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      storeDescription:
        'FlexBucket is a Gen-Z and young adult store selling cool, flex-worthy gadgets, room setup products, LED aesthetic items, gaming desk accessories, TikTok viral gadgets, and creator tools. Products should feel social-media-friendly, visual, and show-off worthy.',
      targetAudience: ['gen-z', 'teenagers', 'young adults', 'gamers', 'creators', 'tiktok users'],
      targetCountries: ['US', 'GB', 'CA', 'AU'],
      preferredCategories: [
        'Room Decor & LED',
        'Gaming Accessories',
        'Tech Gadgets',
        'Desk Setup',
        'Creator Tools',
        'Phone Accessories',
      ],
      bannedCategories: ['Kitchen & Home', 'Pet Products'],
      priceRangeMin: 10,
      priceRangeMax: 80,
      minimumMarginPercent: 35,
      desiredShippingSpeed: 'STANDARD',
      replacementMode: 'HYBRID',
      minTestDays: 7,
      minTestViews: 50,
      autoArchiveOld: true,
      notifyBeforeReplace: true,
      neverReplacePinned: true,
      confidenceThreshold: 0.65,
      approvalThreshold: 0.85,
      revenueProtection: 100,
      approveFirstReplace: true,
      researchFrequencyDays: 3,
      maxCandidatesPerRun: 30,
      autoResearchEnabled: false,
      onboardingComplete: true,
    },
    update: {},
  });

  // Create domain analysis
  await prisma.domainAnalysis.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      domain: 'flexbucket.com',
      extractedWords: ['flex', 'bucket'],
      detectedSlang: ['flex'],
      inferredTone: ['social'],
      inferredAgeGroup: 'gen-z',
      psychographicHints: ['trend-conscious', 'social-media-active', 'likes-to-show-off', 'content-creator'],
      categoryBias: ['gadgets', 'accessories', 'lifestyle', 'tech', 'gaming'],
      domainFitKeywords: ['youth', 'cool', 'showing-off', 'social', 'gadgets', 'accessories', 'lifestyle', 'tech', 'gaming', 'curated', 'variety', 'discovery', 'flex', 'bucket'],
      vibeScore: { youthful: 75, premium: 30, playful: 45, technical: 30, lifestyle: 40, social: 55 },
      semanticAnalysis: {},
    },
    update: {},
  });

  // Create store profile
  await prisma.storeProfile.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      nicheKeywords: ['gen-z gadgets', 'room aesthetic', 'gaming setup', 'led decor', 'viral products', 'desk accessories', 'creator tools', 'flex-worthy'],
      audienceSegments: ['gen-z', 'teenagers', 'young adults', 'gamers', 'creators'],
      toneAttributes: ['edgy', 'fun', 'youthful', 'social-media-native'],
      pricePositioning: 'mid',
      brandVibe: 'A curated Gen-Z treasure chest of flex-worthy gadgets, aesthetic room upgrades, and viral-worthy tech accessories',
      catalogGaps: ['smart home devices', 'portable tech', 'content creation gear', 'wearable accessories'],
      catalogStrengths: ['LED products', 'room decor', 'visual appeal'],
      productCount: 0,
      collectionCount: 0,
      topCategories: [],
      catalogSnapshot: {},
      categoryProfile: {},
    },
    update: {},
  });

  console.log('Seed complete! Shop ID:', shop.id);
  console.log('Save this Shop ID for testing: set x-shop-id header to', shop.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
