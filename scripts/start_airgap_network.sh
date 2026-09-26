#!/usr/bin/env bash
# CIPHERTRACE - Launch Full Air-Gapped Stack (App + Hyperledger Fabric 3-Org DLT)
set -euo pipefail

echo "========================================================"
echo "CIPHERTRACE: Launching Full Air-Gapped Defense Network"
echo "========================================================"

# Check if launching full blockchain consortium or app-only demo
MODE="${1:-full}"

if [ "$MODE" = "full" ]; then
    echo "Starting Hyperledger Fabric 3-Org Consortium + Application..."
    docker compose -f docker-compose.yml -f docker-compose.fabric.yml up -d
    
    echo "Waiting for Fabric Orderer and Peer nodes to achieve readiness..."
    sleep 5
    
    echo "Initializing Consortium Channel & Chaincode..."
    ./blockchain/scripts/start-network.sh || true
    ./blockchain/scripts/deploy-chaincode.sh || true
    ./blockchain/scripts/verify-network.sh || true
    
    echo "Full consortium network ready."
    echo "UI: http://localhost:3000"
    echo "API: http://localhost:8000"
else
    echo "Starting Application in Standalone Mode..."
    docker compose up -d
    echo "Application ready in Demo Mode."
    echo "UI: http://localhost:3000"
    echo "API: http://localhost:8000"
fi
