import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY!,
    apiSecret: process.env.SHOPIFY_API_SECRET!,
    scopes: (process.env.SHOPIFY_SCOPES || '').split(','),
    appUrl: process.env.SHOPIFY_APP_URL!,
    authCallbackPath: process.env.SHOPIFY_AUTH_CALLBACK_PATH || '/api/auth/callback',
  },

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  ai: {
    openaiKey: process.env.OPENAI_API_KEY!,
    model: process.env.AI_MODEL || 'gpt-4o',
    scoringModel: process.env.AI_SCORING_MODEL || 'gpt-4o-mini',
  },

  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret',
  },

  providers: {
    aliexpressKey: process.env.ALIEXPRESS_API_KEY,
    cjKey: process.env.CJ_API_KEY,
  },
};

// Validate critical config
const required = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) {
    console.warn(`⚠ Missing required env var: ${key}`);
  }
}
