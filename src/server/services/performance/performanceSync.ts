// ==============================================
// Performance Sync — Pull metrics from Shopify
// ==============================================

import prisma from '../../utils/db';

/**
 * Sync performance data for all imported products of a shop
 */
export async function syncPerformance(shopId: string): Promise<{ synced: number; weak: number }> {
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
  if (!shop.accessToken || shop.accessToken === 'pending') {
    throw new Error('No Shopify access token');
  }

  const imports = await prisma.importedProduct.findMany({
    where: { shopId, shopifyStatus: { not: 'MOCK' } },
    include: { performance: true },
  });

  let synced = 0;
  let weak = 0;

  for (const imp of imports) {
    if (!imp.shopifyProductId) continue;

    try {
      // Fetch product from Shopify via GraphQL
      const { fetchShopifyProduct } = await import('../shopify/shopifyClient');
      const gid = imp.shopifyProductGid || `gid://shopify/Product/${imp.shopifyProductId}`;
      const product = await fetchShopifyProduct(shop.shopDomain, shop.accessToken!, gid);

      if (!product) {
        // Product deleted from Shopify
        await prisma.importedProduct.update({
          where: { id: imp.id },
          data: { shopifyStatus: 'DELETED' },
        });
        continue;
      }

      // Calculate health score based on available data
      const daysSinceImport = Math.floor((Date.now() - new Date(imp.importedAt).getTime()) / 86400000);
      const perf = imp.performance;
      const orders = perf?.conversions || 0;
      const revenue = perf?.revenue || 0;

      // Health scoring
      let healthScore = 50; // baseline
      if (daysSinceImport > 7) {
        if (orders > 0) healthScore += 20;
        if (orders > 5) healthScore += 15;
        if (revenue > 100) healthScore += 15;
        if (orders === 0 && daysSinceImport > 14) healthScore -= 30; // no sales after 2 weeks
      }
      healthScore = Math.min(100, Math.max(0, healthScore));

      // Determine status
      let status = imp.status;
      if (daysSinceImport > 14 && orders === 0) {
        status = 'WEAK';
        weak++;
      } else if (orders > 5 || revenue > 200) {
        status = 'WINNER';
      }

      // Upsert performance
      await prisma.productPerformance.upsert({
        where: { importedProductId: imp.id },
        create: {
          importedProductId: imp.id,
          views: 0,
          addToCarts: 0,
          checkoutsStarted: 0,
          conversions: orders,
          revenue,
          healthScore,
          lastSyncedAt: new Date(),
        },
        update: {
          healthScore,
          lastSyncedAt: new Date(),
        },
      });

      // Update status if changed
      if (status !== imp.status) {
        await prisma.importedProduct.update({
          where: { id: imp.id },
          data: { status: status as any },
        });
      }

      synced++;
    } catch (err: any) {
      console.warn(`[PerfSync] Failed for ${imp.shopifyProductId}: ${err.message}`);
    }
  }

  console.log(`[PerfSync] Synced ${synced} products, ${weak} weak detected`);
  return { synced, weak };
}
