#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
echo "[*] Stopping Hyperledger Fabric network containers..."
if command -v docker &> /dev/null; then
    docker compose -f "$ROOT_DIR/docker-compose.fabric.yml" down -v
    echo "[+] Fabric network stopped and volumes pruned."
fi
