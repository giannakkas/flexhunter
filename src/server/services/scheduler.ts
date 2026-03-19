// ==============================================
// Scheduler — Automated Background Tasks
// ==============================================
// Runs periodic tasks without BullMQ/Redis.
// Simple setInterval-based for single-instance.

import prisma from '../utils/db';
import logger from '../utils/logger';

let schedulerStarted = false;

/**
 * Start all scheduled tasks
 */
export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  logger.info('Scheduler started');

  // ── Auto-research: every 12 hours for active shops ──
  setInterval(async () => {
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) return;

    try {
      const shops = await prisma.shop.findMany({
        where: {
          isActive: true,
          settings: { onboardingComplete: true },
        },
        select: { id: true, shopDomain: true },
      });

      // Find shops that haven't had research in 12+ hours
      for (const shop of shops) {
        const lastResearch = await prisma.jobRun.findFirst({
          where: { shopId: shop.id, jobType: 'RESEARCH_PRODUCTS', status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
        });

        const hoursSince = lastResearch?.completedAt
          ? (Date.now() - lastResearch.completedAt.getTime()) / (1000 * 60 * 60)
          : 999;

        if (hoursSince >= 12) {
          logger.info('Auto-research triggered', { shop: shop.shopDomain, hoursSince: Math.round(hoursSince) });
          try {
            const { runResearchPipeline } = await import('../services/research/researchPipeline');
            await runResearchPipeline(shop.id);

            await prisma.jobRun.create({
              data: {
                shopId: shop.id,
                jobType: 'RESEARCH_PRODUCTS',
                status: 'COMPLETED',
                startedAt: new Date(),
                completedAt: new Date(),
                progress: 100,
              },
            });
          } catch (err: any) {
            logger.error('Auto-research failed', { shop: shop.shopDomain, error: err.message });
          }
        }
      }
    } catch (err: any) {
      logger.error('Scheduler auto-research error', { error: err.message });
    }
  }, 12 * 60 * 60 * 1000); // Every 12 hours

  // ── Auto-sync performance: every 6 hours ──
  setInterval(async () => {
    try {
      const shops = await prisma.shop.findMany({
        where: {
          isActive: true,
          accessToken: { not: 'pending' },
          importedProducts: { some: {} },
        },
        select: { id: true, shopDomain: true },
      });

      for (const shop of shops) {
        try {
          const { syncPerformance } = await import('../services/performance/performanceSync');
          await syncPerformance(shop.id);
        } catch {}
      }

      if (shops.length > 0) {
        logger.info('Auto-sync completed', { shops: shops.length });
      }
    } catch (err: any) {
      logger.error('Scheduler auto-sync error', { error: err.message });
    }
  }, 6 * 60 * 60 * 1000); // Every 6 hours

  // ── Auto-replacement scan: every 24 hours ──
  setInterval(async () => {
    try {
      const shops = await prisma.shop.findMany({
        where: {
          isActive: true,
          importedProducts: { some: { status: { in: ['WEAK', 'TESTING'] } } },
        },
        select: { id: true },
      });

      for (const shop of shops) {
        try {
          const { scanForReplacements } = await import('../services/replacement/autoReplace');
          await scanForReplacements(shop.id);
        } catch {}
      }

      if (shops.length > 0) {
        logger.info('Auto-replacement scan completed', { shops: shops.length });
      }
    } catch {}
  }, 24 * 60 * 60 * 1000); // Every 24 hours
}

/**
 * Register Shopify webhooks for a shop
 */
export async function registerWebhooks(shopDomain: string, accessToken: string): Promise<string[]> {
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (!appUrl || !accessToken || accessToken === 'pending') return [];

  const webhooks = [
    { topic: 'APP_UNINSTALLED', address: `${appUrl}/api/webhooks/app/uninstalled` },
    { topic: 'SHOP_UPDATE', address: `${appUrl}/api/webhooks/shop/update` },
    { topic: 'PRODUCTS_UPDATE', address: `${appUrl}/api/webhooks/products/update` },
    { topic: 'ORDERS_CREATE', address: `${appUrl}/api/webhooks/orders/create` },
  ];

  const registered: string[] = [];

  for (const wh of webhooks) {
    try {
      const mutation = `
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription { id }
            userErrors { field message }
          }
        }
      `;

      const res = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            topic: wh.topic,
            webhookSubscription: {
              callbackUrl: wh.address,
              format: 'JSON',
            },
          },
        }),
      });

      const data = await res.json();
      const errors = data?.data?.webhookSubscriptionCreate?.userErrors;

      if (!errors || errors.length === 0) {
        registered.push(wh.topic);
      } else {
        // Already registered is not an error
        if (errors[0]?.message?.includes('already')) {
          registered.push(wh.topic);
        } else {
          logger.warn('Webhook registration failed', { topic: wh.topic, error: errors[0]?.message });
        }
      }
    } catch (err: any) {
      logger.warn('Webhook registration error', { topic: wh.topic, error: err.message });
    }
  }

  logger.info('Webhooks registered', { shop: shopDomain, topics: registered });
  return registered;
}
