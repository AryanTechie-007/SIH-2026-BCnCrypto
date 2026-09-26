#!/usr/bin/env bash
# ================================================================
#  CIPHERTRACE 2.0 - Linux/macOS Dependency Installer
#  Smart India Hackathon 2026 - Defense Security Platform
# ================================================================

set -e

# Change directory to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
PROJECT_ROOT="$(pwd)"

echo "================================================================"
echo " CIPHERTRACE 2.0 - Linux/macOS Dependency Installer"
echo " Problem Statement: Blockchain & Cryptography"
echo "================================================================"
echo ""

# 1. Verify Python
echo "[1/5] Verifying Python 3 installation..."
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python 3 is not installed or not in PATH!"
    echo "On Ubuntu/Debian, install via: sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv"
    exit 1
fi
PYTHON_VER=$(python3 --version)
echo "[OK] Found $PYTHON_VER"

# 2. Setup Python Virtual Environment & Install Dependencies
echo ""
echo "[2/5] Installing Python cryptographic & backend dependencies..."
python3 -m pip install --upgrade pip --quiet 2>/dev/null || true
if [ -f "$PROJECT_ROOT/backend/requirements.txt" ]; then
    python3 -m pip install -r "$PROJECT_ROOT/backend/requirements.txt"
else
    echo "[ERROR] backend/requirements.txt not found!"
    exit 1
fi

# 3. Verify Node.js & NPM
echo ""
echo "[3/5] Verifying Node.js and NPM..."
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Install Node.js LTS via: https://nodejs.org/ or 'sudo apt-get install -y nodejs npm'"
    exit 1
fi
if ! command -v npm &>/dev/null; then
    echo "[ERROR] npm is not installed!"
    exit 1
fi
echo "[OK] Node.js: $(node --version)"
echo "[OK] NPM: $(npm --version)"

# 4. Install Frontend NPM Packages
echo ""
echo "[4/5] Installing Frontend React / Vite dependencies..."
cd "$PROJECT_ROOT/frontend"
npm install
cd "$PROJECT_ROOT"

# 5. Check Distributed Ledger & Blockchain Runtime
echo ""
echo "[5/5] Checking Distributed Ledger & Blockchain prerequisites..."
if command -v docker &>/dev/null; then
    echo "[OK] Docker Engine detected: $(docker --version)"
    if [ -n "$FABRIC_SAMPLES" ] && [ -d "$FABRIC_SAMPLES" ]; then
        echo "[OK] Hyperledger Fabric path configured: $FABRIC_SAMPLES"
    else
        echo "[INFO] FABRIC_SAMPLES not set. Using built-in High-Assurance Cryptographic Merkle Ledger."
        echo "       To attach to a Hyperledger Fabric multi-org consortium: export FABRIC_SAMPLES=/path/to/fabric-samples"
    fi
else
    echo "[INFO] Docker not detected. CIPHERTRACE will run using its built-in High-Assurance Cryptographic Merkle Ledger"
    echo "       (100% offline, FIPS 202 SHA3-256 hash-chained blocks, zero external overhead)."
fi

echo ""
echo "================================================================"
echo " ALL DEPENDENCIES INSTALLED SUCCESSFULLY!"
echo ""
echo " To launch the platform on Linux/macOS:"
echo "   chmod +x start_demo.sh"
echo "   ./start_demo.sh"
echo "================================================================"
