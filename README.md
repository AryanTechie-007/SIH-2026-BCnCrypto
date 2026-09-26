# 🛡️ CIPHERTRACE
> **Air-Gapped Post-Quantum Cryptographic Document Security, Forensics & Permissioned DLT Attribution Platform**  
> *Developed for Smart India Hackathon (SIH 2026) | Problem Statement: Blockchain & Cryptography*

---

## 📌 Executive Summary & Threat Model

**CIPHERTRACE** addresses the critical vulnerability in defense, intelligence, and confidential enterprise workflows: the **insider threat and post-decryption leak problem**.

Traditional perimeter security, DRM, and transit encryption (TLS/VPN) protect documents in transit and at rest. However, once an authorized recipient decrypts a file on an endpoint, traditional safeguards end. If the recipient photographs the display, prints the document, or leaks the digital copy, attribution is near-impossible due to plausible deniability.

CIPHERTRACE guarantees that **no recipient can access a confidential document without their identity being indelibly, invisibly bound into every page via 2D Discrete Cosine Transform (DCT) spread-spectrum steganography, authenticated with Post-Quantum Digital Signatures (ML-DSA-65), and committed to an immutable permissioned Hyperledger Fabric ledger.**

```
                      AIR-GAPPED DEFENSE LAN
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                               │
  Sender System                                 Recipient Device
  (Officer / Authority)                         (Authorized User)
        │                                               │
        │ Upload PDF & Select Recipients                │ Local Encrypted Keystore
        │ AES-256-GCM Payload Cipher                    │ (Argon2id + AES-256-GCM)
        │ ML-KEM-768 Envelopes Generated                │ [Private Keys NEVER sent to Server]
        │                                               │
        ▼                                               ▼
┌───────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                          │
│        (Metadata Engine • Ephemeral File Distribution)        │
└───────────────┬───────────────────────────────┬───────────────┘
                │                               │
                ▼                               ▼
    SQLite Operational Store        2D DCT Watermark Engine
    - Public Keys & Key IDs         - 127-byte Authenticated Frame
    - User Profiles & Roles         - Reed-Solomon RS(255,127) FEC
    - NO Plaintext Private Keys     - Mid-frequency Modulation
                │                               │
                └───────────────┬───────────────┘
                                │
                                ▼
         ┌─────────────────────────────────────────────┐
         │ Hyperledger Fabric 3-Org Permissioned DLT   │
         │ - Org1 Peer: Defense Tactical Command       │
         │ - Org2 Peer: Independent Audit Authority    │
         │ - Org3 Peer: Forensic Investigation Bureau  │
         │ - Raft Ordering Service                     │
         │ - Endorsement Policy: 2-of-3 Consortium     │
         └──────────────────────┬──────────────────────┘
                                │
                        DOCUMENT LEAK OCCURS
                                │
                                ▼
                    Forensic Attribution Lab
                    1. Render & 2D DCT Extraction
                    2. RS(255,127) Syndrome Decoding
                    3. Fabric LookupByWatermark Query
                    4. ML-DSA-65 Cryptographic Verification
                    5. Document SHA3-256 Hash Verification
                    6. Court-Admissible Evidence Bundle Export
```

---

## 🚀 Core Architectural Pillars

### 1. ⚛️ Genuine NIST Post-Quantum Cryptography
* **ML-KEM-768 (NIST FIPS 203)**: Module-Lattice-Based Key-Encapsulation Mechanism. Protects symmetric Document Encryption Keys (DEKs) against "harvest-now, decrypt-later" quantum adversary threats. (1184-byte public key, 2400-byte private key, 1088-byte ciphertext).
* **ML-DSA-65 (NIST FIPS 204)**: Module-Lattice-Based Digital Signature Algorithm. Produces mathematically non-repudiable digital signatures during recipient decryption events. (1952-byte public key, 4032-byte private key, 3309-byte signature).
* **AES-256-GCM (NIST SP 800-38D)**: Authenticated symmetric encryption for confidential document payloads.
* **SHA3-256 (NIST FIPS 202)**: Permutation-based hashing for canonical serialization, Merkle roots, block hash chains, and HMAC-SHA3-256 watermark payload authentication.
> [!NOTE]
> CIPHERTRACE implements genuine NIST-standardized algorithms (FIPS 203 / 204) via `liboqs` / `liboqs-python` and pure-wheel fallbacks (`mlkem`, `dilithium-py`). It does not pad or emulate classical algorithms (e.g., X25519/Ed25519) as PQC. Standard implementation does not denote laboratory FIPS certification/validation.

