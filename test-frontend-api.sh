#!/bin/bash
# Test Frontend API Connection (What Browser Sees)
# This simulates browser requests to find CORS/SSL issues

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "Frontend API Connection Test"
echo "Testing from browser perspective"
echo "=========================================="
echo ""

print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Test 1: Public HTTPS endpoint (what browser uses)
echo "1. Testing Public HTTPS API Endpoint..."
echo "---"

HTTPS_HEALTH=$(curl -sk https://thunderbird.bot/api/health 2>&1)
if echo "$HTTPS_HEALTH" | grep -q "error\|Error\|curl"; then
    print_status 1 "HTTPS health endpoint failed"
    echo "Error: $HTTPS_HEALTH"
else
    print_status 0 "HTTPS health endpoint working"
fi

echo ""

# Test 2: Beta signup from public URL
echo "2. Testing Beta Signup (Public HTTPS)..."
echo "---"

BETA_RESPONSE=$(curl -sk -X POST https://thunderbird.bot/api/beta/apply \
    -H "Content-Type: application/json" \
    -H "Origin: https://thunderbird.bot" \
    -d '{"name":"Test User","email":"autotest@example.com","why_interested":"Automated test"}' \
    -w "\nHTTP_CODE:%{http_code}" 2>&1)

HTTP_CODE=$(echo "$BETA_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
RESPONSE_BODY=$(echo "$BETA_RESPONSE" | sed '/HTTP_CODE/d')

echo "HTTP Status: $HTTP_CODE"
echo "Response: $RESPONSE_BODY"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    print_status 0 "Beta signup working via HTTPS"
elif [ "$HTTP_CODE" = "409" ]; then
    print_status 0 "Beta signup working (email already exists)"
else
    print_status 1 "Beta signup failing via HTTPS"
fi

echo ""

# Test 3: Check CORS headers
echo "3. Testing CORS Headers..."
echo "---"

CORS_TEST=$(curl -sk -X OPTIONS https://thunderbird.bot/api/beta/apply \
    -H "Origin: https://thunderbird.bot" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    -v 2>&1)

if echo "$CORS_TEST" | grep -q "access-control-allow-origin"; then
    CORS_ORIGIN=$(echo "$CORS_TEST" | grep -i "access-control-allow-origin" | head -1)
    print_status 0 "CORS headers present"
    echo "  $CORS_ORIGIN"
else
    print_status 1 "CORS headers missing or blocked"
    echo "  This will cause browser requests to fail"
fi

echo ""

# Test 4: Check SSL certificate
echo "4. Checking SSL Certificate..."
echo "---"

SSL_CHECK=$(curl -vI https://thunderbird.bot 2>&1)

if echo "$SSL_CHECK" | grep -q "SSL certificate problem"; then
    print_status 1 "SSL certificate issue detected"
    echo "$SSL_CHECK" | grep "SSL certificate"
elif echo "$SSL_CHECK" | grep -q "SSL connection"; then
    print_status 0 "SSL certificate valid"
else
    print_status 1 "Could not verify SSL certificate"
fi

echo ""

# Test 5: Check frontend configuration
echo "5. Checking Frontend API Configuration..."
echo "---"

# Check Next.js config for API URL
if [ -f /root/thunderbird-web/next.config.js ]; then
    print_status 0 "Next.js config exists"

    # Check for API URL configuration
    if grep -q "NEXT_PUBLIC_API_URL" /root/thunderbird-web/next.config.js; then
        API_URL=$(grep "NEXT_PUBLIC_API_URL" /root/thunderbird-web/next.config.js)
        echo "  API URL: $API_URL"
    fi

    # Check for rewrites/proxy
    if grep -q "rewrites" /root/thunderbird-web/next.config.js; then
        print_status 0 "API proxy configured"
        grep -A 10 "rewrites" /root/thunderbird-web/next.config.js | head -15
    fi
else
    print_status 1 "Next.js config not found"
fi

echo ""

# Test 6: Check if frontend can reach backend
echo "6. Testing Frontend → Backend Connection..."
echo "---"

# Check if Next.js is configured to proxy API requests
PROXY_TEST=$(curl -sk https://thunderbird.bot/api/health 2>&1)
if echo "$PROXY_TEST" | grep -q "healthy\|ok"; then
    print_status 0 "Frontend can reach backend API"
else
    print_status 1 "Frontend cannot reach backend API"
    echo "Response: $PROXY_TEST"
fi

echo ""

# Test 7: Simulate browser request exactly
echo "7. Simulating Exact Browser Request..."
echo "---"

BROWSER_SIM=$(curl -sk -X POST https://thunderbird.bot/api/beta/apply \
    -H "Content-Type: application/json" \
    -H "Origin: https://thunderbird.bot" \
    -H "Referer: https://thunderbird.bot/" \
    -H "User-Agent: Mozilla/5.0" \
    -d '{"name":"Browser Test","email":"browsertest@example.com","why_interested":"Browser simulation"}' \
    -w "\nHTTP_CODE:%{http_code}" \
    -v 2>&1)

BROWSER_HTTP_CODE=$(echo "$BROWSER_SIM" | grep "HTTP_CODE" | cut -d: -f2)
echo "Browser simulation HTTP code: $BROWSER_HTTP_CODE"

if [ "$BROWSER_HTTP_CODE" = "200" ] || [ "$BROWSER_HTTP_CODE" = "201" ] || [ "$BROWSER_HTTP_CODE" = "409" ]; then
    print_status 0 "Browser simulation successful"
    echo ""
    echo -e "${GREEN}The API works from browser perspective!${NC}"
    echo ""
    echo "If you're still seeing errors in the browser, check:"
    echo "  1. Browser console for JavaScript errors"
    echo "  2. Frontend code making the API call"
    echo "  3. Any client-side validation blocking the request"
else
    print_status 1 "Browser simulation failed"
    echo ""
    echo "Response details:"
    echo "$BROWSER_SIM" | grep -v "HTTP_CODE" | tail -20
fi

echo ""

# Test 8: Check nginx configuration
echo "8. Checking Nginx Configuration..."
echo "---"

if nginx -t 2>&1 | grep -q "successful"; then
    print_status 0 "Nginx config valid"
else
    print_status 1 "Nginx config has errors"
    nginx -t 2>&1
fi

# Check if API is proxied correctly
if grep -q "location /api" /etc/nginx/sites-enabled/default 2>/dev/null; then
    print_status 0 "API proxy configured in nginx"
else
    print_status 1 "API proxy NOT found in nginx config"
    echo "  Backend may not be accessible from frontend"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""

# Determine root cause
if [ "$BROWSER_HTTP_CODE" = "200" ] || [ "$BROWSER_HTTP_CODE" = "201" ] || [ "$BROWSER_HTTP_CODE" = "409" ]; then
    echo -e "${GREEN}Backend API is working correctly!${NC}"
    echo ""
    echo "The issue is likely in the frontend JavaScript code."
    echo ""
    echo "Possible causes:"
    echo "  1. Frontend using wrong API endpoint URL"
    echo "  2. Frontend validation preventing form submission"
    echo "  3. JavaScript error before request is made"
    echo "  4. Async/await or promise handling issue"
    echo ""
    echo "Next steps:"
    echo "  1. Check browser console (F12) for JavaScript errors"
    echo "  2. Check frontend code: app/beta/page.tsx or similar"
    echo "  3. Check API client code: lib/api.ts or fetch calls"
else
    echo -e "${RED}Backend API has issues${NC}"
    echo ""
    echo "Detected issues:"
    [ "$HTTP_CODE" != "200" ] && echo "  - HTTPS endpoint returning $HTTP_CODE"
    ! echo "$CORS_TEST" | grep -q "access-control-allow-origin" && echo "  - CORS headers missing"
    echo "$SSL_CHECK" | grep -q "SSL certificate problem" && echo "  - SSL certificate problem"
    echo ""
    echo "Run: bash diagnose-and-fix.sh"
fi

echo ""
