#!/usr/bin/env bash
# ==============================================================================
# CIPHERTRACE Air-Gapped Hyperledger Fabric Network Launcher
# Multi-Organization Consortium: Org1 (Defense), Org2 (Audit), Org3 (Forensic)
# ==============================================================================
set -euo pipefail

echo "================================================================================"
echo "    CIPHERTRACE AIR-GAPPED PERMISSIONED BLOCKCHAIN (HYPERLEDGER FABRIC)        "
echo "================================================================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export COMPOSE_PROJECT_NAME="ciphertrace"

if command -v docker &> /dev/null; then
    echo "[+] Docker detected. Bringing up 3-Org Fabric network containers..."
    docker compose -f "$ROOT_DIR/docker-compose.fabric.yml" up -d
    echo "[+] Fabric network services online:"
    docker ps --filter "network=ciphertrace_fabric" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo "[!] Docker not found on host. Network ready for air-gapped container engine."
fi
