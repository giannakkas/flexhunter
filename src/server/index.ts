// ==============================================
// FlexHunter - Server Entry Point
// ==============================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import webhookRoutes from './routes/webhooks';
import { gdprRouter } from './routes/webhooks';
import billingRoutes from './routes/billing';
import adminRoutes from './routes/admin';
import { apiRateLimit, authRateLimit, requestTimeout, sanitizeInput } from './middleware/security';
import { apiMetricsMiddleware } from './middleware/apiMetrics';
import logger from './utils/logger';

const app = express();

// ── Middleware ──────────────────────────────────

// Raw body capture for webhook verification (before json parser)
app.use('/api/webhooks', express.raw({ type: 'application/json' }), (req: any, _res, next) => {
  req.rawBody = req.body;
  if (Buffer.isBuffer(req.body)) req.body = JSON.parse(req.body.toString());
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Structured request logging
app.use(logger.requestLogger());

// API metrics collection
app.use('/api', apiMetricsMiddleware());

// Security: request timeout (5min for research, 30s for everything else)
app.use('/api/research', requestTimeout(300_000));
app.use('/api', requestTimeout(30_000));

// Security: input sanitization
app.use(sanitizeInput);

// Security: Shopify App Store required headers (anti-clickjacking)
app.use((req, res, next) => {
  // Content-Security-Policy: allow embedding only in Shopify admin
  res.setHeader('Content-Security-Policy', "frame-ancestors https://*.myshopify.com https://admin.shopify.com;");
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
});

// ── Routes ─────────────────────────────────────

// Shopify auth (rate limited: 10/min)
app.use('/api/auth', authRateLimit, authRoutes);

// Webhooks (before API routes, no rate limit — Shopify controls the rate)
app.use('/api', webhookRoutes);

// GDPR mandatory webhooks
app.use('/api', gdprRouter);

// Billing
app.use('/api', billingRoutes);

// Admin panel (protected by ADMIN_SECRET)
app.use('/api/admin', adminRoutes);

// API routes (rate limited: 120/min)
app.use('/api', apiRateLimit, apiRoutes);

// Health check
app.get('/health', async (_req, res) => {
  const { default: cache } = await import('./utils/cache');
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    cache: cache.isRedisAvailable() ? 'redis' : 'memory',
    ai: process.env.DEEPSEEK_API_KEY ? 'deepseek' : process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'claude' : process.env.GEMINI_API_KEY ? 'gemini' : 'none',
    providers: {
      aliexpress: !!process.env.RAPIDAPI_KEY,
      cj: !!process.env.CJ_API_KEY,
      trends: !!process.env.RAPIDAPI_KEY,
    },
  });
});

