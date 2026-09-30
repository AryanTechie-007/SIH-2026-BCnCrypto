#!/usr/bin/env bash
# CIPHERTRACE - Air-Gapped Fabric Image Importer
#
# Run on the air-gapped host to load the bundle made by export_airgap_images.sh.
#
#   ./scripts/import_airgap_images.sh [bundle.tar.gz]
set -euo pipefail

BUNDLE_FILE="${1:-./dist/airgap/fabric_images_2.5.16.tar.gz}"

if [ ! -f "$BUNDLE_FILE" ]; then
    echo "ERROR: image bundle not found at $BUNDLE_FILE"
    echo "Usage: $0 [path/to/bundle.tar.gz]"
    exit 1
fi

echo "==> Loading images from $BUNDLE_FILE"
gunzip -c "$BUNDLE_FILE" | docker load

echo
docker images --format '{{.Repository}}:{{.Tag}}' | grep hyperledger | sort
echo
echo "Done. Start the network with blockchain/scripts/setup.sh (no internet needed)."
