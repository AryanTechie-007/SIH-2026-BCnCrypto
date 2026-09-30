# CIPHERTRACE

Post-quantum confidential document sharing with leak attribution. Documents are
encrypted for specific recipients; every time a recipient decrypts one, their
copy gets an invisible watermark unique to that session, and a record signed by
the recipient is written to a Hyperledger Fabric ledger. If a copy leaks, the
watermark leads back to that record and to the person who decrypted it.

Built for Smart India Hackathon 2026.

---

## How it works

The watermark is created at the moment of decryption rather than before
distribution. Three properties have to hold at once:

- **Distinct** — each decryption embeds a different invisible mark, tied to
  that recipient and that session, while every copy looks identical.
- **Attributable** — the recipient signs the record of their own decryption
  with a post-quantum key only they hold, so they cannot later deny it.
- **Durable** — that record is replicated across two independent organizations,
  so erasing or altering it is detectable rather than silent.

### Walkthrough

**1. Enrolment.** An administrator issues the user a credential bundle. There
is no self-service sign-up: the system only accepts records from identities it
issued itself.

**2. First sign-in.** The user signs in with their bundle, which the ledger
verifies, and chooses a passphrase.
The app then generates their encryption and signing key pairs **on their own
device**, stores them in a passphrase-protected keystore, and registers only
the public halves on the ledger. The private keys never leave that machine,
which is what makes the signature later mean something.

**3. Encryption.** The sender picks a PDF and a set of recipients. The document
is encrypted **once**, and that single document key is then wrapped separately
for each recipient using their registered public key. One copy of the
ciphertext, one small wrapped key per recipient. The result is a portable
`.enc` file that is safe to send by email, USB or file share, because only a
holder of the right private key can unwrap it.

**4. Decryption — where the forensics happen.** The recipient's app unwraps the
document key and then, before releasing the file:

- derives a mark unique to this recipient and this decryption, and embeds it
  invisibly across every page;
- builds a record of the event — the mark, a hash of the original document, a
  hash of the marked copy, the recipient's key fingerprint, a timestamp;
- signs that record with the recipient's own private signing key;
- submits it to the ledger **as the recipient**, not as an administrator.

Two independent checks run here. The ledger rejects any record whose stated
recipient does not match the credential that submitted it, and **both
organizations** must reach that same conclusion separately before anything is
written. Neither can do it alone.

The marked copy is released only once the record has been accepted. The app
releases no decrypted copy without a ledger record.

**5. Tracing a leak.** Upload the leaked PDF. The mark is extracted, the
matching decryption record is retrieved, the recipient's signature is verified
against their registered public key, and an evidence bundle is exported.
Because the mark survives re-encoding, the recovered copy does not have to be
pristine: if no frame decodes exactly, a stored mark matching at least 75% of
the recovered bits, and clearly ahead of the next-best candidate, is used
instead.

### Why a ledger rather than a database

A signature proves *who* produced a record. What it cannot prove is that the
record ever existed. An administrator with an ordinary database simply deletes
the row, and the proof disappears without anything having been forged.

The ledger closes that gap three ways. Records are hash-linked, so altering a
committed one invalidates everything written after it. Two organizations hold
independent copies, so a divergence is one hash comparison away from being
caught. And the write policy requires both organizations to agree, so no single
administrator can insert or suppress a record on their own.

The whole system runs offline — no cloud key management, no public blockchain,
no external certificate authority.

## Watermark

Each decrypted copy carries a 16-byte (128-bit) frame, spread invisibly across
every page:

```
┌──────────────────────┬───────────────────────┬─────────────┐
│ Watermark ID (10 B)  │ Authenticity tag (4 B)│ Magic (2 B) │
│ 20 hex characters    │ HMAC-SHA3-256, cut    │  "CP"       │
└──────────────────────┴───────────────────────┴─────────────┘
```

- The page is rendered at 150 DPI and converted to YCrCb; only the luminance
  (Y) channel is modified, in 8×8 DCT blocks.
- Each bit modulates 16 low-to-mid AC coefficients with a row of an order-16
  Sylvester-Hadamard matrix (direct-sequence spread spectrum). The DC
  coefficient is never touched, so block brightness is unchanged. At embed
  strength 20 this gives a PSNR of about 42 dB on text pages and about 40 dB on
  photographic ones.
- Extraction projects the DCT coefficients back onto the same basis and
  averages across thousands of blocks, which recovers the frame from re-encoded
  documents.
- The watermark ID is the ledger key: it is what connects a leaked copy to its
  decryption record.

## Architecture