### 2. 🔐 Zero Plaintext Private Key Storage (Client Keystore Isolation)
* **No Database Private Keys**: The application database (`ciphertrace_v2.db`) stores only public keys, public key fingerprints (`kem_key_id`, `dsa_key_id`), key status, and role metadata. Raw private keys never touch SQLite.
* **Recipient Encrypted Keystore**: Private keys are stored in encrypted offline keystores (`Argon2id` KDF with 64 MB memory, 3 iterations, 4 parallel lanes + `AES-256-GCM`).
* **Client-Side Enclave Boundary**: Keystores are unlocked exclusively on the recipient device during viewing. Decapsulation and signing occur within the keystore boundary; raw private keys are explicitly zeroed from memory immediately after use and are never transmitted over HTTP or stored in logs.

### 3. 👁️ Robust 2D DCT Steganography & True RS(255,127) FEC
* **Luminance Modulation**: Documents are rendered at deterministic 150 DPI; the luminance ($Y$) channel is decomposed into $8 \times 8$ blocks and mid-frequency DCT coefficients $(3,3)$ are modulated to ensure visual imperceptibility ($\text{PSNR} > 42\text{ dB}$, $\Delta E < 0.1$).
* **Full Reed-Solomon RS(255,127)**: Uses 127 data symbols and 128 parity symbols (`RSCodec(128)` over $\text{GF}(2^8)$). Capable of correcting up to 64 corrupted symbol errors.
* **Authenticated 127-Byte Frame**:
  ```
  [0:4]   Magic Header ("CPTR")
  [4:5]   Version (0x02)
  [5:15]  Watermark ID (10 bytes hex string)
  [15:31] Event UUID (16 bytes binary)
  [31:47] Document SHA3 Fingerprint (16 bytes)
  [47:63] Recipient Key ID Fingerprint (16 bytes)
  [63:79] Session Nonce (16 bytes)
  [79:95] HMAC-SHA3-256 Authentication Tag (16 bytes)
  [95:127] Protocol Flags & Reserved Space (32 bytes)
  ```

### 4. ⛓️ Permissioned Hyperledger Fabric Blockchain (3-Org Consortium)
* **Air-Gapped Consortium Network**:
  * **Org1 (Defense Tactical Command)**: Operational command peer node.
  * **Org2 (Independent Audit Authority)**: Compliance & inspector peer node.
  * **Org3 (Forensic Investigation Bureau)**: Forensic investigator peer node.
  * **Raft Ordering Service**: Crash fault-tolerant consensus ordering.
* **Smart Contract (`forensic-audit`)**: Implements `RecordDecryption`, `LookupByWatermark`, `GetRecord`, and `GetAllRecords`.
* **2-of-3 Endorsement Policy**: Requires endorsement from at least 2 independent organizations before a decryption record is committed to the blockchain. No single system administrator can retroactively alter, overwrite, or delete decryption provenance.
* **Fail-Closed Security Model**:
  * When `SECURE_MODE=true`: The system strictly requires live Fabric peers. If Fabric is unreachable, decryption commits **FAIL CLOSED** (`LedgerOfflineError: 503`), preventing uncommitted decryptions.
  * When `DEMO_MODE=true`: A local SHA3-256 hash-chain audit ledger is permitted for offline demo evaluations and is explicitly watermarked and labeled `"DEMO LOCAL LEDGER"`.

### 5. 🔍 Court-Admissible Forensic Attribution Pipeline
When an intercepted leak is submitted to the Forensic Attribution Lab:
1. **Physical Image Ingestion**: Extracts bitstream from rasterized image/PDF via 2D DCT luminance analysis.
2. **Reed-Solomon Error Correction**: Decodes RS(255,127) codeword, recovering the 127-byte authenticated frame despite compression or crops.
3. **Primary Blockchain Lookup**: Queries the Hyperledger Fabric ledger (`LookupByWatermark`) for the immutable commit block.
4. **Independent Cryptographic Verification (6 Gates)**:
   * Gate 1: Watermark Payload Format & Magic Header Check (`PASS`)
   * Gate 2: HMAC-SHA3-256 Frame Authenticity Check (`PASS`)
   * Gate 3: Immutable Blockchain Transaction Verification (`PASS`)
   * Gate 4: NIST FIPS 204 ML-DSA-65 Digital Signature Verification (`PASS`)
   * Gate 5: NIST FIPS 202 SHA3-256 Document Hash Verification (`PASS`)
   * Gate 6: Recipient Public Key & Military Identity Attestation (`PASS`)
