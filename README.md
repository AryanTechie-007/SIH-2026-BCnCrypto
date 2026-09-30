# CIPHERTRACE

Post-quantum confidential document sharing with leak attribution. Documents are
encrypted for specific recipients; every time a recipient decrypts one, their
copy gets an invisible watermark unique to that session, and a record signed by
the recipient is written to a Hyperledger Fabric ledger. If a copy leaks, the
watermark leads back to that record and to the person who decrypted it.

Built for Smart India Hackathon 2026.

---

## How it works

1. **Sign-up (on the ledger).** An administrator issues a Fabric identity with
   `blockchain/scripts/new-recipient.sh` and packs it into a login bundle
   (`<name>.zip`) with `bundle-identity.sh`. There is no sign-up in the app.
2. **Sign-in.** The user enters their username and bundle. The app runs
   `cli.js whoami` with the bundle; the peer only answers requests signed by a
   certificate its org CA issued, so this proves the identity. The user then
   enters their keystore passphrase. On the first sign-in on a device they choose
   one instead, and the app generates their ML-KEM-768 and ML-DSA-65 key pairs
   into an encrypted keystore and publishes the public keys to the
   `keyregistry` chaincode.
3. **Encrypt.** The sender uploads a PDF and picks recipients. The document is
   encrypted once with AES-256-GCM; its key is wrapped for each recipient with
   their ML-KEM-768 public key. The result is a portable `.enc` package.
