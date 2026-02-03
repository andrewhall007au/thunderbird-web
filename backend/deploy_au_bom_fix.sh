#!/bin/bash
set -e

echo "================================================"
echo "Deploying AU→BOM Provider Fix"
echo "================================================"
echo ""

# Server configuration
SERVER_USER="root"
SERVER_HOST="your-server-ip-here"  # UPDATE THIS
SERVER_PATH="/root/thunderbird-web"

echo "Target: $SERVER_USER@$SERVER_HOST:$SERVER_PATH"
echo ""

# Step 1: SSH into server and pull changes
echo "Step 1: Pulling latest code from GitHub..."
ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd /root/thunderbird-web
git fetch origin
git pull origin v1.1

# Verify the new files exist
echo ""
echo "Verifying new files..."
if [ -f "backend/app/services/weather/providers/bom.py" ]; then
    echo "✅ BOMProvider file exists"
else
    echo "❌ ERROR: BOMProvider file not found!"
    exit 1
fi

# Check if AU mapping is in router
if grep -q '"AU": BOMProvider()' backend/app/services/weather/router.py; then
    echo "✅ AU→BOM mapping found in router"
else
    echo "❌ ERROR: AU→BOM mapping not found in router!"
    exit 1
fi

echo ""
echo "Step 2: Running tests..."
cd backend
source venv/bin/activate

# Run the new tests
python3 -m pytest tests/test_weather_router.py::TestWeatherRouter::test_provider_mapping_australia -v

if [ $? -ne 0 ]; then
    echo "❌ AU provider test failed!"
    exit 1
fi

echo "✅ AU provider test passed"

# Run spec alignment tests
python3 -m pytest tests/test_spec_alignment.py::TestWeatherProviderSpecAlignment -v

if [ $? -ne 0 ]; then
    echo "❌ Spec alignment tests failed!"
    exit 1
fi

echo "✅ Spec alignment tests passed"

echo ""
echo "Step 3: Restarting service..."
systemctl restart thunderbird-api
sleep 3

# Verify service is running
if systemctl is-active --quiet thunderbird-api; then
    echo "✅ Service restarted successfully"
else
    echo "❌ ERROR: Service failed to restart!"
    systemctl status thunderbird-api --no-pager -l
    exit 1
fi

echo ""
echo "Step 4: Testing AU coordinates..."
# Test with Australian coordinates (Tasmania)
result=$(curl -s -X POST http://localhost:8000/api/test-weather \
  -H "Content-Type: application/json" \
  -d '{"lat": -42.88, "lon": 147.33, "country": "AU"}' || echo "CURL_FAILED")

if echo "$result" | grep -q "BOM"; then
    echo "✅ Australian coordinates using BOM provider!"
    echo "Response: $result"
else
    echo "⚠️  Response: $result"
    echo "Note: If you don't have a test endpoint, verify manually"
fi

echo ""
echo "Step 5: Checking service health..."
curl -s http://localhost:8000/health | jq '.' || echo "Health check response received"

echo ""
echo "================================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Monitor logs: journalctl -u thunderbird-api -f"
echo "2. Test with real Australian coordinates"
echo "3. Check that BOM provider is being used"
echo ""

ENDSSH

echo ""
echo "Deployment script finished!"
echo ""
echo "To verify deployment:"
echo "  ssh $SERVER_USER@$SERVER_HOST"
echo "  journalctl -u thunderbird-api -f"
