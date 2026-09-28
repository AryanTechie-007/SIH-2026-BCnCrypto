#!/usr/bin/env bash
# ================================================================
#  CIPHERTRACE / QUANTUMGUARD - Dependency & Setup Uninstaller
#  Smart India Hackathon 2026 - Clean Slate Test Utility
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
PROJECT_ROOT="$(pwd)"

echo "================================================================"
echo " CIPHERTRACE / QUANTUMGUARD - Dependency & Setup Uninstaller"
echo " Smart India Hackathon 2026 - Clean Slate Test Utility"
echo "================================================================"
echo ""
echo "This script will reset your environment to a clean state so you"
echo "can verify that start_demo.sh and install_dependencies.sh"
echo "properly detect, download, and install all dependencies from scratch."
echo ""
echo "Actions to be performed:"
echo " 1. Stop any running backend (port 8000) or frontend (port 5173) processes"
echo " 2. Remove frontend/node_modules and frontend/dist"
echo " 3. Uninstall Python packages from requirements.txt"
echo " 4. Clean Python cache (__pycache__, *.pyc, .pytest_cache)"
echo " 5. Clear temporary uploads and runtime artifacts"
echo ""

read -p "Proceed with complete uninstallation? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "[INFO] Uninstallation cancelled by user."
    exit 0
fi

echo ""
# ------------------------------------------------------------------
# 1. TERMINATE RUNNING PROCESSES (PORTS 8000 & 5173)
# ------------------------------------------------------------------
echo "[1/5] Stopping any active services on ports 8000 and 5173..."
for port in 8000 5173; do
    if command -v fuser &>/dev/null; then
        fuser -k -n tcp $port 2>/dev/null || true
    elif command -v lsof &>/dev/null; then
        PID=$(lsof -ti :$port 2>/dev/null || true)
        if [ -n "$PID" ]; then
            kill -9 $PID 2>/dev/null || true
        fi
    fi
done
echo "[OK] Ports 8000 and 5173 cleared."

# ------------------------------------------------------------------
# 2. REMOVE FRONTEND NODE_MODULES & DIST
# ------------------------------------------------------------------
echo ""
echo "[2/5] Removing frontend node_modules and build artifacts..."
if [ -d "$PROJECT_ROOT/frontend/node_modules" ]; then
    echo "  Deleting frontend/node_modules..."
    rm -rf "$PROJECT_ROOT/frontend/node_modules"
    echo "[OK] frontend/node_modules removed."
else
    echo "[INFO] frontend/node_modules was already absent."
fi

if [ -d "$PROJECT_ROOT/frontend/dist" ]; then
    rm -rf "$PROJECT_ROOT/frontend/dist"
    echo "[OK] frontend/dist removed."
fi

# ------------------------------------------------------------------
# 3. UNINSTALL PYTHON PACKAGES
# ------------------------------------------------------------------
echo ""
echo "[3/5] Uninstalling Python dependencies..."
PYTHON_CMD="python3"
if ! command -v python3 &>/dev/null; then
    PYTHON_CMD="python"
fi

if command -v $PYTHON_CMD &>/dev/null; then
    echo "  Uninstalling core packages via pip..."
    $PYTHON_CMD -m pip uninstall -y -r "$PROJECT_ROOT/requirements.txt" 2>/dev/null || true
    $PYTHON_CMD -m pip uninstall -y -r "$PROJECT_ROOT/backend/requirements.txt" 2>/dev/null || true
    $PYTHON_CMD -m pip uninstall -y fastapi uvicorn cryptography pymupdf Pillow numpy scipy reedsolo python-multipart sqlalchemy greenlet aiosqlite opencv-python-headless customtkinter requests darkdetect mlkem dilithium-py argon2-cffi pyjwt oqs liboqs-python 2>/dev/null || true
    echo "[OK] Python packages uninstalled."
fi

# ------------------------------------------------------------------
# 4. CLEAN PYTHON CACHES & BUILD ARTIFACTS
# ------------------------------------------------------------------
echo ""
echo "[4/5] Cleaning Python bytecode caches and pytest cache..."
find "$PROJECT_ROOT" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$PROJECT_ROOT" -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
find "$PROJECT_ROOT" -type f -name "*.pyc" -delete 2>/dev/null || true
find "$PROJECT_ROOT" -type f -name "*.pyo" -delete 2>/dev/null || true
echo "[OK] Python caches cleared."

# ------------------------------------------------------------------
# 5. CLEAR TEMPORARY UPLOADS & RUNTIME ARTIFACTS
# ------------------------------------------------------------------
echo ""
echo "[5/5] Cleaning temporary runtime forensic uploads..."
rm -rf "$PROJECT_ROOT/backend/uploads/forensic_temp" 2>/dev/null || true
mkdir -p "$PROJECT_ROOT/backend/uploads/forensic_temp" 2>/dev/null || true
echo "[OK] Temporary uploads reset."

echo ""
echo "================================================================"
echo " UNINSTALLATION COMPLETE! ENVIRONMENT RESET TO CLEAN SLATE"
echo "================================================================"
echo ""
echo "Verification:"
if [ ! -d "$PROJECT_ROOT/frontend/node_modules" ]; then
    echo " [x] frontend/node_modules: REMOVED (will trigger npm install)"
else
    echo " [!] frontend/node_modules: Still present"
fi

if ! $PYTHON_CMD -c "import fastapi" &>/dev/null; then
    echo " [x] Python packages:       UNINSTALLED (will trigger pip install)"
else
    echo " [INFO] Some Python packages still present in global environment"
fi

echo ""
echo " You are now ready to test the automated full install!"
echo " Run: ./start_demo.sh (or ./install_dependencies.sh)"
echo "================================================================"
