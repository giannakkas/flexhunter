# FlexHunter

**Intelligent Product Hunter & Catalog Optimizer for Shopify**

A Shopify embedded SaaS app that deeply researches products, recommends best-fit items based on your store's DNA and domain identity, imports them, tracks performance, and supports manual/automatic/hybrid product replacement.

## Quick Start

```bash
npm install
cp .env.example .env    # Configure your credentials
npx prisma db push
npm run db:seed
npm run dev              # Terminal 1: Server + Frontend
npm run worker           # Terminal 2: Background jobs
```

## Key Features

- **Store DNA Engine** – Extracts your store's identity from description, domain, catalog, and audience
- **Domain Intent Engine** – Analyzes your domain name semantically (e.g., "flexbucket.com" → Gen-Z, flex-worthy, social gadgets)
- **Deep Research Pipeline** – Multi-source product discovery with 11-dimension scoring
- **AI-Enriched Scoring** – Visual virality, trend fit, and explainable recommendations
- **Shopify Integration** – Import, tag, draft/publish, and archive products via GraphQL
- **Performance Tracking** – Health scores, conversion rates, revenue monitoring
- **Smart Replacement** – Manual, automatic, or hybrid modes with safety guardrails
- **Full Audit Trail** – Every recommendation and decision explained

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for complete documentation.
