# FlexHunter - Shopify Embedded SaaS App

## Intelligent Product Hunter & Catalog Optimizer

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│                  Shopify Admin                    │
│            (FlexHunter Embedded App)              │
│  ┌──────────────────────────────────────────┐    │
│  │          React + Polaris Frontend         │    │
│  │  Dashboard | Research | Candidates |      │    │
│  │  Imports | Replacements | Settings | Audit│    │
│  └──────────────┬───────────────────────────┘    │
└─────────────────┼────────────────────────────────┘
                  │ REST API
┌─────────────────┼────────────────────────────────┐
│  Express Server │                                 │
│  ┌──────────────┴───────────────────────────┐    │
│  │              API Routes                    │    │
│  │  /onboarding /candidates /imports          │    │
│  │  /replacements /settings /research /audit  │    │
│  └──────────────┬───────────────────────────┘    │
│                 │                                  │
│  ┌──────────────┴───────────────────────────┐    │
│  │           Service Layer                    │    │
│  │                                            │    │
│  │  ┌──────────────┐  ┌──────────────────┐   │    │
│  │  │ Domain Intent │  │   Store DNA      │   │    │
│  │  │   Engine      │  │   Engine         │   │    │
│  │  └──────────────┘  └──────────────────┘   │    │
│  │                                            │    │
│  │  ┌──────────────┐  ┌──────────────────┐   │    │
│  │  │  Research     │  │  Scoring         │   │    │
│  │  │  Pipeline     │  │  Engine          │   │    │
│  │  └──────────────┘  └──────────────────┘   │    │
│  │                                            │    │
│  │  ┌──────────────┐  ┌──────────────────┐   │    │
│  │  │ Replacement   │  │  Performance     │   │    │
│  │  │ Engine        │  │  Tracker         │   │    │
│  │  └──────────────┘  └──────────────────┘   │    │
│  │                                            │    │
│  │  ┌──────────────┐  ┌──────────────────┐   │    │
│  │  │  Provider     │  │  Shopify         │   │    │
│  │  │  Registry     │  │  Client          │   │    │
│  │  └──────────────┘  └──────────────────┘   │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
         │                    │
    ┌────┴────┐         ┌────┴────┐
    │ Postgres │         │  Redis  │
    │ (Prisma) │         │ (BullMQ)│
    └─────────┘         └─────────┘
         │
    ┌────┴────┐
    │ Workers  │  ← Separate process
    │ (BullMQ) │
    └─────────┘
