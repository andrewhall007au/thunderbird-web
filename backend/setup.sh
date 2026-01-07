#!/bin/bash
# ============================================================================
# Thunderbird Setup Script
# Run this after creating your .env file
# ============================================================================

set -e

echo "⚡ Thunderbird Setup"
echo "===================="
echo ""

# Check for .env file
if [ ! -f ".env" ]; then
    echo "❌ No .env file found!"
    echo ""
    echo "Please create one:"
    echo "  cp .env.template .env"
    echo "  nano .env  # Fill in your values"
    echo ""
    exit 1
fi

# Source the .env file
set -a
source .env
set +a

# Validate required variables
MISSING=""

if [ -z "$ADMIN_PASSWORD" ] || [ "$ADMIN_PASSWORD" = "your-secure-password-here" ]; then
    MISSING="$MISSING\n  - ADMIN_PASSWORD"
fi

if [ -z "$TWILIO_ACCOUNT_SID" ] || [ "$TWILIO_ACCOUNT_SID" = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" ]; then
    MISSING="$MISSING\n  - TWILIO_ACCOUNT_SID"
fi

if [ -z "$TWILIO_AUTH_TOKEN" ] || [ "$TWILIO_AUTH_TOKEN" = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" ]; then
    MISSING="$MISSING\n  - TWILIO_AUTH_TOKEN"
fi

if [ -z "$TWILIO_PHONE_NUMBER" ] || [ "$TWILIO_PHONE_NUMBER" = "+61xxxxxxxxx" ]; then
    MISSING="$MISSING\n  - TWILIO_PHONE_NUMBER"
fi

if [ -n "$MISSING" ]; then
    echo "❌ Missing or placeholder values found:"
    echo -e "$MISSING"
    echo ""
    echo "Please edit .env and fill in real values."
    exit 1
fi

echo "✓ ADMIN_PASSWORD is set"
echo "✓ TWILIO_ACCOUNT_SID is set (${TWILIO_ACCOUNT_SID:0:10}...)"
echo "✓ TWILIO_AUTH_TOKEN is set (hidden)"
echo "✓ TWILIO_PHONE_NUMBER is set ($TWILIO_PHONE_NUMBER)"
echo ""

# Test Python imports
echo "Testing Python setup..."
python -c "from app.main import app; print('✓ App imports successfully')"
echo ""

# Offer to run the server
echo "Setup complete! To start the server:"
echo ""
echo "  uvicorn app.main:app --reload --port 8000"
echo ""
echo "Then open: http://localhost:8000/admin"
echo "Password: (your ADMIN_PASSWORD)"
echo ""
