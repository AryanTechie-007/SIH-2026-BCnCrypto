#!/usr/bin/env bash
# CIPHERTRACE - Air-Gapped Image Importer
# Run on the isolated air-gapped target host
set -euo pipefail

BUNDLE_FILE="${1:-./dist/airgap/ciphertrace_airgap_images.tar.gz}"

if [ ! -f "${BUNDLE_FILE}" ]; then
    echo "ERROR: Image bundle not found at ${BUNDLE_FILE}"
    echo "Usage: ./scripts/import_airgap_images.sh [path_to_bundle.tar.gz]"
    exit 1
fi

echo "========================================================"
echo "CIPHERTRACE: Importing Images into Air-Gapped Docker Host"
echo "========================================================"

echo "Decompressing and loading images from ${BUNDLE_FILE}..."
docker load < "${BUNDLE_FILE}"

echo "Validating loaded images..."
docker images | grep -E "ciphertrace|hyperledger"

echo "========================================================"
echo "SUCCESS: Container images imported into local Docker engine."
echo "You can now launch the stack without Internet access."
echo "========================================================"
