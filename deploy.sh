#!/bin/bash
# 🚀 Quick Deploy Script for Cloud VPS

set -e

echo "🚀 Starting deployment..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "${RED}❌ Docker not found. Installing...${NC}"
    sudo apt update
    sudo apt install -y docker.io docker-compose
    sudo usermod -aG docker $USER
    echo "${GREEN}✅ Docker installed. Please logout and login again.${NC}"
    exit 0
fi

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Build and run
echo "🏗️ Building containers..."
docker-compose down
docker-compose pull
docker-compose up -d --build

# Run migrations
echo "🗄️ Running database migrations..."
sleep 5
docker-compose exec -T backend node config/migrate.js || true

# Health check
echo "🏥 Health check..."
sleep 3
curl -f http://localhost:5000/api/health && echo "${GREEN}✅ API is healthy!${NC}" || echo "${RED}⚠️ API health check failed${NC}"

echo "${GREEN}🎉 Deployment complete!${NC}"
echo "🌐 Frontend: http://$(curl -s ifconfig.me)"
echo "🔌 API: http://$(curl -s ifconfig.me):5000/api"
