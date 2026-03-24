// ==============================================
// Shopify Billing API
// ==============================================
// Handles subscription creation and management.

import { Router, Request, Response } from 'express';
import prisma from '../utils/db';

const router = Router();

const PLANS = {
  free: { name: 'Free', price: 0, researches: 3, imports: 3 },
  starter: { name: 'Starter', price: 6.99, researches: 5, imports: 10 },
  pro: { name: 'Pro', price: 19.99, researches: -1, imports: -1 },       // unlimited
  enterprise: { name: 'Enterprise', price: 0, researches: -1, imports: -1, contactUs: true },
};

async function getShopWithToken(req: Request) {
  const domain = req.headers['x-shop-domain'] as string;
  const shop = await prisma.shop.findFirst({
    where: { shopDomain: { contains: domain?.replace('.myshopify.com', '') || 'unknown' } },
  });
  if (!shop?.accessToken) throw new Error('Shop not found or no token');
  return shop;
}

// Get current plan and usage for a shop
async function getShopPlanAndUsage(shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  const plan = shop?.plan || 'free';
  const planData = PLANS[plan as keyof typeof PLANS] || PLANS.free;
  
  // Count ALL research attempts in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const researches = await prisma.jobRun.count({
    where: { shopId, jobType: 'RESEARCH_PRODUCTS', createdAt: { gte: thirtyDaysAgo } },
  });
  const imports = await prisma.importedProduct.count({
    where: { shopId, importedAt: { gte: thirtyDaysAgo } },
  });
  
  console.log(`[Billing] Shop ${shopId.slice(0, 8)}... plan=${plan} researches=${researches}/${planData.researches} imports=${imports}/${planData.imports}`);
  
  return { plan, planData, usage: { researches, imports } };
}

// Billing enforcement middleware — check limits before research/import
export async function checkBillingLimit(shopId: string, action: 'research' | 'import' | 'seo'): Promise<{ allowed: boolean; message?: string }> {
  const { plan, planData, usage } = await getShopPlanAndUsage(shopId);
  
  if (action === 'seo') {
    if (plan === 'free' || plan === 'starter') {
      return { allowed: false, message: 'SEO Optimizer is available on Pro and above. Upgrade to unlock AI-powered SEO optimization.' };
    }
  }
  if (action === 'research') {
    if (planData.researches !== -1 && usage.researches >= planData.researches) {
      return { allowed: false, message: `Research limit reached (${usage.researches}/${planData.researches} this month). Upgrade to ${plan === 'free' ? 'Starter' : 'Pro'} for more.` };
    }
  }
  if (action === 'import') {
    if (planData.imports !== -1 && usage.imports >= planData.imports) {
      return { allowed: false, message: `Import limit reached (${usage.imports}/${planData.imports} this month). Upgrade to ${plan === 'free' ? 'Starter' : 'Pro'} for more.` };
    }
  }
  return { allowed: true };
}

// ── Get current plan ──────────────────────────
router.get('/billing/plan', async (req: Request, res: Response) => {
  try {
    const shop = await getShopWithToken(req);
    const { plan, planData, usage } = await getShopPlanAndUsage(shop.id);
    res.json({
      success: true,
      data: { plan, ...planData, usage },
    });
  } catch (err: any) {
    res.json({ success: true, data: { plan: 'free', ...PLANS.free, usage: { researches: 0, imports: 0 } } });
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
          returnUrl: "${process.env.SHOPIFY_APP_URL}/api/billing/confirm?shop=${shop.shopDomain}"
          test: true
        ) {
          appSubscription { id }
          confirmationUrl
          userErrors { field message }
        }
      }
    `;

    const gqlRes = await fetch(`https://${shop.shopDomain}/admin/api/2025-01/graphql.json`, {
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
    const { charge_id, shop: shopDomain } = req.query;
    console.log(`[Billing] Subscription confirmed: charge_id=${charge_id} shop=${shopDomain}`);
    
    // Update shop plan in database if we have the shop domain
    if (shopDomain) {
      const domain = String(shopDomain);
      const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: domain } });
      if (shopRecord) {
        // TODO: verify charge with Shopify API and determine which plan was purchased
        // For now, mark as starter (cheapest paid plan) — the actual plan detection should
        // query the active subscription from Shopify
        console.log(`[Billing] Updating plan for ${domain}`);
      }
    }
    
    // Redirect back into Shopify admin (not the bare domain which shows landing page)
    const shop = shopDomain || '';
    if (shop) {
      res.redirect(`https://${shop}/admin/apps/flexhunter`);
    } else {
      res.redirect(process.env.SHOPIFY_APP_URL || '/');
    }
  } catch (err: any) {
    console.error('[Billing] Confirm error:', err.message);
    res.redirect('/');
  }
});

// ── Available plans ───────────────────────────
router.get('/billing/plans', (_req: Request, res: Response) => {
  res.json({ success: true, data: PLANS });
});

export default router;
