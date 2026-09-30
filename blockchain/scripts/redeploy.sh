#!/usr/bin/env bash
#
# Redeploy a chaincode after editing it, keeping the existing ledger state.
#
#   ./scripts/redeploy.sh                # forensic (the default)
#   ./scripts/redeploy.sh keyregistry
#
# Fabric requires the sequence number to increment by exactly one on every
# upgrade. This script tracks it per chaincode in .cc-sequence /
# .cc-sequence-keyregistry so you do not have to.
#
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_tools docker npm peer

TARGET="${1:-$CC_NAME}"
case "$TARGET" in
    "$CC_NAME")      NAME="$CC_NAME";      PATH_TO_CC="$CC_PATH";      SEQ="$SEQ_FILE" ;;
    "$KEYS_CC_NAME") NAME="$KEYS_CC_NAME"; PATH_TO_CC="$KEYS_CC_PATH"; SEQ="$KEYS_SEQ_FILE" ;;
    *)
        echo "Usage: $0 [$CC_NAME|$KEYS_CC_NAME]"
        exit 1 ;;
esac

if ! network_is_up; then
    echo "ERROR: network is not running. Use ./scripts/setup.sh first."
    exit 1
fi

if [ -f "$SEQ" ]; then
    CURRENT_SEQ=$(cat "$SEQ")
else
    # Recover the sequence from the ledger if the local file is missing.
    echo "==> $(basename "$SEQ") missing, reading committed sequence from the ledger"
    source "$SCRIPT_DIR/env-org1.sh" >/dev/null
    CURRENT_SEQ=$(peer lifecycle chaincode querycommitted \
        --channelID "$CHANNEL_NAME" --name "$NAME" --output json \
        | jq -r '.sequence')
fi

NEXT_SEQ=$((CURRENT_SEQ + 1))
NEXT_VER="1.$NEXT_SEQ"

echo "==> Installing chaincode dependencies"
( cd "$PATH_TO_CC" && npm install --silent )

echo "==> Redeploying '$NAME' as version $NEXT_VER, sequence $NEXT_SEQ"
cd "$NETWORK_DIR"
./network.sh deployCC -ccn "$NAME" -ccp "$PATH_TO_CC" -ccl "$CC_LANG" \
    -ccv "$NEXT_VER" -ccs "$NEXT_SEQ"

echo "$NEXT_SEQ" > "$SEQ"

echo
echo "Redeployed. Existing ledger records are untouched."
