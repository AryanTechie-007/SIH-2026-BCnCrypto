#!/bin/bash
echo "🛡️ Initializing QuantumGuard Environment..."

# Install System Dependencies for PQC (liboqs)
sudo apt-get update
sudo apt-get install -y cmake gcc ninja-build libssl-dev python3-pip

# Install Python Libraries
pip install fastapi uvicorn oqs cryptography numpy customtkinter requests pillow

# Build liboqs (Post-Quantum Library)
git clone https://github.com/open-quantum-safe/liboqs.git
cd liboqs
mkdir build && cd build
cmake -GNinja ..
ninja
sudo ninja install
cd ../..

echo "✅ Environment Ready. Run 'python backend/main.py' to start."
