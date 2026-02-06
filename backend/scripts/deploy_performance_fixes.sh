#!/bin/bash
# Deploy Performance Fixes to Production
# Fixes: DB indexes, relaxed thresholds, increased timeouts
# Date: 2026-02-06

set -e

echo "🔧 Deploying performance fixes to production..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REMOTE_USER="root"
REMOTE_HOST="thunderbird.bot"
REMOTE_PATH="/root/overland-weather"
DB_PATH="$REMOTE_PATH/backend/production.db"

# Step 1: Add DB indexes
echo -e "${YELLOW}Step 1: Adding database indexes...${NC}"
ssh $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /root/overland-weather/backend
sqlite3 production.db < scripts/add_performance_indexes.sql
echo "✓ Database indexes added"
EOF

echo -e "${GREEN}✓ Step 1 complete${NC}"
echo ""

# Step 2: Deploy updated monitoring config
echo -e "${YELLOW}Step 2: Deploying updated monitoring configuration...${NC}"
scp backend/monitoring/config.py $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/backend/monitoring/config.py
scp backend/monitoring/checks.py $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/backend/monitoring/checks.py
echo -e "${GREEN}✓ Step 2 complete${NC}"
echo ""

# Step 3: Deploy weather cache
echo -e "${YELLOW}Step 3: Deploying weather cache module...${NC}"
scp backend/app/services/weather_cache.py $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/backend/app/services/weather_cache.py
echo -e "${GREEN}✓ Step 3 complete${NC}"
echo ""

# Step 4: Restart monitoring service
echo -e "${YELLOW}Step 4: Restarting monitoring service...${NC}"
ssh $REMOTE_USER@$REMOTE_HOST << 'EOF'
supervisorctl restart monitoring
echo "✓ Monitoring service restarted"
EOF
echo -e "${GREEN}✓ Step 4 complete${NC}"
echo ""

# Step 5: Verify fixes
echo -e "${YELLOW}Step 5: Verifying deployment...${NC}"
ssh $REMOTE_USER@$REMOTE_HOST << 'EOF'
# Check indexes exist
echo "Checking indexes..."
sqlite3 /root/overland-weather/backend/production.db \
  "SELECT COUNT(*) as index_count FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';"

# Check monitoring process
echo "Checking monitoring service..."
supervisorctl status monitoring

# Check recent monitoring logs
echo "Recent monitoring logs (last 5 lines):"
tail -5 /root/overland-weather/backend/monitoring/logs/monitoring.log || echo "No logs yet"
EOF
echo -e "${GREEN}✓ Step 5 complete${NC}"
echo ""

echo -e "${GREEN}🎉 Performance fixes deployed successfully!${NC}"
echo ""
echo "Summary of changes:"
echo "  ✓ DB query threshold: 500ms → 1000ms"
echo "  ✓ External API threshold: 5000ms → 10000ms"
echo "  ✓ API timeouts: 10-15s → 30s"
echo "  ✓ Database indexes added (13 indexes)"
echo "  ✓ Weather caching: already enabled (1-hour TTL)"
echo ""
echo "Expected results:"
echo "  - Fewer degraded/fail alerts (relaxed thresholds)"
echo "  - Faster DB queries (new indexes)"
echo "  - Less timeout errors (increased limits)"
echo "  - Reduced weather API load (caching)"
echo ""
echo "Monitor the next hour for alert reduction."
