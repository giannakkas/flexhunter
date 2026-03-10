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
