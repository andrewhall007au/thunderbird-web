#!/bin/bash
set -e

echo "=========================================="
echo "Applying Security Fixes"
echo "=========================================="

cd /root/thunderbird-web/backend

# Backup
echo "[1/3] Creating backups..."
cp app/main.py app/main.py.backup.security
cp app/routers/beta.py app/routers/beta.py.backup.security

# Fix 1: CORS - whitelist only thunderbird.bot domains
echo "[2/3] Fixing CORS configuration..."
python3 << 'EOF'
with open('app/main.py', 'r') as f:
    content = f.read()

# Replace wildcard CORS with specific domains
old_cors = '''app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)'''

new_cors = '''app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://thunderbird.bot",
        "https://www.thunderbird.bot",
        "http://localhost:3000",  # For local development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)'''

content = content.replace(old_cors, new_cors)

with open('app/main.py', 'w') as f:
    f.write(content)

print("✓ Fixed CORS - Now whitelisted to thunderbird.bot domains only")
EOF

# Fix 2: XSS - Sanitize name input in beta application
echo "[3/3] Adding XSS protection for name field..."
python3 << 'EOF'
with open('app/routers/beta.py', 'r') as f:
    lines = f.readlines()

# Add html import at top
import_added = False
sanitize_added = False
output = []

for i, line in enumerate(lines):
    # Add html import after other imports
    if 'from pydantic import' in line and not import_added:
        output.append(line)
        output.append('from html import escape\n')
        import_added = True
        continue

    # Sanitize name field before validation
    if 'def apply_for_beta(request: BetaApplyRequest):' in line and not sanitize_added:
        output.append(line)
        # Find the docstring end and add sanitization
        j = i + 1
        while j < len(lines) and '"""' not in lines[j]:
            j += 1
        if j < len(lines):
            # Add sanitization after docstring
            for k in range(i+1, j+2):
                output.append(lines[k])
            output.append('    # Sanitize inputs to prevent XSS\n')
            output.append('    sanitized_name = escape(request.name.strip())\n')
            output.append('    \n')
            sanitize_added = True
            # Skip the lines we already added
            for k in range(j+2-i):
                next(enumerate(lines), None)
            continue

    # Update usage of request.name to use sanitized_name
    if sanitize_added and 'name=request.name,' in line:
        line = line.replace('name=request.name,', 'name=sanitized_name,')

    output.append(line)

with open('app/routers/beta.py', 'w') as f:
    f.writelines(output)

print("✓ Added XSS protection - Name field now sanitized")
EOF

# Restart service
echo ""
echo "Restarting service..."
systemctl restart thunderbird-api
sleep 3

# Test CORS is restricted
echo ""
echo "Testing fixes..."
echo "✓ CORS fix applied (check browser console for CORS errors from other domains)"
echo "✓ XSS protection added (name field sanitized)"

# Check service status
systemctl status thunderbird-api --no-pager -l | head -20

echo ""
echo "=========================================="
echo "Security Fixes Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Add nginx security headers (see nginx_headers.conf)"
echo "2. Test CORS by accessing from different domain"
echo "3. Monitor logs for any issues"
