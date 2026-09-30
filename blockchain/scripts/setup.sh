#!/usr/bin/env bash
#
# Bring up the Fabric test network and deploy both chaincodes:
#   forensic     decryption audit records, keyed by watermark
#   keyregistry  each user's ML-KEM / ML-DSA public keys, keyed by username
# Destroys any existing network first, so this is always a clean start.
#
#   ./scripts/setup.sh
#
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_tools docker jq node npm peer

check_chaincode() {
    local dir="$1" main="$2"
    for f in index.js package.json "$main"; do
        if [ ! -f "$dir/$f" ]; then
            echo "ERROR: missing $dir/$f"
            exit 1
        fi
    done
    if ! grep -q '"start"' "$dir/package.json"; then
        echo "ERROR: $dir/package.json has no scripts.start entry."
        echo "The peer launches chaincode with 'npm start' — without it the container exits."
        exit 1
    fi
}

echo "==> Checking chaincode directories"
check_chaincode "$CC_PATH" lib/forensicAudit.js
check_chaincode "$KEYS_CC_PATH" lib/keyRegistry.js

echo "==> Installing chaincode dependencies (needed offline later)"
( cd "$CC_PATH" && npm install --silent )
( cd "$KEYS_CC_PATH" && npm install --silent )

echo "==> Tearing down any existing network"
cd "$NETWORK_DIR"
./network.sh down >/dev/null 2>&1 || true
docker volume prune -f >/dev/null 2>&1 || true

echo "==> Starting network and creating channel '$CHANNEL_NAME'"
./network.sh up createChannel -c "$CHANNEL_NAME"

echo "==> Deploying chaincode '$CC_NAME'"
./network.sh deployCC -ccn "$CC_NAME" -ccp "$CC_PATH" -ccl "$CC_LANG" -ccv 1.0 -ccs 1
echo "1" > "$SEQ_FILE"

echo "==> Deploying chaincode '$KEYS_CC_NAME'"
./network.sh deployCC -ccn "$KEYS_CC_NAME" -ccp "$KEYS_CC_PATH" -ccl "$CC_LANG" -ccv 1.0 -ccs 1
echo "1" > "$KEYS_SEQ_FILE"

echo
echo "==> Committed chaincode definitions"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE="$ORG1_CA"
export CORE_PEER_MSPCONFIGPATH="$ORG_DIR/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
export CORE_PEER_ADDRESS=localhost:7051
for cc in "$CC_NAME" "$KEYS_CC_NAME"; do
    peer lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME" --name "$cc" --output json | jq .
done

echo
"$SCRIPT_DIR/provision-recipients.sh" || {
    echo "WARNING: recipient provisioning failed — the smoke test will not run."
    echo "Try ./scripts/provision-recipients.sh by hand to see why."
}

cat <<EOF

Network is up, both chaincodes are deployed, recipient identities are provisioned.

Next:
  source $SCRIPT_DIR/env-recipient.sh user-042
  $SCRIPT_DIR/smoke-test.sh

Sign up an application user and produce their login bundle:
  $SCRIPT_DIR/new-recipient.sh alice
  $SCRIPT_DIR/bundle-identity.sh alice

Records must be submitted by the recipient they name, so use
env-recipient.sh here. env-org1.sh is for admin work (redeploy.sh).

EOF
