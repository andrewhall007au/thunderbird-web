#!/bin/bash
set -e

echo "Deploying country code fix..."

cd /root/thunderbird-web/backend

# Backup files
cp app/models/beta_application.py app/models/beta_application.py.backup
cp app/routers/beta.py app/routers/beta.py.backup

# Fix beta_application.py - add country code mapping
cat > /tmp/patch1.py << 'EOF'
import sys
with open('app/models/beta_application.py', 'r') as f:
    lines = f.readlines()

output = []
for i, line in enumerate(lines):
    output.append(line)
    if line.strip() == ']' and i > 0 and 'SUPPORTED_COUNTRIES' in ''.join(lines[max(0,i-10):i]):
        if 'COUNTRY_CODE_MAP' not in ''.join(lines):
            output.append('\n')
            output.append('COUNTRY_CODE_MAP = {\n')
            output.append('    "AU": "Australia",\n')
            output.append('    "NZ": "New Zealand",\n')
            output.append('    "US": "United States",\n')
            output.append('    "UK": "United Kingdom",\n')
            output.append('    "GB": "United Kingdom",\n')
            output.append('    "CA": "Canada",\n')
            output.append('    "DE": "Germany",\n')
            output.append('    "FR": "France",\n')
            output.append('    "JP": "Japan",\n')
            output.append('    "KR": "South Korea",\n')
            output.append('}\n')
            output.append('\n')
            output.append('def normalize_country(country: str) -> str:\n')
            output.append('    country_clean = country.strip()\n')
            output.append('    for supported in SUPPORTED_COUNTRIES:\n')
            output.append('        if country_clean.lower() == supported.lower():\n')
            output.append('            return supported\n')
            output.append('    country_upper = country_clean.upper()\n')
            output.append('    if country_upper in COUNTRY_CODE_MAP:\n')
            output.append('        return COUNTRY_CODE_MAP[country_upper]\n')
            output.append('    return country_clean\n')

with open('app/models/beta_application.py', 'w') as f:
    f.writelines(output)
print("✓ Updated beta_application.py")
EOF

python3 /tmp/patch1.py

# Fix beta.py - update imports and usage
cat > /tmp/patch2.py << 'EOF'
with open('app/routers/beta.py', 'r') as f:
    content = f.read()

# Update import
content = content.replace(
    'from app.models.beta_application import beta_application_store, SUPPORTED_COUNTRIES',
    'from app.models.beta_application import beta_application_store, SUPPORTED_COUNTRIES, normalize_country'
)

# Add normalization before validation
old = 'def apply_for_beta(request: BetaApplyRequest):\n    """\n    Submit a beta access application.\n\n    Public endpoint - no authentication required.\n    Validates country, checks for duplicate email, stores application,\n    and sends admin notification.\n    """\n    # Validate country\n    if request.country not in SUPPORTED_COUNTRIES:'

new = 'def apply_for_beta(request: BetaApplyRequest):\n    """\n    Submit a beta access application.\n\n    Public endpoint - no authentication required.\n    Validates country, checks for duplicate email, stores application,\n    and sends admin notification.\n    """\n    # Normalize country\n    normalized_country = normalize_country(request.country)\n    \n    # Validate country\n    if normalized_country not in SUPPORTED_COUNTRIES:'

content = content.replace(old, new)

# Use normalized_country in create call
content = content.replace('country=request.country,', 'country=normalized_country,')

with open('app/routers/beta.py', 'w') as f:
    f.write(content)
print("✓ Updated beta.py")
EOF

python3 /tmp/patch2.py

# Restart service
echo "Restarting service..."
systemctl restart thunderbird-api
sleep 3

# Test
echo ""
echo "Testing..."
result=$(curl -s -X POST http://localhost:8000/api/beta/apply \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","country":"AU"}')

if echo "$result" | grep -q "success"; then
    echo "✅ SUCCESS! Country code AU works!"
else
    echo "❌ Test failed: $result"
fi

systemctl status thunderbird-api --no-pager -l

echo ""
echo "Deployment complete!"
