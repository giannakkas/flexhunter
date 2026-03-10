#!/bin/bash
# FlexHunter Deploy Script (for VPS / Hetzner)
# Usage: ./scripts/deploy.sh

set -e

echo "=== FlexHunter Deploy ==="
echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm ci

echo "Generating Prisma client..."
npx prisma generate

echo "Running database migrations..."
npx prisma db push

echo "Building..."
npm run build

echo "Restarting services..."
pm2 restart all

echo "=== Deploy complete at $(date) ==="
pm2 status
