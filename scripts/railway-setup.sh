#!/bin/bash
# ==============================================
# FlexHunter - Railway Auto-Setup Script
# ==============================================
# Run this on your local machine (Mac/Linux).
# It creates PostgreSQL, Redis, server service,
# worker service, and configures all variables.
#
# Prerequisites:
#   npm install -g @railway/cli
#   railway login
#
# Usage:
#   chmod +x railway-setup.sh
#   ./railway-setup.sh
# ==============================================

set -e

RAILWAY_TOKEN="4252e0cb-5002-44a2-b3ed-338f3290aeff"
PROJECT_ID="9d9f683b-1efb-4d0d-8a71-4ae02147bef4"
API="https://backboard.railway.com/graphql/v2"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     FlexHunter Railway Setup Script      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

# Helper function for Railway GraphQL API
railway_api() {
  local query="$1"
  curl -s -X POST "$API" \
    -H "Authorization: Bearer $RAILWAY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$query"
}

# ── Step 1: Get project info ────────────────────
echo -e "${YELLOW}[1/8] Checking project...${NC}"
PROJECT_INFO=$(railway_api "{\"query\":\"{ project(id: \\\"$PROJECT_ID\\\") { name environments { edges { node { id name } } } } }\"}")
echo "Project: $(echo $PROJECT_INFO | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['project']['name'])" 2>/dev/null || echo 'flexhunter')"

