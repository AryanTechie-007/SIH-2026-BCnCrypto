# QuantumGuard: Post-Quantum Document Security & Forensics

## 🌟 SIH 2026 Innovation
This system is designed for high-security defense environments where traditional RSA/ECC encryption is vulnerable to future Quantum computing threats.

### 🏛️ The Three Pillars of QuantumGuard
1. **The Backend (AI/PQC Brain):** FastAPI engine orchestrating NIST FIPS 203 ML-KEM + X25519 Hybrid Encryption, real-time Dynamic AI Sensitivity Classification, and Forensic Bit-Error-Rate (BER) confidence scoring.
2. **The Desktop App (Command Center):** CustomTkinter modern dark-themed "Defense-Grade" workstation app featuring real-time AI Sensitivity gauge, file encryption, and chain-of-custody audit logs.
3. **The Android Port (Field Access):** Native Kotlin client with biometric authentication, FLAG_SECURE display protection, and on-device hybrid decryption.

---

### 🛠 Key Features
- **Hybrid PQC:** Implements NIST FIPS 203 (ML-KEM-512 / 768 / 1024) combined with classical Curve25519 (X25519) to ensure security even if one algorithm is compromised.
- **Dynamic AI Policy:** The system reads the document and automatically scales encryption strength based on content sensitivity (`TOP_SECRET` forces ML-KEM-1024 + MFA, `CONFIDENTIAL` enforces ML-KEM-768 + Biometrics).
- **Forensic Watermarking:** Uses 2D DCT-domain spread-spectrum steganography with Reed-Solomon RS(255,127) Forward Error Correction to track leaks back to specific devices.
- **Signal-to-Noise Confidence Scoring:** Real-time BER and SNR confidence scoring providing court-admissible forensic evidence packages.
- **Immutable Ledger:** All access logs and decryption events are committed to immutable smart contracts (`contracts/DocumentLedger.sol` and Hyperledger Fabric).

---

### 📂 Project Directory Structure

```text
/QuantumGuard-SIH2026
│
├── /backend            # Python FastAPI + NIST PQC Engine
│   ├── main.py         # Entrypoint server launcher
│   ├── /services
│   │   ├── crypto_engine.py  # Hybrid PQC (ML-KEM + X25519) & NIST FIPS 203/204
│   │   ├── ai_engine.py      # Dynamic Content Sensitivity Classifier
│   │   └── forensics.py      # Forensic Auditor & Confidence Scoring
│   └── requirements.txt
│
├── /desktop            # CustomTkinter Desktop Command Center
│   ├── main_app.py     # Dark-themed UI with real-time AI Sensitivity Gauge
│   └── assets/         # UI assets and logos
│
├── /android            # Native Kotlin Android Mobile App
│   ├── /app/src/main/java/com/sih2026/quantumguard/HybridSecurityManager.kt
│   └── build.gradle.kts
│
├── /contracts          # Blockchain Chain-of-Custody Logic
│   └── DocumentLedger.sol
│
├── /frontend           # React + TypeScript Web Console (Optional)
├── setup.sh            # One-click dependency installer (Linux / Mac)
├── setup.bat           # One-click dependency installer (Windows)
├── requirements.txt    # Unified dependencies
└── README.md           # Defense Documentation
```

---

### 🚀 One-Click Setup & Launch

#### Step 1: Install Dependencies
* **Linux / Mac:** `./setup.sh`
* **Windows:** Run `setup.bat` (or `pip install -r requirements.txt`)

#### Step 2: Start Backend Server
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
# or directly:
cd backend && python main.py
```

#### Step 3: Launch Desktop Command Center
```bash
python desktop/main_app.py
```

#### Step 4: Open Android Mobile App
Open the `./android` folder in **Android Studio** and run on device/emulator.

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

### 4. 📱 Android Field Client (`HybridSecurityManager`)
* **Hardware Shielding:** Enforces `FLAG_SECURE` window policies to prevent screenshotting, screen capture, and display tampering on mobile devices.
* **On-Device Hybrid Decryption:** Unpacks quantum and classical secret envelopes directly on endpoint memory.

---

## 🛠️ Software Stack & Key Libraries

| Component | Library / Tool | Standard / Specification |
| :--- | :--- | :--- |
| **Desktop UI** | `customtkinter` | Modern Defense-Grade Dark UI |
| **Mobile Client** | Kotlin / Android Jetpack | Material 3 + Biometrics |
| **Post-Quantum KEM** | `liboqs` / `mlkem` | NIST FIPS 203 (ML-KEM-512 / 768 / 1024) |
| **Post-Quantum Signatures** | `liboqs` / `dilithium-py` | NIST FIPS 204 (ML-DSA-65) |
| **Classical Asymmetric** | `cryptography` (X25519) | RFC 7748 |
| **Hybrid Key Derivation** | HKDF-SHA256 | RFC 5869 |
| **Authenticated Cipher** | AES-256-GCM | NIST SP 800-38D |
| **Smart Contracts** | Solidity & Chaincode | Immutable Chain-of-Custody |
| **Forward Error Correction**| `reedsolo` | Reed-Solomon RS(255, 127) over GF(2^8) |
| **Web API Engine** | `fastapi`, `uvicorn` | ASGI High-Performance Async |
