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

const app = express();

// ── Middleware ──────────────────────────────────

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ── Routes ─────────────────────────────────────

// Shopify auth
app.use('/api/auth', authRoutes);

// API routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: config.isDev ? err.message : 'Internal server error',
  });
});

// ── Start Server ───────────────────────────────

app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════╗
║          FlexHunter Server v1.0          ║
║──────────────────────────────────────────║
║  Port:     ${config.port}                          ║
║  Env:      ${config.nodeEnv.padEnd(28)}║
║  Shopify:  ${config.shopify.appUrl ? '✓ configured' : '✗ missing'}                    ║
╚══════════════════════════════════════════╝
  `);
});

export default app;