// Direct token setup page - visit /setup in browser
app.get('/setup', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>FlexHunter Setup</title>
<style>body{font-family:system-ui;max-width:500px;margin:60px auto;padding:20px}
h1{color:#1a1a2e}input{width:100%;padding:12px;font-size:16px;border:2px solid #ddd;border-radius:8px;margin:10px 0;box-sizing:border-box}
button{width:100%;padding:14px;background:#008060;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;font-weight:bold}
button:hover{background:#006e52}.msg{font-size:18px;font-weight:bold;margin-top:16px;display:none}
.ok{color:#008060}.err{color:#d72c0d}ol{line-height:1.8}</style></head>
<body>
<h1>FlexHunter Setup</h1>
<p>This page connects FlexHunter to your Shopify store.</p>
<ol>
<li>Go to <a href="https://admin.shopify.com/store/flexbucket-storefront-zz71k/settings/apps/development" target="_blank"><b>Develop Apps</b></a></li>
<li>Click on <b>FlexHunter API</b></li>
<li>Click <b>API credentials</b> tab</li>
<li>Copy the <b>Admin API access token</b></li>
<li>Paste below and click Save</li>
</ol>
<input id="t" placeholder="shpat_xxxxx or shpua_xxxxx..." />
<button onclick="save()">Save Token & Connect</button>
<p class="msg ok" id="ok">Token saved! Go back to FlexHunter and try importing.</p>
<p class="msg err" id="err"></p>
<script>
async function save(){
  var t=document.getElementById('t').value.trim();
  if(!t){alert('Paste a token first');return}
  try{
    var r=await fetch('/api/fix-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:t})});
    var d=await r.json();
    if(d.success){document.getElementById('ok').style.display='block';document.getElementById('err').style.display='none'}
    else{document.getElementById('err').innerText='Error: '+d.error;document.getElementById('err').style.display='block'}
  }catch(e){document.getElementById('err').innerText='Error: '+e.message;document.getElementById('err').style.display='block'}
}
</script></body></html>`);
});

// Privacy Policy — required for App Store submission
app.get('/privacy', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FlexHunter — Privacy Policy</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1a1a2e;line-height:1.7}
h1{font-size:28px;margin-bottom:8px}h2{font-size:20px;margin-top:32px;color:#16213E}
.updated{color:#6B7280;font-size:14px;margin-bottom:32px}
a{color:#007ACE}p{margin:12px 0}
.back{display:inline-block;margin-top:32px;padding:10px 24px;background:#1a1a2e;color:white;text-decoration:none;border-radius:8px;font-weight:600}
</style></head><body>
<h1>Privacy Policy</h1>
<p class="updated">Last updated: March 19, 2026</p>

<p>FlexHunter ("we", "our", "us") is a Shopify embedded app that helps merchants discover, analyze, and import winning products for their stores. This privacy policy explains what data we collect and how we use it.</p>

<h2>1. Data We Collect</h2>
<p><strong>Store Information:</strong> When you install FlexHunter, we access your Shopify store name, email, domain, and currency through the Shopify API. This is required for the app to function.</p>
<p><strong>Product Data:</strong> We store product research results, AI-generated scores, imported product details, and performance metrics (views, orders, revenue) within our database.</p>
<p><strong>Store DNA / Preferences:</strong> You provide your store description, target audience, preferred categories, and price ranges to customize product research. This data is stored in our database.</p>
<p><strong>We do NOT collect:</strong> Customer personal information, payment details, browsing history, or any data about your customers' end users. FlexHunter operates exclusively with product and store-level data.</p>

<h2>2. How We Use Your Data</h2>
<p>Your data is used solely to provide FlexHunter's services: AI-powered product research, scoring, trend analysis, and Shopify product management. We do not sell, rent, or share your data with third parties for marketing purposes.</p>
<p><strong>Third-party AI services:</strong> Product descriptions and titles (not customer data) are sent to AI providers (DeepSeek, OpenAI, Anthropic, Google) for scoring and analysis. These services process data according to their own privacy policies.</p>
<p><strong>Third-party product APIs:</strong> We query AliExpress and CJ Dropshipping APIs to find products. Only search keywords derived from your store description are sent to these services.</p>

<h2>3. Data Storage and Security</h2>
<p>Your data is stored in a PostgreSQL database hosted on Railway (US-based infrastructure). All data is encrypted in transit via HTTPS/TLS. Access to the database is restricted to the application only.</p>

<h2>4. Data Retention</h2>
<p>We retain your data for as long as you have FlexHunter installed. When you uninstall the app, your store is deactivated. Within 48 hours of uninstallation, Shopify sends a shop/redact webhook, and we permanently delete all data associated with your store.</p>

<h2>5. Your Rights</h2>
<p>You can request a copy of your data or request deletion at any time by contacting us. Under GDPR, you have the right to access, rectify, and erase your personal data. Under CCPA, California residents have the right to know what data is collected and to request deletion.</p>

<h2>6. GDPR and CCPA Compliance</h2>
<p>FlexHunter complies with Shopify's mandatory GDPR webhooks. We respond to customer data requests, customer data erasure requests, and shop data erasure requests as required by Shopify's platform policies and applicable privacy laws.</p>

<h2>7. Cookies</h2>
<p>FlexHunter does not use third-party cookies. We use Shopify's session token authentication for embedded app functionality. No tracking cookies are set.</p>

<h2>8. Changes to This Policy</h2>
<p>We may update this policy from time to time. Changes will be posted on this page with an updated "Last updated" date. Continued use of FlexHunter after changes constitutes acceptance of the revised policy.</p>

<h2>9. Contact</h2>
<p>For privacy-related questions, data requests, or concerns:</p>
<p>Email: <a href="mailto:info@flexhunter.app">info@flexhunter.app</a></p>
<p>FlexHunter is operated by Christos Giannakkas, based in Cyprus.</p>

<a class="back" href="/">← Back to FlexHunter</a>
</body></html>`);
});

// Terms of Service
app.get('/terms', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FlexHunter — Terms of Service</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1a1a2e;line-height:1.7}
h1{font-size:28px;margin-bottom:8px}h2{font-size:20px;margin-top:32px;color:#16213E}
.updated{color:#6B7280;font-size:14px;margin-bottom:32px}
a{color:#007ACE}p{margin:12px 0}
.back{display:inline-block;margin-top:32px;padding:10px 24px;background:#1a1a2e;color:white;text-decoration:none;border-radius:8px;font-weight:600}
</style></head><body>
<h1>Terms of Service</h1>
<p class="updated">Last updated: March 19, 2026</p>

<p>By installing and using FlexHunter ("the App"), you agree to these Terms of Service.</p>

<h2>1. Description of Service</h2>
<p>FlexHunter is an AI-powered product research and discovery tool for Shopify merchants. The App searches third-party supplier APIs, scores products using artificial intelligence, and allows merchants to import selected products to their Shopify store.</p>

<h2>2. Account and Access</h2>
<p>You must have a valid Shopify store to use FlexHunter. By installing the App, you authorize FlexHunter to access your store's product and order data through the Shopify API as described in our Privacy Policy.</p>

<h2>3. Pricing and Billing</h2>
<p>FlexHunter offers a free tier and paid subscription plans. All paid charges are processed through Shopify's Billing API. Subscription details, limits, and pricing are displayed within the App on the Plans & Pricing page. You may cancel your subscription at any time through your Shopify admin.</p>

<h2>4. Product Data and Accuracy</h2>
<p>Product information (pricing, availability, images, ratings) is sourced from third-party supplier APIs including AliExpress and CJ Dropshipping. FlexHunter does not guarantee the accuracy, availability, or quality of products displayed. AI-generated scores and recommendations are estimates and should not be the sole basis for business decisions. Always verify product details with the original supplier before selling.</p>

<h2>5. AI-Generated Content</h2>
<p>FlexHunter uses AI services to generate product scores, SEO descriptions, and trend analyses. AI-generated content may contain inaccuracies. You are responsible for reviewing and editing any content before publishing it on your store.</p>

<h2>6. Limitation of Liability</h2>
<p>FlexHunter is provided "as is" without warranties of any kind. We are not liable for any lost profits, revenue, or business opportunities arising from the use of the App, inaccurate product data, or AI-generated recommendations. Our total liability shall not exceed the amount you paid for the App in the preceding 12 months.</p>

<h2>7. Prohibited Uses</h2>
<p>You may not use FlexHunter to sell prohibited products, engage in fraudulent activity, or violate any applicable laws. You must comply with Shopify's Acceptable Use Policy and the terms of any third-party suppliers.</p>

<h2>8. Termination</h2>
<p>You may uninstall FlexHunter at any time through your Shopify admin. We reserve the right to suspend or terminate access to the App for violations of these terms. Upon uninstallation, your data will be deleted as described in our Privacy Policy.</p>

<h2>9. Changes to Terms</h2>
<p>We may update these terms from time to time. Continued use of FlexHunter after changes constitutes acceptance of the revised terms.</p>

<h2>10. Contact</h2>
<p>Email: <a href="mailto:info@flexhunter.app">info@flexhunter.app</a></p>
<p>FlexHunter is operated by Christos Giannakkas, based in Cyprus.</p>

<a class="back" href="/">← Back to FlexHunter</a>
</body></html>`);
});

// Serve frontend in production
if (!config.isDev) {
  const frontendPath = path.join(__dirname, '../../dist/frontend');
  const publicPath = path.join(__dirname, '../../public');
  
  // Public pages — accessible to everyone without auth
  const publicPages = new Set(['/', '/privacy', '/terms', '/health', '/setup']);
  
  // Landing page for direct visitors
  app.get('/', (req, res, next) => {
    const isShopify = req.query.shop || req.query.host || req.query.hmac;
    if (isShopify) return next();
    res.sendFile(path.join(publicPath, 'landing.html'));
  });

  // Static assets (JS/CSS/images)
  app.use(express.static(publicPath));
  app.use(express.static(frontendPath, { index: false }));
  
  // App routes — STRICT Shopify-only access
  app.get('*', (req, res) => {
    // Public pages always accessible
    if (publicPages.has(req.path)) {
      return res.sendFile(path.join(frontendPath, 'index.html'));
    }
    
    // Static assets always served
    if (req.path.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|map|json)$/)) {
      return res.sendFile(path.join(frontendPath, 'index.html'));
    }
    
    // Shopify embedded app context — REQUIRED for all app routes
    const hasShopifyParams = req.query.shop || req.query.host || req.query.hmac || req.query.id_token;
    
    // Also allow if loaded inside Shopify iframe (referer check)
    const referer = req.headers.referer || '';
    const fromShopifyAdmin = referer.includes('admin.shopify.com') || 
                              (referer.includes('myshopify.com') && referer.includes('/admin'));
    
    if (hasShopifyParams || fromShopifyAdmin) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.sendFile(path.join(frontendPath, 'index.html'));
    }
    
    // Not from Shopify — serve redirect page (not res.redirect to avoid caching issues)
    console.log(`[Access] BLOCKED ${req.path} — no Shopify context (referer: ${referer.slice(0, 50) || 'none'})`);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/"><title>Redirecting...</title></head><body><p>Redirecting to <a href="/">FlexHunter</a>...</p><script>window.location.href="/";</script></body></html>`);
  });
}

// ── Error Handler ──────────────────────────────

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || 500;
  logger.error('Unhandled request error', { method: req.method, path: req.path, status, error: err.message });
  if (config.isDev && err.stack) console.error(err.stack);

  if (!res.headersSent) {
    res.status(status).json({
      success: false,
      error: config.isDev ? err.message : 'Internal server error',
    });
  }
});

process.on('unhandledRejection', (reason: any) => {
  logger.fatal('Unhandled Promise Rejection', { error: reason?.message || String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught Exception', { error: err.message, stack: err.stack });
});

// ── Start Server ───────────────────────────────

app.listen(config.port, async () => {
  const { default: cache } = await import('./utils/cache');

  logger.info('FlexHunter server started', {
    port: config.port,
    env: config.nodeEnv,
    ai: process.env.DEEPSEEK_API_KEY ? 'DeepSeek V3' : process.env.OPENAI_API_KEY ? 'OpenAI GPT-4o' : process.env.ANTHROPIC_API_KEY ? 'Claude Sonnet' : process.env.GEMINI_API_KEY ? 'Gemini Flash' : 'none',
    cache: cache.isRedisAvailable() ? 'Redis' : 'in-memory',
    providers: [
      process.env.RAPIDAPI_KEY ? 'AliExpress' : null,
      process.env.CJ_API_KEY ? 'CJ Dropshipping' : null,
    ].filter(Boolean).join(', ') || 'none',
  });

  console.log(`
╔══════════════════════════════════════════╗
║        FlexHunter Server v2.0           ║
║──────────────────────────────────────────║
║  Port:     ${config.port}                          ║
║  Env:      ${config.nodeEnv.padEnd(28)}║
║  AI:       ${(process.env.DEEPSEEK_API_KEY ? 'DeepSeek V3 (primary)' : process.env.OPENAI_API_KEY ? 'OpenAI GPT-4o' : 'No AI key!').padEnd(28)}║
║  Cache:    ${(cache.isRedisAvailable() ? 'Redis' : 'In-Memory').padEnd(28)}║
║  Shopify:  ${config.shopify.appUrl ? '✓ configured' : '✗ missing'}                    ║
║  Admin:    ${process.env.ADMIN_SECRET ? '✓ protected' : '✗ no ADMIN_SECRET'}                    ║
╚══════════════════════════════════════════╝
  `);

  // Start automated scheduler (auto-research, auto-sync, auto-replacement)
  try {
    const { startScheduler } = await import('./services/scheduler');
    startScheduler();
  } catch (err: any) {
    logger.warn('Scheduler failed to start', { error: err.message });
  }
});

export default app;
