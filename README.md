# QuantumGuard: Post-Quantum Document Security & Forensics

## 🌟 SIH 2026 Innovation
This system is designed for high-security defense environments where traditional RSA/ECC encryption is vulnerable to future Quantum computing threats.

### 🛠 Key Features
- **Hybrid PQC:** Implements NIST FIPS 203 (ML-KEM) combined with X25519 to ensure security even if one algorithm is compromised.
- **Dynamic AI Policy:** The system reads the document and automatically scales encryption strength based on content sensitivity.
- **Forensic Watermarking:** Uses DCT-domain steganography with Reed-Solomon Error Correction to track leaks back to specific devices.
- **Immutable Ledger:** All access logs are hashed and stored in a chain-of-custody ledger.

### 🚀 Setup
1. `pip install -r requirements.txt`
2. Install `liboqs` for Post-Quantum support (with automatic pure-Python NIST FIPS 203/204 fallback for air-gapped/offline systems).
3. Run `python -m uvicorn app.main:app --reload` (or `python main.py` in `backend/`) for the backend.
4. Open the Android / Frontend folder for the client application.

---

## 📌 Executive Summary & Architecture Overview

**QuantumGuard (CIPHERTRACE)** addresses the critical vulnerability in defense, intelligence, and confidential enterprise workflows: the **insider threat and post-decryption leak problem**.

Traditional perimeter security, DRM, and transit encryption (TLS/VPN) protect documents in transit and at rest. However, once an authorized recipient decrypts a file on an endpoint, traditional safeguards end. If the recipient photographs the display, prints the document, or leaks the digital copy, attribution is near-impossible due to plausible deniability.

QuantumGuard guarantees that **no recipient can access a confidential document without their identity being indelibly, invisibly bound into every page via 2D Discrete Cosine Transform (DCT) spread-spectrum steganography, authenticated with Post-Quantum Digital Signatures (ML-DSA-65), and committed to an immutable chain-of-custody ledger.**

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
                    3. Fabric LookupByWatermark Query
                    4. ML-DSA-65 Cryptographic Verification
                    5. Document SHA3-256 Hash Verification
                    6. Forensic Auditor Dynamic Confidence Score
                    7. Court-Admissible Evidence Bundle Export
```

---

## 🚀 Core Architectural Pillars

### 1. ⚛️ Genuine NIST Post-Quantum & Hybrid Cryptography
* **Hybrid PQC Engine (`HybridPQCEngine`)**: Combines NIST FIPS 203 (ML-KEM-512 / 768 / 1024) with classical Curve25519 (X25519) Diffie-Hellman using HKDF-SHA256. Guarantees confidentiality even if one cryptographic primitive is compromised.
* **ML-KEM-768 (NIST FIPS 203)**: Module-Lattice-Based Key-Encapsulation Mechanism. Protects symmetric Document Encryption Keys (DEKs) against "harvest-now, decrypt-later" quantum adversary threats. (1184-byte public key, 2400-byte private key, 1088-byte ciphertext).
* **ML-DSA-65 (NIST FIPS 204)**: Module-Lattice-Based Digital Signature Algorithm. Produces mathematically non-repudiable digital signatures during recipient decryption events. (1952-byte public key, 4032-byte private key, 3309-byte signature).
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

### 4. 🔐 Zero Plaintext Private Key Storage (Client Keystore Isolation)
* **No Database Private Keys**: The application database (`ciphertrace_v2.db`) stores only public keys, public key fingerprints (`kem_key_id`, `dsa_key_id`), key status, and role metadata. Raw private keys never touch SQLite.
* **Recipient Encrypted Keystore**: Private keys are stored in encrypted offline keystores (`Argon2id` KDF with 64 MB memory, 3 iterations, 4 parallel lanes + `AES-256-GCM`).
* **Client-Side Enclave Boundary**: Keystores are unlocked exclusively on the recipient device during viewing. Decapsulation and signing occur within the keystore boundary; raw private keys are explicitly zeroed from memory immediately after use.

### 5. 👁️ Robust 2D DCT Steganography & True RS(255,127) FEC
* **Luminance Modulation**: Documents are rendered at deterministic 150 DPI; the luminance ($Y$) channel is decomposed into $8 \times 8$ blocks and mid-frequency DCT coefficients $(3,3)$ are modulated to ensure visual imperceptibility ($\text{PSNR} > 42\text{ dB}$, $\Delta E < 0.1$).
* **Full Reed-Solomon RS(255,127)**: Uses 127 data symbols and 128 parity symbols (`RSCodec(128)` over $\text{GF}(2^8)$). Capable of correcting up to 64 corrupted symbol errors.

### 6. ⛓️ Permissioned Hyperledger Fabric Blockchain (3-Org Consortium)
* **Air-Gapped Consortium Network**:
  * **Org1 (Defense Tactical Command)**: Operational command peer node.
  * **Org2 (Independent Audit Authority)**: Compliance & inspector peer node.
  * **Org3 (Forensic Investigation Bureau)**: Forensic investigator peer node.
  * **Raft Ordering Service**: Crash fault-tolerant consensus ordering.
* **Smart Contract (`forensic-audit`)**: Implements `RecordDecryption`, `LookupByWatermark`, `GetRecord`, and `GetAllRecords`.
* **2-of-3 Endorsement Policy**: Requires endorsement from at least 2 independent organizations before a decryption record is committed to the blockchain.

---

## 🛠️ Software Stack & Key Libraries

| Component | Library / Tool | Standard / Specification |
| :--- | :--- | :--- |
| **Post-Quantum KEM** | `liboqs` / `mlkem` | NIST FIPS 203 (ML-KEM-512 / 768 / 1024) |
| **Post-Quantum Signatures** | `liboqs` / `dilithium-py` | NIST FIPS 204 (ML-DSA-65) |
| **Classical Asymmetric** | `cryptography` (X25519) | RFC 7748 |
| **Hybrid Key Derivation** | HKDF-SHA256 | RFC 5869 |
| **Authenticated Cipher** | AES-256-GCM | NIST SP 800-38D |
| **Hashing & Integrity** | SHA3-256 / HMAC-SHA3 | NIST FIPS 202 |
| **Local Keystore KDF** | `argon2-cffi` | RFC 9106 (Argon2id) |
| **Steganography & DCT** | `scipy`, `numpy`, `opencv` | 2D Discrete Cosine Transform |
| **Forward Error Correction**| `reedsolo` | Reed-Solomon RS(255, 127) over GF(2^8) |
| **Web API Engine** | `fastapi`, `uvicorn` | ASGI High-Performance Async |
