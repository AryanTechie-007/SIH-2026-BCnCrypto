#!/usr/bin/env bash
# CIPHERTRACE - Air-Gapped Fabric Image Exporter
#
# Run on an internet-connected machine that has already run
# blockchain/scripts/setup.sh once, so every image the network needs is present.
# Transfer the bundle to the air-gapped host and load it with
# import_airgap_images.sh.
#
#   ./scripts/export_airgap_images.sh [output.tar.gz]
set -euo pipefail

FABRIC_VERSION="2.5.16"
BUNDLE_FILE="${1:-./dist/airgap/fabric_images_${FABRIC_VERSION}.tar.gz}"
mkdir -p "$(dirname "$BUNDLE_FILE")"

# The test network runs peer/orderer as :latest and Node chaincode on nodeenv:2.5,
# so both tags are saved. ccenv and baseos are only needed for Go chaincode but
# are small enough to include.
IMAGES=(
    "hyperledger/fabric-peer:${FABRIC_VERSION}"
    "hyperledger/fabric-peer:latest"
    "hyperledger/fabric-orderer:${FABRIC_VERSION}"
    "hyperledger/fabric-orderer:latest"
    "hyperledger/fabric-nodeenv:2.5"
    "hyperledger/fabric-ccenv:2.5"
    "hyperledger/fabric-baseos:2.5"
)

echo "==> Checking images"
missing=0
for img in "${IMAGES[@]}"; do
    if ! docker image inspect "$img" >/dev/null 2>&1; then
        echo "  missing: $img"
        missing=1
    fi
done
if [ "$missing" -ne 0 ]; then
    echo "ERROR: pull or build the missing images first (running blockchain/scripts/setup.sh once does this)."
    exit 1
fi

echo "==> Saving ${#IMAGES[@]} images to $BUNDLE_FILE"
docker save "${IMAGES[@]}" | gzip > "$BUNDLE_FILE"

cat <<EOF

Done: $BUNDLE_FILE ($(du -h "$BUNDLE_FILE" | cut -f1))

Also transfer, if the target has no internet:
  - fabric-samples (bin/, config/, test-network/) at Fabric $FABRIC_VERSION
  - blockchain/chaincode/*/node_modules (the peer runs npm install when building chaincode)
  - blockchain/client/node_modules, frontend/node_modules, desktop/node_modules, and
    the uv cache after running `uv sync` in backend/ (UV_CACHE_DIR), then run
    `uv sync --offline` there. Or install the desktop app, which bundles Python.
EOF