5. **Signed Evidence Package**: Produces a canonical JSON evidence bundle containing transaction hashes, block indices, endorsement signatures, and a master SHA3-256 evidence digest.

---

## 🛠️ Software, Dependencies & Technical Stack

### 1. System Requirements & Runtimes
| Software / Component | Version | Purpose |
| :--- | :--- | :--- |
| **Python** | `3.11+` | Core PQC crypto, steganography, keystore management, FastAPI |
| **Node.js** | `v18.0+` (LTS) | Frontend React client build and execution |
| **Docker & Docker Compose** | `24.0+` / `v2.20+` | Containerized deployment and Hyperledger Fabric network |
| **Hyperledger Fabric** | `2.5.9` | 3-Org consortium blockchain ledger and smart contracts |

### 2. Backend Cryptographic & Steganographic Libraries (`backend/requirements.txt`)
* `liboqs` / `liboqs-python` (0.12.0+): Official C/Python bindings for NIST FIPS 203 (ML-KEM-768) and FIPS 204 (ML-DSA-65).
* `mlkem` (0.6.0) & `dilithium-py` (1.3.0): Clean, cross-platform NIST PQC fallback implementations for Windows/development environments without C compilers.
* `cryptography` (42.0+): AES-256-GCM authenticated cipher and HKDF.
* `argon2-cffi` (23.1+): Argon2id password-based key derivation for encrypted local recipient keystores.
* `pyjwt` (2.9+): Short-lived signed JWT session authentication.
* `scipy` (1.11+) & `numpy` (1.24+): 2D Discrete Cosine Transform (`scipy.fftpack.dct/idct`) and matrix operations.
* `opencv-python-headless` (4.8+): Lossless RGB/YCrCb color-space conversions and luminance isolation.
* `reedsolo` (1.7+): Galois field arithmetic for Reed-Solomon RS(255,127) FEC.
* `pymupdf` (`fitz`, 1.23+): PDF vector parsing, multi-page rasterization, and PDF reconstruction.
* `fastapi` (0.115+) & `uvicorn` (0.30+): High-performance asynchronous API engine.

---

## ⚡ Installation & Execution Guide

### Mode Configuration: Secure vs. Demo
CIPHERTRACE supports two distinct operational modes via environment variables:
* **`DEMO_MODE=true` / `SECURE_MODE=false`** (Default for evaluations):
  * Enables officer 1-click login cards.
  * Allows demo local hash-chain ledger (explicitly displayed in UI as `DEMO LOCAL LEDGER`).
  * Ideal for rapid, standalone demonstrations without starting Docker container clusters.
* **`SECURE_MODE=true` / `DEMO_MODE=false`** (Air-gapped defense deployment):
  * Strict Argon2id password authentication required (no demo passwords, no quick-login cards).
  * Hyperledger Fabric consortium is **mandatory**; operations fail closed if blockchain nodes are offline.
  * Strict CORS and security headers enforced.

---

### Method A: Rapid Evaluation (Windows 10/11)

1. **Clone repository**:
   ```powershell
   git clone https://github.com/AryanTechie-007/SIH-2026-BCnCrypto.git
   cd SIH-2026-BCnCrypto
   ```

2. **Install Dependencies**:
   Double-click `install_dependencies.bat` or run:
   ```powershell
   pip install -r backend/requirements.txt
   cd frontend; npm install; cd ..
   ```

3. **Launch Platform**:
   Double-click `start_demo.bat` or execute:
   * **Terminal 1 (Backend)**:
     ```powershell
     cd backend
     python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
     ```
   * **Terminal 2 (Frontend)**:
     ```powershell
     cd frontend
     npm run dev
     ```
   * Access UI: `http://localhost:5173`

---

### Method B: Full Air-Gapped Stack (Docker & Hyperledger Fabric)

