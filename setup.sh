#!/usr/bin/env bash
# ==============================================================================
# QuantumGuard (CIPHERTRACE) - SIH 2026 One-Click Setup Script
# ==============================================================================

set -e

echo "=================================================================="
echo "    🛡️  QUANTUMGUARD - SIH 2026 DEPENDENCY & RUNTIME INSTALLER   "
echo "=================================================================="

# Check Python 3
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[-] Python is not installed. Please install Python 3.10+ first."
    exit 1
fi

PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

echo "[+] Using Python: $($PYTHON_CMD --version)"

# 1. Install Python Backend & Desktop Dependencies
echo "[*] Step 1: Installing Python Dependencies (PQC, AI, Crypto, Desktop UI)..."
$PYTHON_CMD -m pip install --upgrade pip
$PYTHON_CMD -m pip install -r requirements.txt

# 2. Make scripts executable
echo "[*] Step 2: Setting executable permissions on helper scripts..."
chmod +x start_demo.sh run_backend.sh install_dependencies.sh scripts/*.sh 2>/dev/null || true

# 3. Verify NIST PQC Self-Test
echo "[*] Step 3: Running NIST Post-Quantum Cryptography Self-Test..."
$PYTHON_CMD -c "
from backend.app.services.crypto_engine import CryptoEngine, HybridPQCEngine
print('[+] PQC Backend:', CryptoEngine.get_backend_info()['backend'])
CryptoEngine.verify_pqc_availability()
print('[+] Genuine NIST FIPS 203 (ML-KEM) & FIPS 204 (ML-DSA) verified.')
engine = HybridPQCEngine()
keys = engine.generate_hybrid_keys()
enc = engine.encrypt_hybrid(b'SIH_2026_TEST', keys['pqc'][0], keys['classical'][0])
dec = engine.decrypt_hybrid(enc, keys['pqc'][1], keys['classical'][1])
assert dec == b'SIH_2026_TEST'
print('[+] Hybrid PQC Engine (ML-KEM + X25519) round-trip test PASSED.')
"

echo "=================================================================="
echo "    ✅  INSTALLATION COMPLETE! HOW TO RUN FOR SIH JUDGES         "
echo "=================================================================="
echo "1. Start Backend:    python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"
echo "2. Start Desktop UI: python desktop/main_app.py"
echo "3. Open Android App: Open the ./android folder in Android Studio"
echo "4. Web Dashboard:    cd frontend && npm install && npm run dev (http://localhost:5173)"
echo "=================================================================="
