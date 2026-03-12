// ==============================================
// Route Registry — All FlexHunter API Endpoints
// ==============================================
// This documents every endpoint across all route files.
// New routes should be added to the appropriate file below.

/*
FILE: src/server/routes/api.ts (main router — 54 endpoints)
═══════════════════════════════════════════════════════════
  Onboarding:
    POST /api/onboarding
    GET  /api/onboarding/status

  Dashboard:
    GET  /api/dashboard

  Store DNA:
    GET  /api/store-dna
    PUT  /api/store-dna
    POST /api/store-dna/simple-save
    POST /api/store-dna/ai-suggest
    POST /api/store-dna/analyze
    POST /api/domain/analyze

  Research:
    POST /api/research/start
    GET  /api/research/status

  Candidates:
    GET  /api/candidates
    GET  /api/candidates/selected-count
    POST /api/candidates/:id/select
    POST /api/candidates/:id/unselect
    POST /api/candidates/:id/approve
    POST /api/candidates/:id/reject
    POST /api/candidates/:id/watchlist
    POST /api/candidates/reset
    DELETE /api/candidates/:id

  Imports:
    GET  /api/imports
    POST /api/imports/:id/pin
    POST /api/imports/:id/unpin
    DELETE /api/imports/:id
    DELETE /api/imports

  Replacements:
    GET  /api/replacements
    POST /api/replacements/:id/approve
    POST /api/replacements/:id/reject
    POST /api/replacements/scan

  Settings:
    GET  /api/settings
    PUT  /api/settings

  Performance:
    POST /api/performance/sync

  Scoring:
    POST /api/scoring/recalibrate
    GET  /api/scoring/trace/:candidateId
    POST /api/scoring/compare
    POST /api/scoring/tournament

  Trends:
    POST /api/trends/analyze
    GET  /api/trends/keyword/:keyword

  SEO:
    POST /api/seo/optimize/:importedProductId
    POST /api/seo/apply/:importedProductId

  Suppliers:
    GET  /api/suppliers
    POST /api/suppliers/toggle

  Notifications:
    GET  /api/notifications
    GET  /api/notifications/unread
    POST /api/notifications/:id/read
    POST /api/notifications/read-all

  System:
    GET  /api/audit
    GET  /api/jobs
    GET  /api/shop-status
    GET  /api/connect-shopify
    POST /api/setup-token
    POST /api/fix-token
    POST /api/provider-request
    GET  /api/debug/shop

FILE: src/server/routes/auth.ts (Shopify OAuth)
════════════════════════════════════════════════
    GET  /api/auth
    GET  /api/auth/callback

FILE: src/server/routes/webhooks.ts (Shopify Webhooks)
══════════════════════════════════════════════════════
    POST /api/webhooks/app/uninstalled
    POST /api/webhooks/shop/update
    POST /api/webhooks/products/update
    POST /api/webhooks/orders/create

FILE: src/server/routes/billing.ts (Billing API)
═════════════════════════════════════════════════
    GET  /api/billing/plan
    GET  /api/billing/plans
    POST /api/billing/subscribe
    GET  /api/billing/confirm

FILE: src/server/routes/admin.ts (Admin Panel)
══════════════════════════════════════════════
    GET  /api/admin/overview
    GET  /api/admin/shops
    GET  /api/admin/shops/:id
    POST /api/admin/shops/:id/research
    POST /api/admin/shops/:id/sync
    POST /api/admin/shops/:id/replacement-scan
    POST /api/admin/shops/:id/recalibrate
    POST /api/admin/shops/:id/deactivate
    GET  /api/admin/scoring-trace/:candidateId
    GET  /api/admin/config
    GET  /api/admin/api-health
    GET  /api/admin/api-metrics
    GET  /api/admin/api-timeline
    GET  /api/admin/jobs
    GET  /api/admin/stats
    GET  /api/admin/export/:type
    POST /api/admin/cache/flush

TOTAL: ~90 endpoints across 5 route files
*/

export const ROUTE_SUMMARY = {
  totalEndpoints: 90,
  files: ['api.ts', 'auth.ts', 'webhooks.ts', 'billing.ts', 'admin.ts'],
  modules: [
    'Onboarding', 'Dashboard', 'Store DNA', 'Research', 'Candidates',
    'Imports', 'Replacements', 'Settings', 'Performance', 'Scoring',
    'Trends', 'SEO', 'Suppliers', 'Notifications', 'System',
    'Auth', 'Webhooks', 'Billing', 'Admin',
  ],
};
