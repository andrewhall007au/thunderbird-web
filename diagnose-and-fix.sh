#!/bin/bash
# Thunderbird Production Diagnostic and Fix Script
# Run this on production server to diagnose and fix issues

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Thunderbird Production Diagnostics"
echo "=========================================="
echo ""

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check Services
echo "1. Checking Services..."
echo "---"

BACKEND_STATUS=$(systemctl is-active thunderbird-api || echo "inactive")
FRONTEND_STATUS=$(systemctl is-active thunderbird-web || echo "inactive")
MONITORING_STATUS=$(systemctl is-active thunderbird-monitoring || echo "inactive")

print_status $([ "$BACKEND_STATUS" = "active" ] && echo 0 || echo 1) "Backend API: $BACKEND_STATUS"
print_status $([ "$FRONTEND_STATUS" = "active" ] && echo 0 || echo 1) "Frontend Web: $FRONTEND_STATUS"
print_status $([ "$MONITORING_STATUS" = "active" ] && echo 0 || echo 1) "Monitoring: $MONITORING_STATUS"

echo ""

# 2. Check Database
echo "2. Checking Database..."
echo "---"

DB_PATH="/root/thunderbird-web/backend/thunderbird.db"
if [ -f "$DB_PATH" ]; then
    DB_PERMS=$(ls -la "$DB_PATH" | awk '{print $1}')
    DB_OWNER=$(ls -la "$DB_PATH" | awk '{print $3":"$4}')
    echo "Database exists: $DB_PATH"
    echo "Permissions: $DB_PERMS"
    echo "Owner: $DB_OWNER"

    # Check if writable
    if [ -w "$DB_PATH" ]; then
        print_status 0 "Database is writable"
    else
        print_status 1 "Database is NOT writable"
        print_warning "Fixing permissions..."
        chmod 644 "$DB_PATH"
        print_status 0 "Permissions fixed"
    fi
else
    print_status 1 "Database file not found!"
fi

echo ""

# 3. Test API Endpoints
echo "3. Testing API Endpoints..."
echo "---"

