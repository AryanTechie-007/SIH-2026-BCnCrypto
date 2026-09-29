# CIPHERTRACE 2.0: Post-Quantum Confidential Document Security & Forensics

## 🌟 SIH 2026 Innovation
This system is designed for high-security defense environments where traditional RSA/ECC encryption is vulnerable to future Quantum computing threats.

### 🏛️ Key Architectural Components
1. **The Backend (AI/PQC Engine):** FastAPI engine orchestrating NIST FIPS 203 ML-KEM-768 + X25519 Hybrid Encryption, real-time Dynamic AI Sensitivity Classification, and Forensic Bit-Error-Rate (BER) confidence scoring.
2. **The Web Workstation Console:** React + TypeScript interactive web UI for envelope distribution, decapsulation, forensic leak analysis, and Hyperledger Fabric DLT auditing.
3. **The Forensic Audit Ledger:** Multi-org permissioned Hyperledger Fabric blockchain storing immutable post-quantum digital signatures (NIST FIPS 204 ML-DSA-65) and document hashes.

---

### 🛠 Key Features
- **Hybrid PQC:** Implements NIST FIPS 203 (ML-KEM-512 / 768 / 1024) combined with classical Curve25519 (X25519) to ensure security even if one algorithm is compromised.
- **Dynamic AI Policy:** The system reads the document and automatically scales encryption strength based on content sensitivity (`TOP_SECRET` forces ML-KEM-1024 + MFA, `CONFIDENTIAL` enforces ML-KEM-768 + Biometrics).
- **Forensic Watermarking:** Uses 2D DCT-domain spread-spectrum steganography with Reed-Solomon RS(255,127) Forward Error Correction to track leaks back to specific devices.
- **Signal-to-Noise Confidence Scoring:** Real-time BER and SNR confidence scoring providing court-admissible forensic evidence packages.
- **Immutable Ledger:** All access logs and decryption events are committed to Hyperledger Fabric permissioned DLT.

---

### 📂 Project Directory Structure

```text
/SIH-2026-BCnCrypto
│
├── /backend            # Python FastAPI + NIST PQC Engine
│   ├── main.py         # Entrypoint server launcher
│   ├── /app
│   │   ├── /services   # PQC crypto_engine, ai_engine, forensics, ledger_client
│   │   └── /routers    # REST API endpoints (documents, decryption, forensics, ledger)
│   └── requirements.txt
│
├── /frontend           # React + TypeScript Web Workstation Console
│   ├── src/            # Encryption, Decryption & Forensic Leak Labs
│   └── package.json
│
├── /forensic-audit     # Hyperledger Fabric DLT Forensic Audit Chaincode & Client
├── /contracts          # Blockchain Chain-of-Custody Smart Contracts
│   └── DocumentLedger.sol
│
├── setup.sh            # One-click dependency installer (Linux / Mac)
├── setup/              # Automated dependency installers (install_dependencies.bat / .sh)
├── requirements.txt    # Unified dependencies
└── README.md           # Defense Documentation
```

---

### 🚀 One-Click Setup & Launch

#### Step 1: Install Dependencies
* **Automated Installation:** Run `setup/install_dependencies.bat` (Windows) or `./setup/install_dependencies.sh` (Linux/Mac). Alternatively: `pip install -r requirements.txt`.

#### Step 2: Start Backend Server
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
# or directly:
cd backend && python main.py
```

#### Step 3: Start Web Workstation Console
```bash
cd frontend && npm run dev
```

---

## 📌 Executive Summary & Architecture Overview

**CIPHERTRACE 2.0** addresses the critical vulnerability in defense, intelligence, and confidential enterprise workflows: the **insider threat and post-decryption leak problem**.

Traditional perimeter security, DRM, and transit encryption (TLS/VPN) protect documents in transit and at rest. However, once an authorized recipient decrypts a file on an endpoint, traditional safeguards end. If the recipient photographs the display, prints the document, or leaks the digital copy, attribution is near-impossible due to plausible deniability.

CIPHERTRACE 2.0 guarantees that **no recipient can access a confidential document without their identity being indelibly, invisibly bound into every page via 2D Discrete Cosine Transform (DCT) spread-spectrum steganography, authenticated with Post-Quantum Digital Signatures (ML-DSA-65), and committed to an immutable chain-of-custody ledger.**

```
                      AIR-GAPPED DEFENSE LAN
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                               │
  Sender System                                 Recipient Device
  (Officer / Authority)                         (Authorized User)
        │                                               │
        │ Upload PDF & Select Recipients                │ Local Encrypted Keystore
        │ Hybrid PQC (ML-KEM-768 + X25519)              │ (Argon2id + AES-256-GCM)
        │ AI Dynamic Sensitivity Classification         │ [Private Keys NEVER sent to Server]
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
                    3. Fabric / Ledger LookupByWatermark
                    4. ML-DSA-65 Cryptographic Verification
                    5. Document SHA3-256 Hash Verification
                    6. Forensic Auditor Dynamic Confidence Score
                    7. Court-Admissible Evidence Bundle Export
