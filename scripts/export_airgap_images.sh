#!/usr/bin/env bash
# CIPHERTRACE - Air-Gapped Image Exporter
# Run on an internet-connected workstation before transfer to air-gapped environment
set -euo pipefail

echo "========================================================"
echo "CIPHERTRACE: Packaging Containers for Air-Gapped Deploy"
echo "========================================================"

OUTPUT_DIR="./dist/airgap"
BUNDLE_FILE="${OUTPUT_DIR}/ciphertrace_airgap_images.tar.gz"
mkdir -p "${OUTPUT_DIR}"

echo "[1/4] Building CIPHERTRACE Backend with liboqs PQC..."
docker build -t ciphertrace-backend:latest ./backend

echo "[2/4] Building CIPHERTRACE Frontend..."
docker build -t ciphertrace-frontend:latest ./frontend

echo "[3/4] Pulling Hyperledger Fabric 2.5 Images..."
FABRIC_IMAGES=(
    "hyperledger/fabric-peer:2.5.9"
    "hyperledger/fabric-orderer:2.5.9"
    "hyperledger/fabric-ccenv:2.5.9"
    "hyperledger/fabric-baseos:0.4.24"
)

for img in "${FABRIC_IMAGES[@]}"; do
    docker pull "$img"
done

echo "[4/4] Exporting and compressing container images..."
docker save \
    ciphertrace-backend:latest \
    ciphertrace-frontend:latest \
    "${FABRIC_IMAGES[@]}" \
    | gzip > "${BUNDLE_FILE}"

echo "========================================================"
echo "SUCCESS: Air-gap image bundle created at:"
echo "${BUNDLE_FILE}"
echo "Transfer this archive via hardware-secured media to the"
echo "air-gapped LAN host."
echo "========================================================"