```

---

## Folder Structure

```
flexhunter/
├── prisma/
│   ├── schema.prisma          # Complete database schema
│   └── seed.ts                # FlexBucket test data
├── src/
│   ├── server/
│   │   ├── config/
│   │   │   └── index.ts       # Environment config
│   │   ├── routes/
│   │   │   ├── auth.ts        # Shopify OAuth
│   │   │   └── api.ts         # All API endpoints
│   │   ├── middleware/         # Auth, validation middleware
│   │   ├── services/
│   │   │   ├── domain/
│   │   │   │   └── domainEngine.ts     # Domain Intent Engine
│   │   │   ├── store-dna/
│   │   │   │   └── storeDnaEngine.ts   # Store DNA Engine
│   │   │   ├── research/
│   │   │   │   └── researchPipeline.ts # Research orchestrator
│   │   │   ├── scoring/
│   │   │   │   └── scoringEngine.ts    # Multi-dimensional scoring
│   │   │   ├── providers/
│   │   │   │   └── providerRegistry.ts # Source provider adapters
│   │   │   ├── shopify/
│   │   │   │   └── shopifyClient.ts    # Shopify GraphQL client
│   │   │   ├── replacement/
│   │   │   │   └── replacementEngine.ts # Replacement logic
│   │   │   ├── performance/
│   │   │   │   └── performanceTracker.ts # Performance sync
│   │   │   ├── automation/             # Future automation rules
│   │   │   └── jobs/
│   │   │       ├── jobQueue.ts         # Queue definitions + workers
│   │   │       └── worker.ts           # Worker process entry
│   │   ├── utils/
│   │   │   ├── db.ts          # Prisma client
│   │   │   ├── redis.ts       # Redis client
│   │   │   └── ai.ts          # OpenAI wrapper
│   │   └── index.ts           # Express server entry
│   ├── frontend/
│   │   ├── App.tsx            # Root component with routing
│   │   ├── main.tsx           # React entry point
│   │   ├── hooks/
│   │   │   └── useApi.ts      # API hooks
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── OnboardingPage.tsx
│   │   │   ├── ResearchPage.tsx
│   │   │   ├── CandidatesPage.tsx
│   │   │   ├── ImportsPage.tsx
│   │   │   ├── ReplacementsPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── AuditPage.tsx
│   │   └── components/
│   │       └── common/
│   │           └── AppFrame.tsx
│   └── shared/
│       └── types/
│           └── index.ts       # Shared TypeScript types
├── .env.example
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
└── index.html
```

---

## Product Scoring Model

### Weighted Multi-Dimensional Scoring

Each candidate is scored across **11 dimensions**, each normalized to 0-100:

| Dimension        | Weight | Description                                                |
|------------------|--------|------------------------------------------------------------|
| domainFit        | 0.12   | Semantic match between product and domain name signals     |
| storeFit         | 0.12   | Alignment with store niche, categories, and catalog gaps   |
| audienceFit      | 0.14   | Match with target audience segments (Gen-Z, gamers, etc.)  |
| trendFit         | 0.12   | Current trend velocity and novelty (AI-scored)             |
| visualVirality   | 0.10   | Social media shareability and photogenic quality (AI)      |
| novelty          | 0.06   | Product uniqueness vs common items (AI)                    |
| priceFit         | 0.08   | Price within merchant's target range                       |
| marginFit        | 0.10   | Achievable margin vs merchant's minimum                    |
| shippingFit      | 0.06   | Shipping speed vs merchant's preference                    |
| saturationInverse| 0.05   | Lower market saturation = higher score                     |
| refundRiskInverse| 0.05   | Lower estimated refund risk = higher score                 |

### Final Score Formula

```
finalScore = Σ (dimension_score × weight) for all 11 dimensions

Possible range: 0-100
Recommended threshold: 65+ for import consideration
```

### Domain Fit Scoring (the unique differentiator)

```
score = 30 (base)
      + min(30, keyword_overlap_count × 10)    // domain keywords in product text
      + min(20, category_bias_match × 10)       // domain category signals match
      + 10 if (youthful_domain AND youthful_product)
      + 10 if (social_domain AND social_product)
      + 5  if (technical_domain AND technical_product)
```

For "flexbucket.com":
- extractedWords: ["flex", "bucket"]
- detectedSlang: ["flex"] → ageGroup: gen-z, vibes: [youth, cool, showing-off, social]
- categoryBias: [gadgets, accessories, lifestyle, tech, gaming]
- vibeScore: { youthful: 75, social: 55, playful: 45 }

---

## Replacement Decision Logic

### Mode Behaviors

| Mode     | High Confidence (≥ approval threshold) | Low Confidence (≥ confidence threshold) | Below Threshold |
|----------|---------------------------------------|----------------------------------------|-----------------|
| MANUAL   | Suggest only                          | Suggest only                           | No action       |
| AUTO     | Auto-execute                          | Auto-execute                           | No action       |
| HYBRID   | Auto-execute                          | Suggest for review                     | No action       |

### Safety Rules (always enforced)

1. Never auto-replace pinned products
2. Products above revenue protection threshold require approval
3. "Approve first replacement" option for new merchants
4. Never permanently delete—only archive/draft
5. Full audit trail for every decision

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Shopify Partner account
- OpenAI API key

### Quick Start

```bash
# 1. Clone and install
cd flexhunter
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Setup database
npx prisma db push
npm run db:seed

