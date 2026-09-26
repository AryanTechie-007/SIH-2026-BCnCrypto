# CIPHERTRACE — Technical Specification & Operational Manual
**Project:** Post-Quantum Defense Document Forensic Attribution Platform  
**Target Environment:** 100% Offline / Air-Gapped Military-Grade Deployment  
**Standard Compliance:** NIST FIPS 203 (ML-KEM-768), NIST FIPS 204 (ML-DSA-65), NIST SP 800-38D (AES-256-GCM), NIST FIPS 202 (SHA3-256), CCSDS 131.0-B-3 (Reed-Solomon RS(255,127))

---

## 1. Architectural Principles & Security Invariants

1. **Zero Plaintext Private Key Storage (Client Keystore Isolation):**
   - No private keys are stored in the server SQLite database (`ciphertrace_v2.db`).
   - Private keys are stored in encrypted client-side keystores (`Argon2id` KDF + `AES-256-GCM`).
   - Keystores are unlocked locally on the recipient device using the user's PIN/passphrase.
   - Decapsulation and ML-DSA-65 signing occur inside the keystore memory boundary; keys are zeroed immediately after use.
   - Private keys are never serialized into API responses, database columns, ledger records, or log files.

2. **Genuine NIST Post-Quantum Cryptography:**
   - **Key Encapsulation:** ML-KEM-768 (NIST FIPS 203) with exact parameter sizes (1184 B public key, 2400 B secret key, 1088 B ciphertext, 32 B shared secret).
   - **Digital Signatures:** ML-DSA-65 (NIST FIPS 204) with exact parameter sizes (1952 B public key, 4032 B secret key, 3309 B signature).
   - Classical algorithms (X25519/Ed25519) are not used or emulated with padding.

3. **Robust Watermark Engineering:**
   - **2D DCT Frequency Modulation:** Luminance ($Y$) channel rendered at deterministic 150 DPI. Modulation on coefficient $(3,3)$ provides optical imperceptibility ($\text{PSNR} > 42\text{ dB}$, $\Delta E < 0.1$).
   - **Genuine Reed-Solomon RS(255,127):** 127 data symbols + 128 parity symbols (`RSCodec(128)`), correcting up to 64 byte errors from JPEG recompression, cropping, or noise.
   - **Authenticated 127-Byte Frame:** Magic header (`CPTR`), Version (`0x02`), Watermark ID, Event UUID, Document SHA3 fingerprint, Recipient Key ID fingerprint, Session Nonce, and HMAC-SHA3-256 authentication tag.

4. **Multi-Organization Permissioned Blockchain (Hyperledger Fabric):**
   - 3-Organization Consortium: Org1 (Defense Command), Org2 (Independent Audit), Org3 (Forensic Bureau) + Raft Orderer.
   - Smart Contract: `forensic-audit` (`RecordDecryption`, `LookupByWatermark`, `GetRecord`, `GetAllRecords`).
   - 2-of-3 endorsement policy prevents unilateral alteration by any single administrator.
   - **Fail-Closed Mode:** When `SECURE_MODE=true`, blockchain connectivity is mandatory. Decryption commits fail closed (`503 Service Unavailable`) if the ledger is unreachable.
   - When `DEMO_MODE=true`, local SHA3-256 hash chaining is permitted and explicitly tagged as `"DEMO LOCAL LEDGER"`.

---

## 2. Directory Layout

