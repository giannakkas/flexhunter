// ==============================================
// Shopify Auth Routes
// ==============================================

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../../config';
import prisma from '../../utils/db';

const router = Router();

/**
 * GET /api/auth
 * Begin Shopify OAuth flow
 */
router.get('/', (req: Request, res: Response) => {
  const { shop } = req.query;
  if (!shop || typeof shop !== 'string') {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const scopes = config.shopify.scopes.join(',');
  const redirectUri = `${config.shopify.appUrl}${config.shopify.authCallbackPath}`;

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${config.shopify.apiKey}&scope=${scopes}&redirect_uri=${redirectUri}&state=${nonce}`;

  // Store nonce in session/cookie for validation (simplified for V1)
  res.cookie('shopify_nonce', nonce, { httpOnly: true, sameSite: 'lax' });
  res.redirect(authUrl);
});

/**
 * GET /api/auth/callback
 * Handle Shopify OAuth callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { shop, code, hmac, state } = req.query;

  if (!shop || !code || !hmac) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Verify HMAC
  const params = { ...req.query };
  delete params.hmac;
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  const hash = crypto
    .createHmac('sha256', config.shopify.apiSecret)
    .update(sortedParams)
    .digest('hex');

  if (hash !== hmac) {
    return res.status(401).json({ error: 'HMAC validation failed' });
  }

  // Exchange code for access token
  try {
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.shopify.apiKey,
        client_secret: config.shopify.apiSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(500).json({ error: 'Failed to get access token' });
    }

    // Fetch shop info
    const shopInfoRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
    const shopInfo = await shopInfoRes.json();

    // Upsert shop record
    await prisma.shop.upsert({
      where: { shopDomain: shop as string },
      create: {
        shopDomain: shop as string,
        accessToken,
        name: shopInfo.shop?.name || shop,
        email: shopInfo.shop?.email,
        plan: shopInfo.shop?.plan_name,
        currency: shopInfo.shop?.currency || 'USD',
        timezone: shopInfo.shop?.iana_timezone,
      },
      update: {
        accessToken,
        name: shopInfo.shop?.name || shop,
        email: shopInfo.shop?.email,
        isActive: true,
        uninstalledAt: null,
      },
    });

    // Redirect to app
    res.redirect(`https://${shop}/admin/apps/${config.shopify.apiKey}`);
  } catch (err) {
    console.error('Auth callback error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
