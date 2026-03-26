// ==============================================
// Shopify Webhook Handlers
// ==============================================

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../utils/db';

const router = Router();

// ── Webhook Verification ──────────────────────
function verifyWebhook(req: Request): boolean {
  const hmac = req.headers['x-shopify-hmac-sha256'] as string;
  if (!hmac || !process.env.SHOPIFY_API_SECRET) {
    // In dev/testing mode, allow if no secret configured
    if (!process.env.SHOPIFY_API_SECRET) return true;
    return false;
  }

  const body = (req as any).rawBody;
  if (!body) return false;

  try {
    const hash = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
      .update(Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8'))
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'base64'),
      Buffer.from(hash, 'base64')
    );
  } catch {
    return false;
  }
}

// Enforce HMAC on ALL webhook routes
router.use('/webhooks', (req: Request, res: Response, next) => {
  if (!verifyWebhook(req)) {
    console.warn(`[Webhook] HMAC verification FAILED for ${req.path} from ${req.ip}`);
    return res.status(401).send('Unauthorized');
  }
  next();
});

// ── APP_UNINSTALLED ───────────────────────────
router.post('/webhooks/app/uninstalled', async (req: Request, res: Response) => {
  console.log('[Webhook] APP_UNINSTALLED received');
  res.status(200).send('OK');

  try {
    const { myshopify_domain } = req.body;
    if (!myshopify_domain) return;

    const shop = await prisma.shop.findFirst({ where: { shopDomain: myshopify_domain } });
    if (shop) {
      await prisma.shop.update({
        where: { id: shop.id },
        data: { isActive: false, accessToken: null },
      });
      await prisma.auditLog.create({
        data: { shopId: shop.id, action: 'APP_UNINSTALLED', explanation: `${myshopify_domain} uninstalled the app` },
      });
      console.log(`[Webhook] Deactivated shop: ${myshopify_domain}`);
    }
  } catch (err: any) {
    console.error('[Webhook] APP_UNINSTALLED error:', err.message);
  }
});

// ── SHOP_UPDATE ───────────────────────────────
router.post('/webhooks/shop/update', async (req: Request, res: Response) => {
  console.log('[Webhook] SHOP_UPDATE received');
  res.status(200).send('OK');

  try {
    const { myshopify_domain, name, email, currency } = req.body;
    if (!myshopify_domain) return;

    const shop = await prisma.shop.findFirst({ where: { shopDomain: myshopify_domain } });
    if (shop) {
      await prisma.shop.update({
        where: { id: shop.id },
        data: { name: name || shop.name },
      });
    }
  } catch (err: any) {
    console.error('[Webhook] SHOP_UPDATE error:', err.message);
  }
});

// ── PRODUCTS_UPDATE ───────────────────────────
router.post('/webhooks/products/update', async (req: Request, res: Response) => {
  console.log('[Webhook] PRODUCTS_UPDATE received');
  res.status(200).send('OK');

  try {
    const { id: shopifyProductId, title, status } = req.body;
    if (!shopifyProductId) return;

    const imported = await prisma.importedProduct.findFirst({
      where: { shopifyProductId: String(shopifyProductId) },
    });

    if (imported) {
      await prisma.importedProduct.update({
        where: { id: imported.id },
        data: {
          importedTitle: title || imported.importedTitle,
          shopifyStatus: status?.toUpperCase() || imported.shopifyStatus,
        },
      });
      console.log(`[Webhook] Updated imported product: ${title}`);
    }
  } catch (err: any) {
    console.error('[Webhook] PRODUCTS_UPDATE error:', err.message);
  }
});

// ── ORDERS_CREATE ─────────────────────────────
router.post('/webhooks/orders/create', async (req: Request, res: Response) => {
  console.log('[Webhook] ORDERS_CREATE received');
  res.status(200).send('OK');

  try {
    const { line_items, total_price } = req.body;
    if (!line_items) return;

    for (const item of line_items) {
      const imported = await prisma.importedProduct.findFirst({
        where: { shopifyProductId: String(item.product_id) },
      });

      if (imported) {
        // Update performance
        await prisma.productPerformance.upsert({
          where: { importedProductId: imported.id },
          create: {
            importedProductId: imported.id,
            conversions: 1,
            revenue: parseFloat(item.price || '0') * (item.quantity || 1),
            views: 0,
            addToCarts: 0,
            checkoutsStarted: 0,
          },
          update: {
            conversions: { increment: 1 },
            revenue: { increment: parseFloat(item.price || '0') * (item.quantity || 1) },
          },
        });
        console.log(`[Webhook] Order tracked for "${imported.importedTitle}"`);
      }
    }
  } catch (err: any) {
    console.error('[Webhook] ORDERS_CREATE error:', err.message);
  }
});

export default router;

// ==============================================
// GDPR Mandatory Compliance Webhooks (Required for App Store)
// ==============================================
// Registered in shopify.app.toml as:
//   [[webhooks.subscriptions]]
//     compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
//     uri = "/api/webhooks/compliance"
// Shopify sends ALL compliance topics to this single endpoint.
// The topic is in the X-Shopify-Topic header.