```

---

## 🚀 Core Architectural Pillars

### 1. ⚛️ Genuine NIST Post-Quantum & Hybrid Cryptography
* **Hybrid PQC Engine (`HybridPQCEngine`)**: Combines NIST FIPS 203 (ML-KEM-512 / 768 / 1024) with classical Curve25519 (X25519) Diffie-Hellman using HKDF-SHA256. Guarantees confidentiality even if one cryptographic primitive is compromised.
* **ML-KEM-768 (NIST FIPS 203)**: Module-Lattice-Based Key-Encapsulation Mechanism. Protects symmetric Document Encryption Keys (DEKs) against "harvest-now, decrypt-later" quantum adversary threats.
* **ML-DSA-65 (NIST FIPS 204)**: Module-Lattice-Based Digital Signature Algorithm. Produces mathematically non-repudiable digital signatures during recipient decryption events.
* **AES-256-GCM (NIST SP 800-38D)**: Authenticated symmetric encryption for confidential document payloads.
* **SHA3-256 (NIST FIPS 202)**: Permutation-based hashing for canonical serialization, Merkle roots, block hash chains, and HMAC-SHA3-256 watermark payload authentication.

### 2. 🧠 Dynamic AI Policy Classifier (`DocumentIntelligence`)
* Automatically scans document text content and classifies sensitivity into defense tiers:
  * **TOP_SECRET**: Forces `ML-KEM-1024`, `MFA_REQUIRED` authentication, and heavy watermark embedding strength (`0.15`).
  * **CONFIDENTIAL**: Enforces `ML-KEM-768`, `BIOMETRIC` verification, and watermark strength (`0.10`).
  * **RESTRICTED / UNCLASSIFIED**: Applies `ML-KEM-512`, `PASSWORD` auth, and watermark strength (`0.05`).

### 3. 🔬 Forensic Integrity Auditor (`ForensicAuditor`)
* Real-time Signal-to-Noise Ratio (SNR) and Bit Error Rate (BER) evaluation.
* Calculates court-admissible confidence scoring ($\text{Confidence} = \max(0, 100 - (\text{BER} \times 500))$).
* Determines evidentiary admissibility (`VALID` vs. `QUESTIONABLE`) and reconstruction success rate.

---

## 🛠️ Software Stack & Key Libraries

| Component | Library / Tool | Standard / Specification |
| :--- | :--- | :--- |
| **Web Workstation** | React 18 / TypeScript / Vite | Modern Tactical Dark UI |
| **Post-Quantum KEM** | `liboqs` / `mlkem` | NIST FIPS 203 (ML-KEM-512 / 768 / 1024) |
| **Post-Quantum Signatures** | `liboqs` / `dilithium-py` | NIST FIPS 204 (ML-DSA-65) |
| **Classical Asymmetric** | `cryptography` (X25519) | RFC 7748 |
| **Hybrid Key Derivation** | HKDF-SHA256 | RFC 5869 |
| **Authenticated Cipher** | AES-256-GCM | NIST SP 800-38D |
| **Smart Contracts** | Solidity & Hyperledger Fabric Chaincode | Immutable Chain-of-Custody |
| **Forward Error Correction**| `reedsolo` | Reed-Solomon RS(255, 127) over GF(2^8) |
| **Web API Engine** | `fastapi`, `uvicorn` | ASGI High-Performance Async |
