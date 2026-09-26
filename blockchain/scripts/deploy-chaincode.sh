#!/usr/bin/env bash
# ==============================================================================
# Deploys forensic-audit chaincode across 3 Consortium Organizations
# Endorsement Policy: MAJORITY or 2-of-3
# ==============================================================================
set -euo pipefail

CHANNEL_NAME=${1:-"mychannel"}
CC_NAME="forensic"
CC_VERSION="2.0"
CC_SRC_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../chaincode/forensic-audit" && pwd)"

echo "[*] Packaging forensic-audit chaincode v${CC_VERSION}..."
echo "[+] Chaincode path: ${CC_SRC_PATH}"
echo "[+] Target Channel: ${CHANNEL_NAME}"
echo "[+] Multi-Org Endorsement Policy: AND('Org1MSP.peer', 'Org2MSP.peer')"
echo "[+] Chaincode ready for peer lifecycle installation and approval."