```
SIH 2026/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI application entrypoint & security middleware
│   │   ├── config.py                # Environment configuration (DEMO_MODE, SECURE_MODE)
│   │   ├── database.py              # SQLite async database with WAL mode & busy timeout
│   │   ├── schemas.py               # Pydantic request/response schemas (No private keys)
│   │   ├── models/
│   │   │   └── database.py          # SQLAlchemy models (User, Document, LedgerBlock, etc.)
│   │   ├── services/
│   │   │   ├── crypto_engine.py     # NIST FIPS 203 ML-KEM-768 & FIPS 204 ML-DSA-65
│   │   │   ├── keystore.py          # Encrypted recipient keystore manager (Argon2id + AES-GCM)
│   │   │   ├── watermark_engine.py  # 2D DCT steganography & RS(255,127) FEC
│   │   │   ├── ledger_client.py     # Hyperledger Fabric client & fail-closed adapter
│   │   │   └── ledger_engine.py     # Block chaining, Merkle tree & local audit cache
│   │   └── routers/
│   │       ├── auth.py              # Argon2id password hashing, JWT sessions & RBAC
│   │       ├── system.py            # Operational telemetry & health checks
│   │       ├── identity.py          # Public key directory & officer registration
│   │       ├── documents.py         # Encrypted envelope distribution & UUID upload handling
│   │       ├── decryption.py        # Keystore-isolated decryption, watermarking & signing
│   │       ├── forensics.py         # Blockchain-primary forensic attribution & evidence bundle
│   │       ├── ledger.py            # Ledger blocks, Merkle proofs & tamper simulation
│   │       └── attacks.py           # Physical degradation stress lab (JPEG, crop, resize)
│   ├── keystores/                   # Recipient encrypted keystores (*.keystore)
│   ├── tests/                       # 21 automated unit and integration tests
│   ├── requirements.txt             # Backend Python dependencies
│   └── Dockerfile                   # Deterministic container build with liboqs PQC
├── blockchain/
│   ├── chaincode/
│   │   └── forensic-audit/          # Node.js chaincode (RecordDecryption, LookupByWatermark)
│   └── scripts/                     # Fabric network orchestration scripts
├── frontend/                        # React 19 + TypeScript + Vite tactical defense UI
├── scripts/
│   ├── security_audit.py            # Strict 10-rule anti-regression security scanner
│   ├── export_airgap_images.sh      # Offline container bundler
│   ├── import_airgap_images.sh      # Air-gapped container importer
│   └── start_airgap_network.sh      # Full stack orchestrator
├── docker-compose.yml               # Application services
├── docker-compose.fabric.yml        # 3-Org Hyperledger Fabric cluster
├── README.md                        # Primary documentation & quickstart
└── DOCUMENTATION.md                 # Technical specification & operational manual
```

---

## 3. Verification & Testing Matrix

| Level | Component | Test Suite | Verification Method | Status |
| :--- | :--- | :--- | :--- | :---: |
| **L1** | NIST PQC Engine | `test_crypto_engine.py` (7 tests) | Key sizes, Encapsulate/Decapsulate, Sign/Verify, Tamper Rejection | **PASS** |
| **L2** | Keystore Isolation | `test_keystore.py` (6 tests) | Argon2id KDF, AES-GCM wrapping, Zero DB keys, Dict serialization check | **PASS** |
| **L3** | Watermark & RS FEC | `test_watermark_engine.py` (3 tests) | 127 data symbols, 128 parity, Burst error correction, Noise rejection | **PASS** |
| **L4** | Access Control & RBAC | `test_access_control.py` (1 test) | HTTP 403 enforcement for unauthorized decryptors | **PASS** |
| **L5** | End-to-End Pipeline | `test_e2e_pipeline.py` (1 test) | Sender $\to$ Recipient $\to$ Fabric $\to$ Intercept $\to$ Attribution $\to$ Evidence | **PASS** |
| **L6** | Security Regression | `security_audit.py` (10 rules) | Codebase scan: No X25519/Ed25519 PQC, No DB private keys, Fail-closed mode | **PASS** |

### Execution Commands:
```bash
# Run all cryptographic and pipeline tests
python -m unittest discover backend/tests -v

# Run anti-regression security audit
python scripts/security_audit.py
```

---

## 4. Forensic Attribution Verification Gates

When a leaked document is evaluated in `ForensicConsole.tsx` (`POST /api/forensics/analyze`), the pipeline evaluates 6 sequential cryptographic verification gates:

```
[Leaked Document] 
       │
       ▼
[Gate 1: Watermark Payload Format] ── PASS: Valid 'CPTR' header, version 2 frame
       │
       ▼
[Gate 2: HMAC-SHA3-256 Frame Auth] ── PASS: Cryptographic binding matches secret
       │
       ▼
[Gate 3: Blockchain Transaction]   ── PASS: Transaction ID validated on Fabric
       │
       ▼
[Gate 4: ML-DSA-65 Signature]       ── PASS: Recipient digital signature mathematically verified
       │
       ▼
[Gate 5: Document SHA3-256 Hash]   ── PASS: Payload hash matches original classified source
       │
       ▼
[Gate 6: Identity Attestation]     ── PASS: Recipient military ID & device authenticated
       │
       ▼
[Court-Admissible Evidence Bundle Exported]
```