```
                 AIR-GAPPED NETWORK
           Every user signs in with their
             ledger bundle + passphrase
                          │
      ┌───────────────────┴───────────────────┐
      │                                       │
   Sender's app                            Recipient's app
      │ 1. Pick a PDF and recipients          │ 5. ML-KEM-768 unwraps the
      │ 2. AES-256-GCM encrypt it once        │    document key
      │ 3. ML-KEM-768 wrap its key for        │ 6. Embed a watermark unique
      │    each recipient (key registry)      │    to this session
      │ 4. Send the .enc file ───────────────►│ 7. ML-DSA-65 sign the record
      │    (email · USB · file share)         │ 8. Submit it as themselves
      │                                       │ 9. Release copy on commit
      │                                       │
      ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              CIPHERTRACE app (runs on each user's machine)               │
│          React UI  ·  FastAPI  ·  node blockchain/client/cli.js          │
└───────────────┬──────────────────────────────────────────┬───────────────┘
                │                                          │
                ▼                                          ▼
   Local data (private keys never leave)    Hadamard watermark engine
   - Keystore: ML-KEM + ML-DSA private      - 16-byte authenticated frame
     keys (Argon2id + AES-256-GCM)          - Order-16 Sylvester basis
   - SQLite: public keys, documents,        - DC untouched (≈42 dB PSNR
     decryption events                        on text pages)
                │                                          │
                └────────────────────┬─────────────────────┘
                                     │ every ledger call is signed with
                                     │ the user's own Fabric identity
                                     ▼
          ┌─────────────────────────────────────────────────────┐
          │ Hyperledger Fabric 2.5 permissioned ledger          │
          │ - Org1 peer + Org2 peer: both must endorse          │
          │   every write                                       │
          │ - Raft ordering service                             │
          │ - keyregistry: each user's public keys              │
          │ - forensic: decryption records, keyed by watermark  │
          └──────────────────────────┬──────────────────────────┘
                                     │
                            LEAKED PDF APPEARS
                                     │
                                     ▼
                             Forensic Leak Lab
                             1. Render the page at 150 DPI
                             2. Hadamard correlation decoding → watermark ID
                             3. Exact match, else a ≥75% closest match
                             4. Find the decryption event and verify
                                the recipient's ML-DSA-65 signature
                             5. Export the evidence bundle
```

The frontend and backend run on the user's own machine and will be merged into
a single application; the ledger is the only shared component.

| Component | Technology |
|---|---|
| Key encapsulation | ML-KEM-768 (NIST FIPS 203), via `liboqs` or `mlkem` |
| Signatures | ML-DSA-65 (NIST FIPS 204), via `liboqs` or `dilithium-py` |
| Document encryption | AES-256-GCM |
| Keystore | Argon2id + AES-256-GCM, unlocked with the user's passphrase |
| Hashing | SHA3-256, HMAC-SHA3-256 |
| Watermark | 2D DCT + Walsh-Hadamard spread spectrum (order-16 Sylvester basis) |
| Ledger | Hyperledger Fabric 2.5.16, Node.js chaincode, Fabric Gateway client |
| App | FastAPI + SQLite, React + TypeScript + Vite |

### Cryptography

| Algorithm | Used for | Parameters |
|---|---|---|
| ML-KEM-768 (NIST FIPS 203) | Wrapping each document's key for each recipient | Public key 1184 B, private key 2400 B, ciphertext 1088 B, shared secret 32 B |
| ML-DSA-65 (NIST FIPS 204) | Signing every decryption record | Public key 1952 B, private key 4032 B, signature 3309 B |
| AES-256-GCM (NIST SP 800-38D) | Encrypting documents and keystores | 256-bit key, random 96-bit nonce, 128-bit tag |
| Argon2id | Deriving the keystore key from the passphrase | 64 MB memory, 3 passes |
| SHA3-256 / HMAC-SHA3-256 (NIST FIPS 202) | Document fingerprints, the local hash chain, watermark IDs and tags | — |
| SHA-256 | Key fingerprints and the watermarked copy's hash in ledger records | — |

- ML-KEM and ML-DSA run on the native `liboqs` library when it is installed,
  and otherwise on the pure-Python `mlkem` and `dilithium-py` implementations.
- At startup the app runs a full encapsulate/decapsulate and sign/verify round
  trip, checking exact key and signature sizes, and refuses to start if either
  fails.
- Private keys are decrypted from the keystore only for the moment they are
  used. They are never stored in the database, sent to the ledger, or returned
  by the API.

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

## More documentation

- [blockchain/README.md](blockchain/README.md): ledger setup, chaincode schemas, sign-up and login, troubleshooting, scope and offline deployment
- [blockchain/client/README.md](blockchain/client/README.md): `cli.js` commands