# Test health endpoint
HEALTH_RESPONSE=$(curl -s http://localhost:8000/health || echo "FAIL")
if [ "$HEALTH_RESPONSE" != "FAIL" ]; then
    print_status 0 "Health endpoint responding"
else
    print_status 1 "Health endpoint not responding"
fi

# Test beta status endpoint
BETA_STATUS=$(curl -s http://localhost:8000/api/beta/status || echo "FAIL")
if [ "$BETA_STATUS" != "FAIL" ]; then
    print_status 0 "Beta status endpoint responding"
else
    print_status 1 "Beta status endpoint not responding"
fi

# Test beta apply endpoint
echo ""
echo "Testing beta signup endpoint..."
BETA_APPLY=$(curl -s -X POST http://localhost:8000/api/beta/apply \
    -H "Content-Type: application/json" \
    -d '{"name":"Diagnostic Test","email":"diagnostic@test.com","why_interested":"Testing"}' \
    2>&1)

if echo "$BETA_APPLY" | grep -q "error\|Error\|FAIL"; then
    print_status 1 "Beta apply endpoint failing"
    echo "Response: $BETA_APPLY"
else
    print_status 0 "Beta apply endpoint working"
fi

echo ""

# 4. Check Monitoring Status
echo "4. Checking Monitoring Status..."
echo "---"

MONITORING_STATUS=$(curl -s http://localhost:8001/api/monitoring/status 2>&1)
if echo "$MONITORING_STATUS" | grep -q "overall_status"; then
    OVERALL=$(echo "$MONITORING_STATUS" | jq -r '.overall_status' 2>/dev/null || echo "unknown")
    INCIDENTS=$(echo "$MONITORING_STATUS" | jq -r '.active_incidents' 2>/dev/null || echo "unknown")

    echo "Overall Status: $OVERALL"
    echo "Active Incidents: $INCIDENTS"

    # Show failing checks
    echo ""
    echo "Failing Checks:"
    echo "$MONITORING_STATUS" | jq -r '.checks[] | select(.status=="fail") | "  - \(.display_name): \(.error)"' 2>/dev/null || echo "  (Unable to parse)"
else
    print_status 1 "Cannot get monitoring status"
fi

echo ""

# 5. Check Backend Logs for Errors
echo "5. Recent Backend Errors..."
echo "---"

RECENT_ERRORS=$(journalctl -u thunderbird-api -n 20 --no-pager 2>/dev/null | grep -i "error\|exception\|fail" || echo "No recent errors found")
if [ "$RECENT_ERRORS" = "No recent errors found" ]; then
    print_status 0 "No recent errors in backend logs"
else
    print_warning "Recent errors found:"
    echo "$RECENT_ERRORS" | tail -5
fi

echo ""

# 6. Check Alert Configuration
echo "6. Checking Alert Configuration..."
echo "---"

if [ -f /etc/default/thunderbird-monitoring ]; then
    print_status 0 "Alert config file exists"

    ALERT_PHONE=$(grep MONITOR_ALERT_PHONE /etc/default/thunderbird-monitoring | cut -d= -f2)
    ALERT_EMAIL=$(grep MONITOR_ALERT_EMAIL /etc/default/thunderbird-monitoring | cut -d= -f2)
    TWILIO_SID=$(grep TWILIO_ACCOUNT_SID /etc/default/thunderbird-monitoring | cut -d= -f2)

    if [ -n "$ALERT_PHONE" ]; then
        print_status 0 "Alert phone configured: $ALERT_PHONE"
    else
        print_status 1 "Alert phone NOT configured"
    fi

    if [ -n "$TWILIO_SID" ]; then
        print_status 0 "Twilio credentials configured"
    else
        print_status 1 "Twilio credentials NOT configured"
    fi
else
    print_status 1 "Alert config file missing"
fi

echo ""

# 7. Suggested Fixes
echo "=========================================="
echo "Suggested Fixes"
echo "=========================================="
echo ""

NEEDS_FIX=false

if [ "$BACKEND_STATUS" != "active" ]; then
    echo "Backend is not running:"
    echo "  sudo systemctl restart thunderbird-api"
    NEEDS_FIX=true
fi

if [ "$FRONTEND_STATUS" != "active" ]; then
    echo "Frontend is not running:"
    echo "  sudo systemctl restart thunderbird-web"
    NEEDS_FIX=true
fi

if echo "$MONITORING_STATUS" | jq -e '.checks[] | select(.name=="beta_signup_endpoint" and .status=="fail")' >/dev/null 2>&1; then
    echo "Beta signup endpoint is failing - check CORS and SSL config"
    NEEDS_FIX=true
fi

if echo "$MONITORING_STATUS" | jq -e '.checks[] | select(.name=="db_query_performance" and .status=="fail")' >/dev/null 2>&1; then
    echo "Database issues detected - check permissions and locks"
    NEEDS_FIX=true
fi

if [ "$NEEDS_FIX" = false ]; then
    echo -e "${GREEN}✓ No obvious issues found${NC}"
    echo ""
    echo "If you're still experiencing issues, check:"
    echo "  1. Browser console for JavaScript errors"
    echo "  2. CORS configuration (may be blocking frontend)"
    echo "  3. SSL certificates (may have expired)"
else
    echo ""
    echo "Run fixes? (y/n)"
    read -r RUN_FIXES

    if [ "$RUN_FIXES" = "y" ]; then
        echo ""
        echo "Applying fixes..."

        if [ "$BACKEND_STATUS" != "active" ]; then
            systemctl restart thunderbird-api
            print_status 0 "Backend restarted"
        fi

        if [ "$FRONTEND_STATUS" != "active" ]; then
            systemctl restart thunderbird-web
            print_status 0 "Frontend restarted"
        fi

        if [ "$MONITORING_STATUS" != "active" ]; then
            systemctl restart thunderbird-monitoring
            print_status 0 "Monitoring restarted"
        fi

        echo ""
        echo "Waiting 5 seconds for services to start..."
        sleep 5

        echo ""
        echo "Testing endpoints again..."
        curl -s http://localhost:8000/health && print_status 0 "Backend responding" || print_status 1 "Backend not responding"
        curl -s http://localhost:3000 >/dev/null && print_status 0 "Frontend responding" || print_status 1 "Frontend not responding"
    fi
fi

echo ""
echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
echo ""
echo "For detailed logs, run:"
echo "  journalctl -u thunderbird-api -n 50"
echo "  journalctl -u thunderbird-monitoring -n 50"
echo ""
echo "To view monitoring dashboard:"
echo "  curl http://localhost:8001/api/monitoring/status | jq"
echo ""
