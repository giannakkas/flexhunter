// ==============================================
// Configuration with Validation
// ==============================================

import 'dotenv/config';

// ── Strict Env Validation ─────────────────────

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] || fallback;
  if (!val) {
    console.error(`❌ FATAL: Missing required env var: ${key}`);
    if (process.env.NODE_ENV === 'production') {
      // Don't crash in prod — log and use empty string
      return '';
    }
  }
  return val || '';
}

function optionalEnv(key: string, fallback: string = ''): string {
  return process.env[key] || fallback;
}

// ── Config Object ─────────────────────────────

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isDev: process.env.NODE_ENV !== 'production',

  shopify: {
    apiKey: requireEnv('SHOPIFY_API_KEY', 'dev-key'),
    apiSecret: requireEnv('SHOPIFY_API_SECRET', 'dev-secret'),
    scopes: optionalEnv('SHOPIFY_SCOPES', 'read_products,write_products,read_orders').split(','),
    appUrl: optionalEnv('SHOPIFY_APP_URL', 'http://localhost:3000'),
    authCallbackPath: optionalEnv('SHOPIFY_AUTH_CALLBACK_PATH', '/api/auth/callback'),
  },

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  redis: {
    url: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
  },

  ai: {
    geminiKey: optionalEnv('GEMINI_API_KEY'),
    openaiKey: optionalEnv('OPENAI_API_KEY'),
    hasAI: !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
    engine: process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'none',
  },

  providers: {
    rapidApiKey: optionalEnv('RAPIDAPI_KEY'),
    cjApiKey: optionalEnv('CJ_API_KEY'),
    hasProviders: !!(process.env.RAPIDAPI_KEY || process.env.CJ_API_KEY),
  },

  admin: {
    secret: optionalEnv('ADMIN_SECRET'),
    hasAdmin: !!process.env.ADMIN_SECRET,
  },
};

// ── Startup Validation Report ─────────────────

const warnings: string[] = [];
const errors: string[] = [];

if (!config.database.url) errors.push('DATABASE_URL is required');
if (!config.ai.hasAI) warnings.push('No AI configured (set GEMINI_API_KEY or OPENAI_API_KEY)');
if (!config.providers.hasProviders) warnings.push('No product providers (set RAPIDAPI_KEY or CJ_API_KEY)');
if (!config.admin.hasAdmin) warnings.push('ADMIN_SECRET not set — admin panel disabled');
if (!config.shopify.apiKey || config.shopify.apiKey === 'dev-key') warnings.push('SHOPIFY_API_KEY not set');

if (errors.length > 0) {
  console.error('\n❌ Configuration Errors:');
  errors.forEach(e => console.error(`  - ${e}`));
}
if (warnings.length > 0) {
  console.warn('\n⚠️  Configuration Warnings:');
  warnings.forEach(w => console.warn(`  - ${w}`));
}
if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Configuration validated — all required vars present');
}

export const configStatus = { errors, warnings, isValid: errors.length === 0 };