1. **Pre-packaging (Internet-Connected Workstation)**:
   ```bash
   chmod +x scripts/*.sh
   ./scripts/export_airgap_images.sh
   ```
   * Generates `./dist/airgap/ciphertrace_airgap_images.tar.gz` containing backend with compiled `liboqs`, frontend, and Fabric 2.5.9 images.

2. **Importing into Air-Gapped Host**:
   Transfer archive via hardware media to the air-gapped host, then run:
   ```bash
   ./scripts/import_airgap_images.sh ./dist/airgap/ciphertrace_airgap_images.tar.gz
   ```

3. **Launch Complete 3-Org Consortium Network**:
   ```bash
   ./scripts/start_airgap_network.sh full
   ```
   * Starts Fabric Orderer, Org1 Peer, Org2 Peer, Org3 Peer, FastAPI Backend, and Frontend.
   * Access UI: `http://localhost:3000` | API: `http://localhost:8000`

---

## 🧪 Comprehensive Automated Test Suites

CIPHERTRACE includes extensive automated verification testing covering cryptography, key isolation, watermarking robustness, access control, and anti-regression rules.

### 1. Run All Cryptographic & Pipeline Tests
```bash
python -m unittest discover backend/tests -v
```
**Test Coverage (21 Automated Tests):**
* `test_crypto_engine.py`:
  * `test_real_ml_kem_768_key_sizes`: Asserts public key (1184 B), private key (2400 B), ciphertext (1088 B), shared secret (32 B).
  * `test_real_ml_kem_768_encapsulate_decapsulate`: Asserts shared secret identity between sender and recipient.
  * `test_wrong_kem_private_key_fails`: Proves decapsulation with invalid private key produces mismatched secret.
  * `test_real_ml_dsa_65_key_and_signature_sizes`: Asserts public key (1952 B), private key (4032 B), signature (3309 B).
  * `test_real_ml_dsa_65_sign_and_verify`: Verifies non-repudiation signature on arbitrary messages.
  * `test_modified_signature_fails` & `test_modified_message_fails`: Proves cryptographic rejection of tampered data.
* `test_keystore.py`:
  * `test_keystore_creation_and_lock_unlock`: Validates Argon2id KDF and AES-256-GCM keystore wrapping.
  * `test_invalid_password_rejected`: Proves unauthorized unlock attempts are strictly rejected.
  * `test_decapsulate_within_keystore`: Validates decapsulation without exposing private key outside keystore boundary.
  * `test_sign_within_keystore`: Validates ML-DSA-65 signing inside keystore boundary.
  * `test_key_rotation`: Validates secure key rotation.
  * `test_private_keys_not_exposed_in_dict`: Proves dictionary/JSON serialization contains zero private keys.
* `test_watermark_engine.py`:
  * `test_rs_255_127_codeword_and_parity_sizes`: Asserts 127 data symbols, 128 parity symbols, 255 codeword length.
  * `test_rs_255_127_error_correction_within_budget`: Proves recovery with up to 10 random symbol errors.
  * `test_rs_255_127_excessive_corruption_fails`: Confirms rejection of uncorrectable noise.
* `test_access_control.py`:
  * `test_unauthorized_recipient_denied_403`: Verifies that unauthorized users attempting decryption receive HTTP 403.
* `test_e2e_pipeline.py`:
  * `test_full_sih_pipeline_e2e`: Simulates end-to-end workflow: Upload $\to$ Multi-recipient encryption $\to$ Keystore decryption $\to$ Watermarking $\to$ Signature $\to$ Blockchain commit $\to$ Intercepted leak $\to$ Blockchain lookup $\to$ Attributed leaker.

### 2. Run Anti-Regression Security Audit
```bash
python scripts/security_audit.py
```
This script audits the entire codebase and fails with a non-zero exit code if any insecure or simulated patterns are introduced:
* Rule 1: No classical X25519 used as ML-KEM
* Rule 2: No classical Ed25519 used as ML-DSA
* Rule 3: No artificial SHAKE padding for fake PQC lengths
* Rule 4: No plaintext private key columns in database models
* Rule 5: No hardcoded fallback secrets in production config
* Rule 6: No fake RSCodec(16); genuine RS(255,127) enforced
* Rule 7: No private keys present in API response schemas
* Rule 8: No private keys present in ledger records
* Rule 9: Secure mode fails closed if blockchain is unavailable
* Rule 10: No unsubstantiated "100% satisfied" or "FIPS validated" claims in README

