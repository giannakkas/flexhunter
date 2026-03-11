// ==============================================
// Shopify Billing API
// ==============================================
// Handles subscription creation and management.

import { Router, Request, Response } from 'express';
import prisma from '../utils/db';

const router = Router();

const PLANS = {
  free: { name: 'Free', price: 0, researches: 3, imports: 5 },
  starter: { name: 'Starter', price: 19.99, researches: 20, imports: 50 },
  pro: { name: 'Pro', price: 49.99, researches: -1, imports: -1 },       // unlimited
  enterprise: { name: 'Enterprise', price: 99.99, researches: -1, imports: -1 },
};

async function getShopWithToken(req: Request) {
  const domain = req.headers['x-shop-domain'] as string;
  const shop = await prisma.shop.findFirst({
    where: { shopDomain: { contains: domain?.replace('.myshopify.com', '') || 'unknown' } },
  });
  if (!shop?.accessToken) throw new Error('Shop not found or no token');
  return shop;
}

// ── Get current plan ──────────────────────────
router.get('/billing/plan', async (req: Request, res: Response) => {
  try {
    const shop = await getShopWithToken(req);
    // For now, return free plan (billing not enforced yet)
    res.json({
      success: true,
      data: {
        plan: 'free',
        ...PLANS.free,
        usage: {
          researches: 0, // TODO: count from jobRun
          imports: 0,    // TODO: count from importedProduct
        },
      },
    });
  } catch (err: any) {
    res.json({ success: true, data: { plan: 'free', ...PLANS.free } });
  }
});

// ── Create subscription ──────────────────────
router.post('/billing/subscribe', async (req: Request, res: Response) => {
  try {
    const shop = await getShopWithToken(req);
    const { plan } = req.body;

    if (!plan || !PLANS[plan as keyof typeof PLANS]) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    const planData = PLANS[plan as keyof typeof PLANS];

    if (plan === 'free') {
      return res.json({ success: true, message: 'Already on free plan' });
    }

    // Create Shopify recurring charge via GraphQL
    const mutation = `
      mutation {
        appSubscriptionCreate(
          name: "FlexHunter ${planData.name}"
          lineItems: [{
            plan: {
              appRecurringPricingDetails: {
                price: { amount: ${planData.price}, currencyCode: USD }
              }
            }
          }]
          returnUrl: "${process.env.SHOPIFY_APP_URL}/api/billing/confirm"
          test: true
        ) {
          appSubscription { id }
          confirmationUrl
          userErrors { field message }
        }
      }
    `;

    const gqlRes = await fetch(`https://${shop.shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shop.accessToken!,
      },
      body: JSON.stringify({ query: mutation }),
    });

    const data = await gqlRes.json();
    const result = data?.data?.appSubscriptionCreate;

    if (result?.confirmationUrl) {
      res.json({ success: true, data: { confirmationUrl: result.confirmationUrl } });
    } else {
      res.json({ success: false, error: result?.userErrors?.[0]?.message || 'Failed to create subscription' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Confirm subscription callback ─────────────
router.get('/billing/confirm', async (req: Request, res: Response) => {
  try {
    const { charge_id } = req.query;
    console.log(`[Billing] Subscription confirmed: ${charge_id}`);
    // Redirect back to app
    res.redirect(process.env.SHOPIFY_APP_URL || '/');
  } catch {
    res.redirect('/');
  }
});

// ── Available plans ───────────────────────────
router.get('/billing/plans', (_req: Request, res: Response) => {
  res.json({ success: true, data: PLANS });
});

export default router;
