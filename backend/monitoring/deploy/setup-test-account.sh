#!/bin/bash
# Create a monitoring test account on production
# Run ON the production server or remotely with:
#   ssh root@thunderbird.bot 'bash -s' < setup-test-account.sh
#
# Idempotent — will skip creation if account already exists.

set -e

PRODUCTION_URL="${MONITOR_PRODUCTION_URL:-https://thunderbird.bot}"
ENV_FILE="/etc/default/thunderbird-monitoring"
TEST_EMAIL="monitor@thunderbird.bot"
TEST_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

echo "=========================================="
echo "Setting up monitoring test account"
echo "=========================================="
echo "URL: $PRODUCTION_URL"
echo "Email: $TEST_EMAIL"

# Check if credentials already exist in env file
if grep -q "^MONITOR_TEST_EMAIL=" "$ENV_FILE" 2>/dev/null; then
    echo ""
    echo "Monitoring test credentials already configured in $ENV_FILE"
    echo "To recreate, remove MONITOR_TEST_EMAIL and MONITOR_TEST_PASSWORD first."
    exit 0
fi

# Try to register the test account
echo ""
echo "Creating test account..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$PRODUCTION_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"name\": \"Monitoring Bot\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "Account created successfully"
elif [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "409" ] || [ "$HTTP_CODE" = "422" ]; then
    # Account likely already exists — check if it's a duplicate error
    if echo "$BODY" | grep -qi "already\|exists\|duplicate\|registered"; then
        echo "Account already exists — skipping creation"
        echo ""
        echo "If you need to reset the password, do it manually and update $ENV_FILE"
        exit 0
    else
        echo "Registration failed: HTTP $HTTP_CODE"
        echo "$BODY"
        exit 1
    fi
else
    echo "Registration failed: HTTP $HTTP_CODE"
    echo "$BODY"
    exit 1
fi

# Verify login works
echo "Verifying login..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$PRODUCTION_URL/auth/token" \
    -d "username=$TEST_EMAIL&password=$TEST_PASSWORD")

LOGIN_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)

if [ "$LOGIN_CODE" = "200" ]; then
    echo "Login verified successfully"
else
    echo "WARNING: Login verification failed (HTTP $LOGIN_CODE)"
    echo "The account was created but login may need manual verification"
fi

# Append credentials to env file
echo ""
echo "Saving credentials to $ENV_FILE..."
cat >> "$ENV_FILE" << EOF

# Monitoring test account (created $(date +%Y-%m-%d))
MONITOR_TEST_EMAIL=$TEST_EMAIL
MONITOR_TEST_PASSWORD=$TEST_PASSWORD
EOF

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Restart the monitoring service to pick up new credentials:"
echo "  systemctl restart thunderbird-monitoring"
