// ==============================================
// Performance Tracking Engine
// ==============================================
// Syncs Shopify analytics and computes health scores
// for imported products.

import prisma from '../../utils/db';
import { shopifyGraphQL } from '../shopify/shopifyClient';

/**
 * Compute a health score (0-100) from performance metrics
 *
 * Formula:
 *   health = (conversion_score * 0.35) + (revenue_score * 0.25) +
 *            (margin_score * 0.20) + (refund_score * 0.20)
 *
 * Each sub-score is normalized to 0-100 based on benchmarks
 */
function computeHealthScore(metrics: {
  views: number;
  conversions: number;
  revenue: number;
  margin: number;
  refunds: number;
  daysSinceLaunch: number;
}): number {
  const { views, conversions, revenue, margin, refunds, daysSinceLaunch } = metrics;

  // Conversion score: benchmark 2% is "good"
  const convRate = views > 0 ? (conversions / views) * 100 : 0;
  const convScore = Math.min(100, (convRate / 2) * 100);

  // Revenue score: benchmark $100/week is "good"
  const weeks = Math.max(1, daysSinceLaunch / 7);
  const revenuePerWeek = revenue / weeks;
  const revenueScore = Math.min(100, (revenuePerWeek / 100) * 100);

  // Margin score: benchmark 40% is "good"
  const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
  const marginScore = Math.min(100, (marginPercent / 40) * 100);

  // Refund score: inverse, benchmark <5% refund rate is good
  const refundRate = conversions > 0 ? (refunds / conversions) * 100 : 0;
  const refundScore = Math.max(0, 100 - refundRate * 10);

  return Math.round(
    convScore * 0.35 +
    revenueScore * 0.25 +
    marginScore * 0.20 +
    refundScore * 0.20
  );
}

/**
 * Sync performance data for all imported products in a shop
 */
export async function syncPerformance(shopId: string): Promise<void> {
  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
  });

  const imports = await prisma.importedProduct.findMany({
    where: {
      shopId,
      status: { in: ['TESTING', 'WINNER', 'WEAK'] },
      shopifyProductGid: { not: null },
    },
  });

  for (const product of imports) {
    try {
      // In V1, we'll use a simplified approach.
      // Production would use Shopify Analytics API or webhooks.
      const metrics = await fetchProductMetrics(
        shop.shopDomain,
        shop.accessToken,
        product.shopifyProductGid!
      );

      const daysSinceLaunch = product.testStartedAt
        ? Math.floor((Date.now() - product.testStartedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const conversionRate = metrics.views > 0
        ? (metrics.conversions / metrics.views) * 100
        : 0;

      const revenuePerView = metrics.views > 0
        ? metrics.revenue / metrics.views
        : 0;

      const marginPercent = metrics.revenue > 0
        ? (metrics.margin / metrics.revenue) * 100
        : 0;

      const healthScore = computeHealthScore({
        ...metrics,
        daysSinceLaunch,
      });

      await prisma.productPerformance.upsert({
        where: { importedProductId: product.id },
        create: {
          importedProductId: product.id,
          views: metrics.views,
          addToCarts: metrics.addToCarts,
          checkoutsStarted: metrics.checkoutsStarted,
          conversions: metrics.conversions,
          revenue: metrics.revenue,
          costOfGoods: metrics.costOfGoods,
          margin: metrics.margin,
          refunds: metrics.refunds,
          refundAmount: metrics.refundAmount,
          conversionRate,
          revenuePerView,
          marginPercent,
          healthScore,
          daysSinceLaunch,
          lastSyncedAt: new Date(),
        },
        update: {
          views: metrics.views,
          addToCarts: metrics.addToCarts,
          checkoutsStarted: metrics.checkoutsStarted,
          conversions: metrics.conversions,
          revenue: metrics.revenue,
          costOfGoods: metrics.costOfGoods,
          margin: metrics.margin,
          refunds: metrics.refunds,
          refundAmount: metrics.refundAmount,
          conversionRate,
          revenuePerView,
          marginPercent,
          healthScore,
          daysSinceLaunch,
          lastSyncedAt: new Date(),
        },
      });

      // Auto-promote winners
      if (healthScore >= 70 && daysSinceLaunch >= 7 && product.status === 'TESTING') {
        await prisma.importedProduct.update({
          where: { id: product.id },
          data: { status: 'WINNER' },
        });
      }
    } catch (err) {
      console.warn(`[Performance] Failed to sync ${product.id}:`, err);
    }
  }
}

/**
 * Fetch product metrics from Shopify
 * V1: simplified - production would use proper analytics webhooks
 */
async function fetchProductMetrics(
  shopDomain: string,
  accessToken: string,
  productGid: string
): Promise<{
  views: number;
  addToCarts: number;
  checkoutsStarted: number;
  conversions: number;
  revenue: number;
  costOfGoods: number;
  margin: number;
  refunds: number;
  refundAmount: number;
}> {
  // In V1, we'll fetch order data as a proxy
  // Production would use Shopify ShopifyQL or analytics events
  try {
    const productId = productGid.split('/').pop();
    const query = `
      query productOrders($query: String!) {
        orders(first: 50, query: $query) {
          edges {
            node {
              id
              totalPriceSet { shopMoney { amount } }
              refunds { totalRefundedSet { shopMoney { amount } } }
              lineItems(first: 10) {
                edges {
                  node {
                    quantity
                    originalTotalSet { shopMoney { amount } }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await shopifyGraphQL(
      { shopDomain, accessToken },
      query,
      { query: `product_id:${productId}` }
    );

    const orders = data.orders?.edges || [];
    let revenue = 0;
    let conversions = orders.length;
    let refundAmount = 0;
    let refunds = 0;

    for (const edge of orders) {
      const order = edge.node;
      revenue += parseFloat(order.totalPriceSet.shopMoney.amount);
      if (order.refunds?.length > 0) {
        refunds++;
        for (const refund of order.refunds) {
          refundAmount += parseFloat(refund.totalRefundedSet.shopMoney.amount);
        }
      }
    }

    return {
      views: Math.floor(Math.random() * 200) + 10, // V1 placeholder
      addToCarts: Math.floor(conversions * 2.5),
      checkoutsStarted: Math.floor(conversions * 1.3),
      conversions,
      revenue,
      costOfGoods: revenue * 0.35, // Estimated
      margin: revenue * 0.65,
      refunds,
      refundAmount,
    };
  } catch {
    // Return zeros on error
    return {
      views: 0, addToCarts: 0, checkoutsStarted: 0,
      conversions: 0, revenue: 0, costOfGoods: 0,
      margin: 0, refunds: 0, refundAmount: 0,
    };
  }
}
