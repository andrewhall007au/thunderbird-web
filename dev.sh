#!/bin/bash
# ============================================================================
# Thunderbird Development Startup Script
# Starts both frontend (Next.js) and backend (FastAPI) servers
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - keep these in sync!
BACKEND_PORT=8000
FRONTEND_PORT=3000

echo -e "${GREEN}⚡ Starting Thunderbird Development Environment${NC}"
echo "================================================"
echo ""

# Check .env.local has correct API URL
ENV_FILE=".env.local"
EXPECTED_API_URL="NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}"

if [ -f "$ENV_FILE" ]; then
    CURRENT_URL=$(grep "NEXT_PUBLIC_API_URL" "$ENV_FILE" 2>/dev/null || echo "")
    if [ "$CURRENT_URL" != "$EXPECTED_API_URL" ]; then
        echo -e "${YELLOW}⚠ Fixing .env.local API URL${NC}"
        echo -e "  Was: $CURRENT_URL"
        echo -e "  Now: $EXPECTED_API_URL"
        echo "$EXPECTED_API_URL" > "$ENV_FILE"
    fi
else
    echo -e "${YELLOW}Creating .env.local${NC}"
    echo "$EXPECTED_API_URL" > "$ENV_FILE"
fi

# Kill any existing processes on our ports
echo "Checking for existing processes..."
lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
sleep 1

# Start backend
echo ""
echo -e "${GREEN}Starting Backend (FastAPI) on port $BACKEND_PORT...${NC}"
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port $BACKEND_PORT &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo "Waiting for backend..."
for i in {1..30}; do
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend ready${NC}"
        break
    fi
    sleep 1
done

# Start frontend
echo ""
echo -e "${GREEN}Starting Frontend (Next.js) on port $FRONTEND_PORT...${NC}"
npm run dev &
FRONTEND_PID=$!

# Wait for frontend
echo "Waiting for frontend..."
sleep 3

echo ""
echo "================================================"
echo -e "${GREEN}✓ Development servers running:${NC}"
echo -e "  Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "================================================"

# Trap Ctrl+C to kill both processes
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# Wait for either process to exit
wait
