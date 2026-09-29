#!/bin/bash
echo "🛡️ Initializing CIPHERTRACE 2.0 Environment..."

# Install System Dependencies for PQC (liboqs) if apt-get is available
if command -v apt-get &> /dev/null; then
    echo "[*] Installing C Build Tools & OpenSSL for liboqs..."
    sudo apt-get update
    sudo apt-get install -y cmake gcc ninja-build libssl-dev python3-pip git
fi

# Install Python Libraries
echo "[*] Installing Python Dependencies..."
pip install fastapi uvicorn liboqs-python oqs cryptography numpy customtkinter requests pillow mlkem dilithium-py pymupdf scipy reedsolo greenlet aiosqlite argon2-cffi pyjwt

# Build liboqs (Post-Quantum Library)
if [ ! -d "liboqs" ]; then
    echo "[*] Cloning & Building liboqs (Post-Quantum Library)..."
    git clone https://github.com/open-quantum-safe/liboqs.git
    cd liboqs
    mkdir -p build && cd build
    cmake -GNinja ..
    ninja
    sudo ninja install 2>/dev/null || ninja install || true
    cd ../..
fi

echo "✅ Environment Ready. Run 'python backend/main.py' to start."