export const gdprRouter = Router();

// Single compliance webhook endpoint with HMAC verification
gdprRouter.post('/webhooks/compliance', async (req: Request, res: Response) => {
  // Step 1: Verify HMAC signature
  const hmac = req.headers['x-shopify-hmac-sha256'] as string;
  const secret = process.env.SHOPIFY_API_SECRET;
  
  if (hmac && secret) {
    const body = (req as any).rawBody;
    if (!body) {
      console.warn('[Compliance] No rawBody — rejecting');
      return res.status(401).send('Unauthorized');
    }
    try {
      const hash = crypto
        .createHmac('sha256', secret)
        .update(Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8'))
        .digest('base64');
      const valid = crypto.timingSafeEqual(
        Buffer.from(hmac, 'base64'),
        Buffer.from(hash, 'base64')
      );
      if (!valid) {
        console.warn('[Compliance] HMAC mismatch — rejecting');
        return res.status(401).send('Unauthorized');
      }
    } catch {
      console.warn('[Compliance] HMAC verification error — rejecting');
      return res.status(401).send('Unauthorized');
    }
  } else if (secret && !hmac) {
    // Secret is configured but no HMAC header — reject
    console.warn('[Compliance] No HMAC header — rejecting');
    return res.status(401).send('Unauthorized');
  }

  // Step 2: Respond immediately with 200
  res.status(200).send('OK');

  // Step 3: Process based on topic
  const topic = req.headers['x-shopify-topic'] as string || '';
  const { shop_domain, customer } = req.body || {};
  console.log(`[Compliance] Received topic=${topic} shop=${shop_domain}`);

  try {
    if (topic === 'customers/data_request') {
      console.log(`[Compliance] Data request for customer ${customer?.id} from ${shop_domain}`);
      // FlexHunter does NOT store customer PII — only product data.
      await prisma.auditLog.create({
        data: {
          shopId: (await prisma.shop.findFirst({ where: { shopDomain: shop_domain } }))?.id || 'unknown',
          action: 'GDPR_DATA_REQUEST',
          explanation: `Customer data request for customer ${customer?.id}. No customer PII stored.`,
        },
      }).catch(() => {});

    } else if (topic === 'customers/redact') {
      console.log(`[Compliance] Redact customer ${customer?.id} from ${shop_domain}`);
      // FlexHunter does NOT store customer PII — nothing to erase.
      await prisma.auditLog.create({
        data: {
          shopId: (await prisma.shop.findFirst({ where: { shopDomain: shop_domain } }))?.id || 'unknown',
          action: 'GDPR_CUSTOMER_REDACT',
          explanation: `Customer ${customer?.id} redacted. No customer PII was stored.`,
        },
      }).catch(() => {});

    } else if (topic === 'shop/redact') {
      console.log(`[Compliance] Shop redact for ${shop_domain} — deleting all data`);
      const shop = await prisma.shop.findFirst({ where: { shopDomain: shop_domain } });
      if (!shop) return;
      const shopId = shop.id;

      // Delete everything for this shop in correct FK order
      const imports = await prisma.importedProduct.findMany({ where: { shopId }, select: { id: true } });
      for (const imp of imports) {
        await prisma.productPerformance.deleteMany({ where: { importedProductId: imp.id } }).catch(() => {});
        await prisma.productPin.deleteMany({ where: { importedProductId: imp.id } }).catch(() => {});
      }
      await prisma.replacementDecision.deleteMany({ where: { shopId } }).catch(() => {});
      await prisma.importedProduct.deleteMany({ where: { shopId } }).catch(() => {});
      
      const candidates = await prisma.candidateProduct.findMany({ where: { shopId }, select: { id: true } });
      for (const c of candidates) {
        await prisma.candidateScore.deleteMany({ where: { candidateId: c.id } }).catch(() => {});
        await prisma.productWatchlist.deleteMany({ where: { candidateId: c.id } }).catch(() => {});
      }
      await prisma.candidateProduct.deleteMany({ where: { shopId } }).catch(() => {});
      await prisma.automationRule.deleteMany({ where: { shopId } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { shopId } }).catch(() => {});
      await prisma.jobRun.deleteMany({ where: { shopId } }).catch(() => {});
      await prisma.storeProfile.deleteMany({ where: { shopId } }).catch(() => {});
      await prisma.domainAnalysis.deleteMany({ where: { shopId } }).catch(() => {});
      await prisma.merchantSettings.deleteMany({ where: { shopId } }).catch(() => {});
      await prisma.shop.delete({ where: { id: shopId } }).catch(() => {});

      console.log(`[Compliance] All data deleted for ${shop_domain}`);
    } else {
      console.warn(`[Compliance] Unknown topic: ${topic}`);
    }
  } catch (err: any) {
    console.error(`[Compliance] Error processing ${topic}: ${err.message}`);
  }
});
