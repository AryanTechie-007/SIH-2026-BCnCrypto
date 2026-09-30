# CIPHERTRACE: Post-Quantum Confidential Document Security & Forensic Attribution

[![Standard](https://img.shields.io/badge/NIST%20PQC-FIPS%20203%20%7C%20FIPS%20204-0284c7.svg)](#-genuine-nist-post-quantum-cryptography)
[![Steganography](https://img.shields.io/badge/Watermark-2D%20DCT%20%2B%20Hadamard%20DSSS-10b981.svg)](#-walsh-hadamard-transform-whtdsss-steganography)
[![Consortium](https://img.shields.io/badge/Blockchain-Hyperledger%20Fabric%203--Org-6366f1.svg)](#-multi-organization-distributed-ledger)
[![Platform](https://img.shields.io/badge/Deployment-100%25%20Offline%20%2F%20Air--Gapped-f59e0b.svg)](#-deployment--operational-modes)

**CIPHERTRACE** is an air-gapped, post-quantum secure document dissemination and forensic leak attribution platform engineered for defense, intelligence, and high-security enterprise environments.

It solves the critical **insider threat and post-decryption leak problem**: once an authorized user decrypts a confidential PDF on an endpoint, traditional perimeter protections (DRM, TLS, VPN) cease to apply. CIPHERTRACE binds the recipient's cryptographic identity indelibly into the document using **2D Discrete Cosine Transform (DCT) spread-spectrum watermarking with Walsh-Hadamard orthogonal spreading**, signs the decryption transaction with **NIST FIPS 204 ML-DSA-65**, and immutably records the event on a **Hyperledger Fabric permissioned ledger**.

---

## 🏛️ System Architecture

```
                      AIR-GAPPED DEFENSE LAN
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                               │
  Sender System                                 Recipient Device
  (Disseminating Authority)                     (Authorized Officer)
        │                                               │
        │ 1. Upload Confidential PDF                    │ Local Encrypted Keystore
        │ 2. Dynamic Sensitivity Classification         │ (Argon2id + AES-256-GCM)
        │ 3. ML-KEM-768 DEK Encapsulation               │ [Private Keys NEVER sent to Server]
        │ 4. Document SHA3-256 Digest                   │
        │                                               │
        ▼                                               ▼
┌───────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                          │
│        (PQC Key Coordination • Ephemeral Distribution)         │
└───────────────┬───────────────────────────────┬───────────────┘
                │                               │
                ▼                               ▼
    SQLite Operational Store        Hadamard Watermark Engine
    - Public Keys & Key IDs         - 16-Byte Authenticated Frame
    - User Profiles & Roles         - Sylvester-Hadamard H_64 Basis
    - NO Plaintext Private Keys     - Zero DC Shift (PSNR > 41 dB)
                │                               │
                └───────────────┬───────────────┘
                                │
                                ▼
         ┌─────────────────────────────────────────────┐
         │ Hyperledger Fabric 3-Org Permissioned DLT   │
         │ - Org1 Peer: Defense Tactical Command       │
         │ - Org2 Peer: Independent Audit Authority    │
         │ - Org3 Peer: Forensic Investigation Bureau  │
         │ - Raft Ordering Service (Consensus)         │
         │ - Endorsement Policy: 2-of-3 Consortium     │
         └──────────────────────┬──────────────────────┘
                                │
                    SUSPECT PDF LEAK OCCURS
                                │
                                ▼
                    Forensic Attribution Lab
                    1. PDF Canvas Rasterization (150 DPI)
                    2. Coherent 2D DCT Hadamard Correlation Decoding
                    3. Ledger Watermark Lookup (Fabric / Local DLT)
                    4. 7 Cryptographic Verification Gates Execution
                    5. Officer Attribution & Evidence Bundle Export
```

---

## 🚀 Core Technologies & Implementation

### 1. ⚛️ Genuine NIST Post-Quantum Cryptography
* **ML-KEM-768 (NIST FIPS 203)**:
  - Module-Lattice-Based Key-Encapsulation Mechanism protecting symmetric Document Encryption Keys (DEKs).
  - Public Key: `1184 bytes`, Private Key: `2400 bytes`, Ciphertext: `1088 bytes`, Shared Secret: `32 bytes`.
  - Supported via native `liboqs` (C library) with pure-Python fallback wheel (`mlkem`).
* **ML-DSA-65 (NIST FIPS 204)**:
  - Module-Lattice-Based Digital Signature Algorithm generating non-repudiable audit signatures during recipient decapsulation.
  - Public Key: `1952 bytes`, Private Key: `4032 bytes`, Signature: `3309 bytes`.
  - Supported via `liboqs` / `dilithium-py`.
* **AES-256-GCM (NIST SP 800-38D)**:
  - Authenticated symmetric payload encryption with random 96-bit IVs and 128-bit authentication tags.
* **SHA3-256 & HMAC-SHA3-256 (NIST FIPS 202)**:
  - Permutation-based cryptographic hashing for canonical document fingerprints, Merkle trees, and watermark authenticity tags.
* **Zero Plaintext Private Key Invariant**:
  - Private keys are stored in encrypted client-side keystores (`Argon2id` KDF + `AES-256-GCM`).
  - Private keys are unlocked in volatile memory solely during decapsulation/signing and zeroed immediately; they are never sent across the wire or stored in database tables.

---

### 2. 🛡️ Walsh-Hadamard Transform (WHT/DSSS) Steganography
The watermarking pipeline modulates frequency components of genuine PDF documents using Direct Sequence Spread Spectrum (DSSS) over orthogonal Hadamard basis vectors:

* **Sylvester-Hadamard Order-64 Basis ($H_{64}$)**:
  - Generates 64 mutually orthogonal basis rows satisfying $H \cdot H^T = 64 \cdot I_{64}$.
  - Basis patterns are selected strictly from AC rows (zero mean sum), ensuring **Zero DC Shift**.
  - Mean block luminance is strictly preserved, preventing checkerboard, ripple, or tint artifacts ($\text{PSNR} > 41 \text{ dB}$).
* **16-Byte Authenticated Watermark Frame**:
  ```text
  ┌──────────────────────┬──────────────────────┬─────────────┐
  │ Watermark ID (10 B)  │ Authenticity Tag(4 B)│ Magic (2 B) │
  │ 20 Hex Characters    │ HMAC-SHA3-256 Trunc  │  0x43 0x50  │
  └──────────────────────┴──────────────────────┴─────────────┘
  ```
  - Total bits: 128 bipolar bits ($\{-1, +1\}$).
* **2D DCT Frequency Modulation**:
  - The document is rendered to canvas at deterministic 150 DPI.
  - Converted to $Y\text{CrCb}$ color space; modulation applies exclusively to the $Y$ (luminance) channel across discrete $8\times 8$ pixel blocks.
  - Modulates low-to-mid AC frequency coefficients with orthogonal Hadamard basis patterns at configurable embed strength ($\alpha = 20.0$).
* **Coherent Correlation Recovery**:
  - Blind extraction projects DCT coefficients against the orthogonal Hadamard basis.
  - Coherent spatial averaging across thousands of page blocks yields processing gains exceeding $\approx 42\text{ dB}$, enabling recovery even from heavily re-encoded documents.
* **Format Scope**:
  - Dedicated forensic watermark extraction on genuine PDF documents (`.pdf`).

---

### 3. 🔬 Forensic Attribution Lab & Verification Gates
When a leaked PDF is ingested into the Forensic Lab (`/api/forensics/analyze`), the system extracts the watermark frame and executes **7 Cryptographic Verification Gates**:

| Gate | Verification Check | Security Guarantee |
| :--- | :--- | :--- |
| **Gate 1** | Watermark Recovered with Valid Tag | Confirms genuine watermark presence, low BER ($< 5\%$), and valid HMAC tag. |
| **Gate 2** | Ledger Decryption Event Exists | Verifies the watermark ID maps to an authorized decryption event on the node. |
| **Gate 3** | Recipient NIST ML-DSA-65 Signature Valid | Proves recipient digitally signed the access request using their private key. |
| **Gate 4** | Merkle Inclusion Proof Valid | Mathematical proof of event inclusion inside the audit block's Merkle tree. |
| **Gate 5** | Document SHA3-256 Hash Match | Guarantees the leaked PDF matches the exact classified document distributed. |
| **Gate 6** | Ledger Chain Integrity Valid | Validates cryptographic hash chaining across all blocks without tampering. |
| **Gate 7** | Fabric Consensus Endorsement Valid | Confirms multi-organization endorsement from consortium peers. |

Upon passing all gates, the platform exports a signed **Evidence Bundle** (`EvidenceBundle`) containing timestamped event parameters, officer credentials, device identifiers, and SHA3-256 validation digests.

---

### 4. ⛓️ Multi-Organization Distributed Ledger
* **Consortium Peers**:
  - `Org1`: Defense Tactical Command (Operations)
  - `Org2`: Independent Military Audit Authority (Oversight)
  - `Org3`: Forensic Investigation Bureau (Intelligence)
* **Smart Contract Chaincode (`forensic-audit`)**:
  - Methods: `RecordDecryption`, `LookupByWatermark`, `GetRecord`, `GetAllRecords`.
  - Endorsement Policy: 2-of-3 consortium agreement required for state commit.
* **Dual Execution Modes (`config.py`)**:
  - **`DEMO_MODE=true`**: Fast startup using local SQLite ledger with cryptographic block hash chaining and Merkle trees. Ideal for evaluations and local demonstrations.
  - **`SECURE_MODE=true`**: Enforces strict fail-closed connectivity to the live Hyperledger Fabric network (`503 Service Unavailable` if Fabric is unreachable).

---

### 5. ⚔️ Attack Verification & Degradation Lab
The platform includes an automated adversarial attack simulator (`/api/attacks/run`) to test watermark persistence against physical and channel distortions:
- **Severe JPEG Recompression**: Quality factor down to 35% (high-frequency coefficient stripping).
- **Aggressive Margin Crop**: 12% border and classification banner trimming.
- **Screen Grab Simulation**: Resampling to 72 DPI display grid.
- **Geometric Downsampling**: Rescaling to 75% dimensions and interpolating back.
- **Complete Metadata Purge**: Full stripping of PDF metadata and XMP streams.

---

## 📂 Project Structure

```text
SIH-2026-BCnCrypto/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI application entrypoint & middleware
│   │   ├── config.py                # Environment configuration (DEMO_MODE / SECURE_MODE)
│   │   ├── database.py              # Async SQLAlchemy session & SQLite engine
│   │   ├── schemas.py               # Pydantic schemas (strictly no private keys)
│   │   ├── models/
│   │   │   └── database.py          # ORM models (User, Document, WatermarkRecord, LedgerBlock)
│   │   ├── services/
│   │   │   ├── crypto_engine.py     # NIST FIPS 203 ML-KEM-768 & FIPS 204 ML-DSA-65
│   │   │   ├── watermark_engine.py  # 2D DCT + Walsh-Hadamard WHT/DSSS Steganography
│   │   │   ├── keystore.py          # Encrypted recipient keystores (Argon2id + AES-GCM)
│   │   │   ├── ledger_engine.py     # Merkle tree verification & local block chaining
│   │   │   └── ledger_client.py     # Hyperledger Fabric chaincode integration client
│   │   └── routers/
│   │       ├── auth.py              # User authentication & JWT token generation
│   │       ├── documents.py         # Encrypted envelope generation & distribution
│   │       ├── decryption.py        # Keystore-isolated decapsulation, watermarking & signing
│   │       ├── forensics.py         # Single-file & batch PDF forensic leak attribution
│   │       ├── ledger.py            # Block inspection, Merkle proofs & tamper simulation
│   │       ├── attacks.py           # Adversarial attack degradation lab
│   │       ├── identity.py          # Officer directory & public key registry
│   │       └── system.py            # Node status & cryptographic capability telemetry
│   ├── keystores/                   # Recipient encrypted keystore files (*.keystore)
│   ├── tests/
│   │   └── test_hadamard.py         # Hadamard matrix orthogonality & PDF roundtrip tests
│   ├── requirements.txt             # Backend dependencies
│   └── Dockerfile                   # Container build definition
├── frontend/
│   ├── src/
│   │   ├── components/              # Tactical UI elements, Navbar, Topbar, LoginPage
│   │   ├── views/
│   │   │   ├── OverviewConsole.tsx          # Real-time dashboard & cryptographic metrics
│   │   │   ├── DisseminationConsole.tsx     # PDF encryption & multi-recipient distribution
│   │   │   ├── DecryptionConsole.tsx        # Keystore unlock, decapsulation & watermarking
│   │   │   ├── ForensicConsole.tsx          # Forensic attribution lab & gate verification
│   │   │   ├── EvidenceConsole.tsx          # Evidence bundle viewer & dossier inspector
│   │   │   ├── AttackVerificationConsole.tsx# Live degradation stress-testing
│   │   │   ├── LedgerAuditConsole.tsx       # Merkle tree & blockchain block explorer
│   │   │   └── UserManagementConsole.tsx    # Officer management & key generation
│   │   ├── types/                   # TypeScript interfaces matching backend schemas
│   │   └── api/                     # Axios API clients
│   ├── package.json
│   └── vite.config.ts
├── blockchain/
│   ├── chaincode/
│   │   └── forensic-audit/          # Fabric chaincode (Go / Node.js)
│   └── scripts/                     # Network bootstrap scripts
├── contracts/
│   └── DocumentLedger.sol           # Solidity chain-of-custody smart contract
├── forensic-audit/                  # Hyperledger Fabric chaincode implementation
├── setup/                           # Environment setup utilities
├── run_backend.bat                  # One-click Windows backend launcher
├── run_frontend.bat                 # One-click Windows frontend launcher
├── start_demo.bat                   # Full stack demonstration orchestrator
├── requirements.txt                 # Root Python requirements
└── DOCUMENTATION.md                 # Detailed operational specification
```

---

## 🛠️ Software Stack & Dependencies

| Component | Library / Framework | Purpose |
| :--- | :--- | :--- |
| **Backend API** | FastAPI / Uvicorn | High-performance asynchronous ASGI REST services |
| **Post-Quantum KEM** | `mlkem` / `liboqs` | NIST FIPS 203 ML-KEM-768 key encapsulation |
| **Post-Quantum Signature** | `dilithium-py` / `liboqs` | NIST FIPS 204 ML-DSA-65 digital signatures |
| **Symmetric Encryption** | `cryptography` | AES-256-GCM authenticated cipher & Argon2id KDF |
| **Document Processing** | PyMuPDF (`fitz`), Pillow | Deterministic PDF rendering & image canvas creation |
| **Steganography Engine** | `opencv-python-headless`, `numpy` | 2D DCT transformations & Hadamard matrix operations |
| **Database Engine** | SQLAlchemy 2.0 / `aiosqlite` | Asynchronous local ledger & state persistence |
| **Frontend Console** | React 18 / TypeScript / Vite | Tactical military dark-mode command workstation |
| **Icons & Styling** | Lucide React | Tactical defense console iconography |

---

## ⚡ Quickstart Guide

### Prerequisites
- **Python**: 3.10, 3.11, 3.12, or 3.13
- **Node.js**: v18+ and `npm`

---

### Step 1: Install Dependencies

```bash
# Install Python backend dependencies
pip install -r requirements.txt

# Install Frontend dependencies
cd frontend
npm install
cd ..
```

---

### Step 2: Launch Backend Service

**Windows:**
```cmd
run_backend.bat
```
*Or manually:*
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The interactive Swagger API documentation will be available at: `http://localhost:8000/docs`

---

### Step 3: Launch Web Workstation Console

**Windows:**
```cmd
run_frontend.bat
```
*Or manually:*
```bash
cd frontend
npm run dev
```
Open your browser to: `http://localhost:5173`

---

### Step 4: Run Automated Tests

Execute the unit test suite verifying Hadamard matrix orthogonality, authenticated frame serialization, and PDF watermarking roundtrip fidelity:

```bash
python backend/tests/test_hadamard.py
```

Expected output:
```text
Ran 3 tests in ~1.3s
OK
[BENCHMARK] Hadamard Document PSNR: 41.76 dB (Strength=20.0)
```

---

## 🔒 Security Invariants & Assurance Summary

1. **Air-Gapped Operation**: Zero internet calls; all cryptographic libraries and models execute locally on the node.
2. **Private Key Non-Transmission**: Secret keys reside exclusively in encrypted `.keystore` files; the server only ever receives public keys and signatures.
3. **Multi-Org Consensus**: No single administrator can alter ledger records without 2-of-3 consortium endorsement.
4. **Permanent Attribution**: Every decrypted PDF embeds an invisible, cryptographically signed watermark that mathematically points back to the decrypting officer.
