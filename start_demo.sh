#!/usr/bin/env bash
# ================================================================
#  CIPHERTRACE 2.0 - Linux/macOS Application Runner
#  Smart India Hackathon 2026 - Defense Security Platform
# ================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "================================================================"
echo " Starting CIPHERTRACE 2.0 Platform (Linux/macOS)"
echo " Post-Quantum Cryptography & Tamper-Evident Distributed Ledger"
echo "================================================================"
echo ""

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "[!] Shutting down CIPHERTRACE services..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Kill any existing processes holding ports 8000 or 5173
if command -v fuser &>/dev/null; then
    fuser -k 8000/tcp 2>/dev/null || true
    fuser -k 5173/tcp 2>/dev/null || true
elif command -v lsof &>/dev/null; then
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
fi

# 2. Launch FastAPI Backend (Port 8000)
echo "[1/2] Launching Post-Quantum Cryptographic Backend on port 8000..."
cd "$DIR/backend"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd "$DIR"

# Wait for backend healthcheck
echo "Waiting for backend services to initialize..."
for i in {1..20}; do
    if curl -s http://127.0.0.1:8000/api/system/health &>/dev/null; then
        echo "[OK] Backend online at http://127.0.0.1:8000"
        break
    fi
    sleep 0.5
done

# 3. Launch Vite Frontend UI (Port 5173)
echo "[2/2] Launching Tactical Web UI on port 5173..."
cd "$DIR/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!
cd "$DIR"

sleep 2

# 4. Open in default browser if available
echo ""
echo "================================================================"
echo " CIPHERTRACE 2.0 IS LIVE!"
echo " Local Access:     http://localhost:5173"
echo " Backend Swagger:  http://localhost:8000/docs"
echo " Press Ctrl+C to terminate all services."
echo "================================================================"
echo ""

if command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:5173 2>/dev/null &
elif command -v open &>/dev/null; then
    open http://localhost:5173 2>/dev/null &
fi

# Wait for user interruption
wait