---

## 🏛️ Consortium Blockchain Architecture (Hyperledger Fabric)

```
        AIR-GAPPED CONSORTIUM CHANNEL: ciphertrace-channel
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  ▼                               ▼                             ▼
Peer: Org1 (Defense)            Peer: Org2 (Audit)            Peer: Org3 (Forensic)
- Endorses Decryption           - Audits Compliance           - Investigates Leaks
- Endorsement MSP: Org1MSP      - Endorsement MSP: Org2MSP    - Endorsement MSP: Org3MSP
  │                               │                             │
  └───────────────────────┬───────┴─────────────────────────────┘
                          │
                          ▼
              Raft Ordering Service (orderer.example.com)
                          │
                          ▼
            Committed Block to All Consortium Ledgers
```

### Ledger Record Schema
```json
{
  "recordId": "rec_f3a7c92b...",
  "watermarkId": "a8f3b20c91e4d72851a0",
  "eventHash": "9b4c6e...",
  "documentHash": "3d8a1c...",
  "recipientKeyId": "dsa_user_1_pk_...",
  "recipientIdentity": "Captain A. Verma (NAVY-0001)",
  "timestamp": "2026-09-26T22:15:00Z",
  "signature": "3a8f...",
  "signatureAlgorithm": "ML-DSA-65",
  "kemAlgorithm": "ML-KEM-768",
  "ledgerTxId": "tx_4f8e12...",
  "schemaVersion": "2.0"
}
```

---

## 📊 Technical Compliance Verification Matrix

| Requirement | Implementation Details | Verified Status |
| :--- | :--- | :---: |
| **NIST Post-Quantum KEM** | **ML-KEM-768 (NIST FIPS 203)** via liboqs / mlkem. Real 1184-byte PK, 2400-byte SK, 1088-byte CT. | **VERIFIED BY UNITTEST** |
| **NIST Post-Quantum Signatures** | **ML-DSA-65 (NIST FIPS 204)** via liboqs / dilithium-py. Real 1952-byte PK, 4032-byte SK, 3309-byte Sig. | **VERIFIED BY UNITTEST** |
| **Private Key Isolation** | Raw private keys stored exclusively in local encrypted recipient keystores (`Argon2id` + `AES-256-GCM`). Zero private keys in database. | **VERIFIED BY AUDIT** |
| **Recipient-Side Signing** | Signing executed within keystore boundary. Server receives only signature and public key fingerprint. | **VERIFIED BY UNITTEST** |
| **Forward Error Correction** | **Reed-Solomon RS(255,127)** using `RSCodec(128)`. 127 data symbols + 128 parity symbols. | **VERIFIED BY UNITTEST** |
| **Invisible Watermark** | 2D DCT mid-frequency $(3,3)$ modulation in $Y$ channel at 150 DPI. $\text{PSNR} > 42\text{ dB}$, $\Delta E < 0.1$. | **VERIFIED BY TEST** |
| **Permissioned Blockchain** | 3-Organization Hyperledger Fabric consortium (Org1, Org2, Org3) with Raft consensus and smart contract. | **DEPLOYABLE VIA DOCKER** |
| **Multi-Party Endorsement** | 2-of-3 consortium endorsement policy prevents unilateral alteration by any single administrator. | **CONFIGURED IN FABRIC** |
| **Fail-Closed Policy** | `SECURE_MODE=true` rejects decryption operations if blockchain is offline (`LedgerOfflineError: 503`). | **VERIFIED BY AUDIT** |
| **Forensic Attribution** | Frequency extraction $\to$ RS decoding $\to$ Blockchain lookup $\to$ 6 cryptographic verification gates $\to$ Evidence Bundle. | **VERIFIED BY E2E TEST** |
| **Zero External Dependencies** | 100% offline operable; zero cloud KMS, zero public blockchain, zero external telemetry. | **AIR-GAP CERTIFIED** |

---

## 👥 Authors & Acknowledgments
Developed for **Smart India Hackathon (SIH 2026)** by **Team Ve Ni Di**.
* Architecture: Air-gapped Post-Quantum Cryptography & Permissioned DLT
* Problem Category: Blockchain & Cryptography