# 4. Start development
npm run dev          # Server + Frontend
npm run worker       # Background workers (separate terminal)
```

### Shopify App Setup

1. Create a new app in Shopify Partners dashboard
2. Set App URL to your ngrok/tunnel URL
3. Set OAuth callback to `{APP_URL}/api/auth/callback`
4. Request scopes: `read_products,write_products,read_orders,read_analytics,read_inventory`
5. Install on FlexBucket dev store

### Testing with FlexBucket

The seed data creates a complete FlexBucket profile with:
- Store description targeting Gen-Z/youth culture
- Domain analysis for "flexbucket.com"
- Pre-configured categories, audience, and scoring preferences
- Hybrid replacement mode with sensible defaults

The Shop ID from the seed output is used as the `x-shop-id` header for API testing.

---

## API Endpoints

| Method | Path                         | Description                        |
|--------|------------------------------|------------------------------------|
| POST   | /api/onboarding              | Complete merchant onboarding       |
| GET    | /api/onboarding/status       | Check onboarding status            |
| GET    | /api/dashboard               | Dashboard stats                    |
| GET    | /api/store-dna               | Load store DNA                     |
| POST   | /api/store-dna/analyze       | Re-analyze store                   |
| POST   | /api/domain/analyze          | Preview domain analysis            |
| POST   | /api/research/start          | Start research pipeline            |
| GET    | /api/research/status         | Research job status                |
| GET    | /api/candidates              | List candidates (with filters)     |
| POST   | /api/candidates/:id/approve  | Approve and import a candidate     |
| POST   | /api/candidates/:id/reject   | Reject a candidate                 |
| POST   | /api/candidates/:id/watchlist| Add to watchlist                   |
| GET    | /api/imports                 | List imported products             |
| POST   | /api/imports/:id/pin         | Pin a product                      |
| POST   | /api/imports/:id/unpin       | Unpin a product                    |
| GET    | /api/replacements            | List replacement decisions         |
| POST   | /api/replacements/:id/approve| Approve a replacement              |
| POST   | /api/replacements/:id/reject | Reject a replacement               |
| GET    | /api/settings                | Get merchant settings              |
| PUT    | /api/settings                | Update settings                    |
| POST   | /api/performance/sync        | Trigger performance sync           |
| GET    | /api/audit                   | Get audit logs                     |
| GET    | /api/jobs                    | List recent job runs               |

---

## Background Jobs

| Queue         | Job Type              | Trigger               | Description                         |
|---------------|-----------------------|-----------------------|-------------------------------------|
| research      | run-research          | Manual / Scheduled    | Full research pipeline              |
| import        | import-product        | Candidate approval    | Import product to Shopify           |
| performance   | sync-perf             | Every 6 hours         | Sync performance metrics            |
| replacement   | evaluate-replacements | Daily at 8 AM         | Find weak products, suggest/execute |
| store-analysis| analyze-store         | On onboarding/manual  | Build store DNA                     |

---

## Future SaaS Roadmap

### Phase 1: Multi-Tenant (Month 2-3)
- Add billing with Shopify Billing API
- Implement plan tiers (Free/Starter/Pro/Enterprise)
- Rate limiting per plan
- Multi-tenant data isolation (already architected)

### Phase 2: Real Providers (Month 3-4)
- AliExpress API integration (Affiliate + Dropship)
- CJ Dropshipping API integration
- CSV/XML feed import with mapping UI
- Product image proxy/caching with S3

### Phase 3: Advanced AI (Month 4-5)
- GPT-4o Vision for product image analysis
- Auto-generate optimized product descriptions
- Competitor monitoring and pricing intelligence
- AI-generated weekly performance reports

### Phase 4: Public Launch (Month 5-6)
- Shopify App Store listing
- App review compliance
- Documentation and support portal
- Onboarding video walkthrough
- Provider marketplace for custom source connectors

### Phase 5: Scale (Month 6+)
- Real-time analytics webhooks
- A/B testing for product variants
- Multi-store management
- White-label option for agencies