4. **Decrypt.** The recipient opens the `.enc` file. The app unwraps the key with
   their private key, embeds an invisible watermark (see [Watermark](#watermark))
   that is unique to this decryption, and builds a ledger record (watermark ID,
   document and copy hashes, key fingerprint). The recipient's ML-DSA-65 key
   signs the record, and it is submitted to the `forensic` chaincode as the
   recipient's own Fabric identity. The copy is released only if the ledger
   accepts the record.
5. **Trace.** Upload a leaked PDF. The watermark is extracted, the decryption
   event is found, the recipient's signature is verified, and an evidence bundle
   can be exported. If no watermark decodes exactly, the stored watermark ID that
   matches at least 75% of the extracted bits, and clearly ahead of the runner-up,
   is used instead.

## Watermark

Each decrypted copy carries a 16-byte (128-bit) frame, spread invisibly across
every page:

```
┌──────────────────────┬───────────────────────┬─────────────┐
│ Watermark ID (10 B)  │ Authenticity tag (4 B)│ Magic (2 B) │
│ 20 hex characters    │ HMAC-SHA3-256, cut    │  "CP"       │
└──────────────────────┴───────────────────────┴─────────────┘
```

- The page is rendered at 150 DPI and converted to YCrCb; only the luminance (Y)
  channel is modified, in 8×8 DCT blocks.
- Each bit modulates low-to-mid AC coefficients with a row of an order-64
  Sylvester-Hadamard matrix (direct-sequence spread spectrum). Only zero-mean
  rows are used, so block brightness is unchanged (PSNR above 41 dB at embed
  strength 20).
- Extraction projects the DCT coefficients back onto the same basis and averages
  across thousands of blocks, which recovers the frame from re-encoded documents.
- The watermark ID is the ledger key: it is what connects a leaked copy to its
  decryption record.

## Architecture

```
            ┌───────────────────────────────┐
            │  React UI (frontend/)         │
            └───────────────┬───────────────┘
                            │ HTTP (localhost)
            ┌───────────────▼───────────────┐      ┌───────────────────────────────┐
            │  FastAPI app (backend/)       │      │  Local data                   │
            │  crypto, watermark, forensics ├─────►│  SQLite · keystores · bundles │
            └───────────────┬───────────────┘      └───────────────────────────────┘
                            │ node blockchain/client/cli.js  (as the signed-in user)
            ┌───────────────▼───────────────┐
            │  Hyperledger Fabric 2.5       │
            │  Org1 + Org2 peers, 1 orderer │
            │  chaincodes: forensic,        │
            │              keyregistry      │
            └───────────────────────────────┘
```

The frontend and backend run on the user's own machine and will be merged into a
single application; the ledger is the only shared component.

| Component | Technology |
|---|---|
| Key encapsulation | ML-KEM-768 (NIST FIPS 203), via `liboqs` or `mlkem` |
| Signatures | ML-DSA-65 (NIST FIPS 204), via `liboqs` or `dilithium-py` |
| Document encryption | AES-256-GCM |
| Keystore | Argon2id + AES-256-GCM, unlocked with the user's passphrase |
| Hashing | SHA3-256, HMAC-SHA3-256 |
| Watermark | 2D DCT + Walsh-Hadamard spread spectrum (order-64 Sylvester basis) |
| Ledger | Hyperledger Fabric 2.5.16, Node.js chaincode, Fabric Gateway client |
| App | FastAPI + SQLite, React + TypeScript + Vite |

## Repository layout

```
backend/            FastAPI app: routers/, services/ (crypto, keystore, watermark,
                    ledger), models, tests/
frontend/           React UI
blockchain/
  chaincode/        forensic-audit (decryption records), key-registry (public keys)
  client/           cli.js + ledger.js: the only way the app talks to the ledger
  scripts/          network setup, sign-up, bundles, smoke test
  testdata/         chaincode fixtures
scripts/            security_audit.py, offline Fabric image export/import
setup/              Windows installer and the bundled mlkem wheel
*.bat               Windows launchers for the app
```

## Requirements

- Python 3.11–3.13
- Node.js 20.19+ or 22.12+ (required by the frontend's Vite)
- Docker, `jq`, `zip`, `openssl`, and Hyperledger Fabric **2.5.16**
  (`fabric-samples`, binaries and images); see
  [blockchain/README.md](blockchain/README.md#install)
- macOS or Linux for the ledger scripts (on Windows, run them under WSL)

## Quick start

All commands start from the repository root.

**1. Start the ledger** (first run takes a few minutes):

```bash
export FABRIC_SAMPLES=~/fabric-samples      # wherever fabric-samples lives
cd blockchain
(cd client && npm install)
./scripts/setup.sh                          # network + both chaincodes
```

**2. Sign up users** (still in `blockchain/`):

```bash
./scripts/new-recipient.sh alice && ./scripts/bundle-identity.sh alice
./scripts/new-recipient.sh bob Org2 && ./scripts/bundle-identity.sh bob Org2
# -> blockchain/bundles/alice.zip, bob.zip
```

`setup.sh` starts from an empty ledger every time; after re-running it, repeat
this step, because old bundles stop working.

**3. Start the backend** (new terminal, from the repository root; it keeps running):

```bash
cd backend
uv venv --python 3.12 && source .venv/bin/activate
uv pip install --find-links ../setup/wheels -r requirements.txt
# without uv: python3.12 -m venv .venv && source .venv/bin/activate   (any 3.11–3.13)
#             pip install --find-links ../setup/wheels -r requirements.txt
export CIPHERTRACE_SYSTEM_SECRET="choose-one-and-keep-it"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**4. Start the frontend** (another terminal, from the repository root):

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 and sign in as `alice`: enter the username, choose
`blockchain/bundles/alice.zip`, click **Continue**, then choose a keystore
passphrase (at least 12 characters). Later sign-ins ask for that passphrase.

On Windows, `setup\install_dependencies.bat` installs everything and
`start_demo.bat` starts the backend and frontend; the ledger still needs step 1
and 2 under WSL.

## Configuration

Backend environment variables (all optional):

| Variable | Default | Purpose |
|---|---|---|
| `CIPHERTRACE_SYSTEM_SECRET` | demo value | HMAC key for watermark IDs; keep it fixed |
| `CIPHERTRACE_DB_PATH` | `backend/ciphertrace.db` | SQLite database |
| `KEYSTORE_DIR` | `backend/keystores` | Encrypted keystores |
| `BUNDLES_DIR` | `backend/bundles` | Unpacked login bundles |
| `NODE_BIN`, `LEDGER_CLI_PATH` | `node`, `blockchain/client/cli.js` | Ledger client |
| `ORG1_PEER`, `ORG2_PEER` | `localhost:7051`, `localhost:9051` | Peer addresses, passed to `cli.js` |
| `JWT_SECRET_KEY`, `JWT_EXPIRY_MINUTES` | demo value, `60` | Session tokens |
| `DEMO_MODE`, `SECURE_MODE` | `true`, `false` | `SECURE_MODE` requires real secrets |
| `FABRIC_SAMPLES` | unset | Only for the forensics and health ledger lookups |

## Testing

From the repository root:

```bash
# Chaincode unit tests
(cd blockchain/chaincode/forensic-audit && npm install && npm test)
(cd blockchain/chaincode/key-registry && npm install && npm test)

# Ledger end-to-end (network running, FABRIC_SAMPLES exported)
(cd blockchain && source scripts/env-recipient.sh user-042 && ./scripts/smoke-test.sh)

# Watermark engine
(cd backend && .venv/bin/python -m unittest tests.test_hadamard)

# Security regression audit (12 rules)
backend/.venv/bin/python scripts/security_audit.py
```

## Known limitations

- The keystore passphrase cannot be recovered, and there is no key rotation: a
  user who forgets it cannot register new keys.
- Private keys live on the device where the user first signed in; signing in on
  another device is refused.
- The Fabric private key in each login bundle is stored unencrypted on disk.
- There is no certificate revocation; bundles stay valid until the network is
  rebuilt with `setup.sh`, which invalidates all of them.
- Forensics reads the local database, so it only sees decryptions made on the
  same installation.
- The watermark frame's HMAC tag is not verified during tracing.
- Both organizations and a single ordering node run on one machine; see
  [blockchain/README.md](blockchain/README.md#known-limitations).

## More documentation

- [blockchain/README.md](blockchain/README.md): ledger setup, chaincode schemas, sign-up and login, troubleshooting, offline deployment
- [blockchain/client/README.md](blockchain/client/README.md): `cli.js` commands
- [setup/README.md](setup/README.md): Windows installer