# Get the production environment ID
ENV_ID=$(echo $PROJECT_INFO | python3 -c "
import sys, json
data = json.load(sys.stdin)
edges = data['data']['project']['environments']['edges']
for e in edges:
    if e['node']['name'] == 'production':
        print(e['node']['id'])
        break
" 2>/dev/null)

if [ -z "$ENV_ID" ]; then
  echo -e "${RED}Could not find production environment. Using first available.${NC}"
  ENV_ID=$(echo $PROJECT_INFO | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['project']['environments']['edges'][0]['node']['id'])
" 2>/dev/null)
fi
echo "Environment ID: $ENV_ID"

# ── Step 2: Create PostgreSQL ───────────────────
echo ""
echo -e "${YELLOW}[2/8] Creating PostgreSQL database...${NC}"
PG_RESULT=$(railway_api "{\"query\":\"mutation { serviceCreate(input: { name: \\\"PostgreSQL\\\", projectId: \\\"$PROJECT_ID\\\", source: { image: \\\"ghcr.io/railwayapp-templates/postgres-ssl:16\\\" } }) { id name } }\"}")
PG_SERVICE_ID=$(echo $PG_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['serviceCreate']['id'])" 2>/dev/null)

if [ -z "$PG_SERVICE_ID" ]; then
  echo -e "${RED}Failed to create PostgreSQL. It may already exist.${NC}"
  echo "Raw: $PG_RESULT"
  echo ""
  echo -e "${YELLOW}Trying template-based PostgreSQL instead...${NC}"
  # Alternative: use Railway's built-in plugin
  PG_RESULT=$(railway_api "{\"query\":\"mutation { serviceCreate(input: { name: \\\"postgres\\\", projectId: \\\"$PROJECT_ID\\\" }) { id name } }\"}")
  PG_SERVICE_ID=$(echo $PG_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['serviceCreate']['id'])" 2>/dev/null)
fi
echo "PostgreSQL service: $PG_SERVICE_ID"

# ── Step 3: Create Redis ────────────────────────
echo ""
echo -e "${YELLOW}[3/8] Creating Redis...${NC}"
REDIS_RESULT=$(railway_api "{\"query\":\"mutation { serviceCreate(input: { name: \\\"Redis\\\", projectId: \\\"$PROJECT_ID\\\", source: { image: \\\"bitnami/redis:7.2\\\" } }) { id name } }\"}")
REDIS_SERVICE_ID=$(echo $REDIS_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['serviceCreate']['id'])" 2>/dev/null)
echo "Redis service: $REDIS_SERVICE_ID"

# ── Step 4: Create Server service (from GitHub) ─
echo ""
echo -e "${YELLOW}[4/8] Creating server service from GitHub...${NC}"
SERVER_RESULT=$(railway_api "{\"query\":\"mutation { serviceCreate(input: { name: \\\"flexhunter-server\\\", projectId: \\\"$PROJECT_ID\\\", source: { repo: \\\"giannakkas/flexhunter\\\" } }) { id name } }\"}")
SERVER_SERVICE_ID=$(echo $SERVER_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['serviceCreate']['id'])" 2>/dev/null)
echo "Server service: $SERVER_SERVICE_ID"

# ── Step 5: Create Worker service (from GitHub) ─
echo ""
echo -e "${YELLOW}[5/8] Creating worker service from GitHub...${NC}"
WORKER_RESULT=$(railway_api "{\"query\":\"mutation { serviceCreate(input: { name: \\\"flexhunter-worker\\\", projectId: \\\"$PROJECT_ID\\\", source: { repo: \\\"giannakkas/flexhunter\\\" } }) { id name } }\"}")
WORKER_SERVICE_ID=$(echo $WORKER_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['serviceCreate']['id'])" 2>/dev/null)
echo "Worker service: $WORKER_SERVICE_ID"

# ── Step 6: Generate domain for server ──────────
echo ""
echo -e "${YELLOW}[6/8] Generating public domain for server...${NC}"
DOMAIN_RESULT=$(railway_api "{\"query\":\"mutation { serviceDomainCreate(input: { serviceId: \\\"$SERVER_SERVICE_ID\\\", environmentId: \\\"$ENV_ID\\\" }) { domain } }\"}")
DOMAIN=$(echo $DOMAIN_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['serviceDomainCreate']['domain'])" 2>/dev/null)
echo -e "${GREEN}Server domain: https://$DOMAIN${NC}"

# ── Step 7: Set environment variables ───────────
echo ""
echo -e "${YELLOW}[7/8] Setting environment variables...${NC}"
echo ""
echo -e "${RED}═══════════════════════════════════════════${NC}"
echo -e "${RED}  I need a few values from you:            ${NC}"
echo -e "${RED}═══════════════════════════════════════════${NC}"
echo ""

read -p "Enter your SHOPIFY_API_KEY: " SHOPIFY_KEY
read -p "Enter your SHOPIFY_API_SECRET: " SHOPIFY_SECRET
read -p "Enter your OPENAI_API_KEY: " OPENAI_KEY

SESSION_SECRET=$(openssl rand -hex 32)

# Build variables string for server
VARS="DATABASE_URL=\${{PostgreSQL.DATABASE_URL}}
REDIS_URL=\${{Redis.REDIS_URL}}
SHOPIFY_API_KEY=$SHOPIFY_KEY
SHOPIFY_API_SECRET=$SHOPIFY_SECRET
SHOPIFY_SCOPES=read_products,write_products,read_orders,read_analytics,read_inventory
SHOPIFY_APP_URL=https://$DOMAIN
SHOPIFY_AUTH_CALLBACK_PATH=/api/auth/callback
OPENAI_API_KEY=$OPENAI_KEY
AI_MODEL=gpt-4o
AI_SCORING_MODEL=gpt-4o-mini
NODE_ENV=production
PORT=3000
SESSION_SECRET=$SESSION_SECRET"

echo "Setting variables on server service..."
while IFS= read -r line; do
  KEY=$(echo "$line" | cut -d= -f1)
  VALUE=$(echo "$line" | cut -d= -f2-)
  # Escape for JSON
  VALUE_ESC=$(echo "$VALUE" | sed 's/\\/\\\\/g; s/"/\\"/g')
  railway_api "{\"query\":\"mutation { variableUpsert(input: { projectId: \\\"$PROJECT_ID\\\", environmentId: \\\"$ENV_ID\\\", serviceId: \\\"$SERVER_SERVICE_ID\\\", name: \\\"$KEY\\\", value: \\\"$VALUE_ESC\\\" }) }\"}" > /dev/null 2>&1
  echo "  ✓ $KEY"
done <<< "$VARS"

echo ""
echo "Setting variables on worker service..."
while IFS= read -r line; do
  KEY=$(echo "$line" | cut -d= -f1)
  VALUE=$(echo "$line" | cut -d= -f2-)
  VALUE_ESC=$(echo "$VALUE" | sed 's/\\/\\\\/g; s/"/\\"/g')
  railway_api "{\"query\":\"mutation { variableUpsert(input: { projectId: \\\"$PROJECT_ID\\\", environmentId: \\\"$ENV_ID\\\", serviceId: \\\"$WORKER_SERVICE_ID\\\", name: \\\"$KEY\\\", value: \\\"$VALUE_ESC\\\" }) }\"}" > /dev/null 2>&1
  echo "  ✓ $KEY"
done <<< "$VARS"

# Set worker to use Dockerfile.worker
echo ""
echo "Configuring worker to use Dockerfile.worker..."
railway_api "{\"query\":\"mutation { variableUpsert(input: { projectId: \\\"$PROJECT_ID\\\", environmentId: \\\"$ENV_ID\\\", serviceId: \\\"$WORKER_SERVICE_ID\\\", name: \\\"RAILWAY_DOCKERFILE_PATH\\\", value: \\\"Dockerfile.worker\\\" }) }\"}" > /dev/null 2>&1
echo "  ✓ RAILWAY_DOCKERFILE_PATH=Dockerfile.worker"

# ── Step 8: Summary ─────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Setup Complete!                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "Services created:"
echo "  PostgreSQL:  $PG_SERVICE_ID"
echo "  Redis:       $REDIS_SERVICE_ID"
echo "  Server:      $SERVER_SERVICE_ID"
echo "  Worker:      $WORKER_SERVICE_ID"
echo ""
echo -e "Server URL: ${GREEN}https://$DOMAIN${NC}"
echo ""
echo "═══════════════════════════════════════════"
echo "NEXT STEPS:"
echo "═══════════════════════════════════════════"
echo ""
echo "1. Go to Railway dashboard and verify all 4 services are deploying"
echo "   https://railway.com/project/$PROJECT_ID"
echo ""
echo "2. Update your Shopify App settings:"
echo "   - App URL: https://$DOMAIN"
echo "   - Redirect URL: https://$DOMAIN/api/auth/callback"
echo ""
echo "3. Once deployed, test:"
echo "   curl https://$DOMAIN/health"
echo ""
echo "4. Install the app on FlexBucket from Shopify Partners"
echo ""
echo -e "${RED}5. CHANGE YOUR RAILWAY TOKEN NOW!${NC}"
echo ""
