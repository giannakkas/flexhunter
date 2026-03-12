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

// Security: request timeout (90s for research, 30s for everything else)
app.use('/api/research', requestTimeout(90_000));
app.use('/api', requestTimeout(30_000));

// Security: input sanitization
app.use(sanitizeInput);

// ── Routes ─────────────────────────────────────

// Shopify auth (rate limited: 10/min)
app.use('/api/auth', authRateLimit, authRoutes);

// Webhooks (before API routes, no rate limit — Shopify controls the rate)
app.use('/api', webhookRoutes);

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
    ai: process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'none',
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

// Serve frontend in production
if (!config.isDev) {
  const frontendPath = path.join(__dirname, '../../dist/frontend');
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
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
    ai: process.env.GEMINI_API_KEY ? 'Gemini 2.0 Flash' : process.env.OPENAI_API_KEY ? 'OpenAI' : 'none',
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
║  AI:       ${(process.env.GEMINI_API_KEY ? 'Gemini 2.0 Flash' : 'OpenAI/None').padEnd(28)}║
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
