# 🛡️ CIPHERTRACE
> **Offline Post-Quantum Cryptographic Document Attribution & Immutable Provenance Platform**  
> *Developed for Smart India Hackathon (SIH 2026) | Problem Statement: Blockchain & Cryptography*

---

## 📌 Executive Summary
**CIPHERTRACE** solves the critical **insider threat and post-decryption leak problem** in defense, intelligence, and high-security enterprises. 

While traditional security protects files in transit and at rest, once an authorized officer decrypts a document, traditional controls vanish. If an officer photographs their screen, prints, or leaks the PDF, attribution is nearly impossible due to plausible deniability.

CIPHERTRACE guarantees that **no recipient can access a classified document without their identity being indelibly, invisibly fused into every page via 2D Discrete Cosine Transform (DCT) spread-spectrum steganography, signed with Post-Quantum Digital Signatures (ML-DSA-65), and committed to an immutable append-only Merkle ledger.**

---

## 🚀 Key Architecture & Innovations

```
       SENDER (Command HQ)
                 │
                 ▼
[ Upload PDF: "Classified Operations" ]
                 │
   PQC Multi-Recipient Envelope Encryption
   (AES-256-GCM + NIST ML-KEM-768 Kyber)
                 │
        ┌────────┴────────┐
        ▼                 ▼
   Recipient A       Recipient B
        │
        ▼  (Recipient clicks "Decrypt")
[ 6-Step Atomic PQC Decryption Protocol ]
  1. Decapsulate AES key using ML-KEM-768 Private Key
  2. Generate Unique HMAC-SHA3-256 Session Watermark
  3. Embed Invisible 2D DCT Spread-Spectrum Watermark into PDF
  4. Recipient auto-signs receipt with ML-DSA-65 (Dilithium)
  5. Commit signed event into Hash-Chained Merkle Ledger
  6. Display/Export personalized PDF to Recipient
        │
   (Document Leaked!)
        │
        ▼
   LEAK DETECTED (Dark Web / Open Source)
        │
        ▼
[ Forensic Attribution Lab ]
  1. Ingest leaked PDF / screenshot
  2. 2D DCT frequency analysis extracts hidden bitstream
  3. Reed-Solomon (255, 127) ECC recovers payload despite compression/cropping
  4. Query ledger & identify leaker with cryptographic evidence bundle
```

### 1. ⚛️ Post-Quantum Cryptography (NIST Standardized)
- **ML-KEM-768 (Kyber)**: Quantum-resistant key encapsulation mechanism securing symmetric data encryption keys.
- **ML-DSA-65 (Dilithium)**: Quantum-resistant digital signatures establishing non-repudiation during recipient decryption.
- **AES-256-GCM**: High-throughput authenticated symmetric cipher for the document payload.

### 2. 👁️ Imperceptible & Robust 2D DCT Watermarking
- **2D Discrete Cosine Transform (DCT)**: Modulates mid-frequency DCT coefficients in the luminance ($Y$) channel of every page.
- **Reed-Solomon ECC (255, 127)**: Corrects bit flips caused by lossy JPEG compression, screen photographs, and noise.
- **Cropping & Geometric Resilience**: Spatial spread-spectrum distribution allows payload recovery even if up to 20% of page margins are trimmed.

### 3. ⛓️ Permissioned Hash-Chained Merkle Ledger
- Append-only cryptographic ledger tracking every decryption event.
- Blocks are chained with SHA3-256 previous-block hashes and Merkle root integrity.
- Immediate detection of database tampering or revisionist history.

### 4. 📴 100% Offline Air-Gapped Operation
- Zero reliance on external cloud services, third-party Certificate Authorities, or internet access.
- Deployable on tactical military edge servers, naval vessels, and isolated command centers.

---

## 🖥️ Interactive Dashboards

1. **Sender Studio**: Upload documents, select authorized personnel, and generate quantum-resistant encrypted distribution packages.
2. **Recipient Terminal**: Experience the 6-step atomic PQC handshake, key decapsulation, and automatic receipt signing.
3. **Forensic Attribution Lab**: Ingest suspected leaks, extract the hidden watermark payload, match against the ledger, and export court-admissible PDF evidence bundles.
4. **Attack Simulator**: Test watermark robustness against JPEG compression (Quality 30), cropping, rotation, and metadata stripping.
5. **Ledger & Tamper Lab**: Audit the cryptographic block ledger and test real-time tamper alarms by simulating block corruption.
6. **Continuity Graph**: Interactive visual provenance topology linking files, recipients, blocks, and forensic matches.

---

## ⚡ Quick Start Guide (Windows)

### Option 1: One-Click Launcher
Simply double-click:
```bat
start_demo.bat
```
This automatically boots both the FastAPI backend and Vite frontend, and opens `http://127.0.0.1:5173` in your browser.

---

### Option 2: Manual Setup

#### 1. Backend (Python 3.11+)
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # On Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- API Documentation (Swagger): `http://127.0.0.1:8000/docs`

#### 2. Frontend (Node.js 18+)
```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://127.0.0.1:5173`

---

### Option 3: Docker Deployment
```bash
docker-compose up --build
```

---

## 📁 Repository Structure
```
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI application entrypoint
│   │   ├── database.py           # SQLite async database & schema initialization
│   │   ├── schemas.py            # Pydantic request/response models
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── routers/              # Modular REST API endpoints
│   │   └── services/
│   │       ├── crypto_service.py     # PQC (ML-KEM, ML-DSA), AES-256-GCM, SHA3
│   │       ├── embedding_service.py  # 2D DCT spread-spectrum & Reed-Solomon ECC
│   │       ├── watermark_service.py  # HMAC-SHA3-256 payload derivation
│   │       └── ledger_service.py     # Hash-chained blocks & Merkle trees
│   ├── tests/                    # Crypto and pipeline unit tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/client.ts         # Dual-mode engine (LIVE API vs AIR-GAP DEMO)
│   │   ├── components/           # UI components, modals, visualizers
│   │   ├── pages/                # 6 defense dashboard modules
│   │   ├── types.ts              # TypeScript domain types
│   │   └── index.css             # Cyber-defense design system
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml            # Multi-container orchestration
├── SIH_DEMO_SCRIPT.md            # 5-minute timed presentation pitch & Q&A defense
└── start_demo.bat                # 1-click Windows runner
```

---

## 🔒 Security Compliance & Standards
- **NIST FIPS 203**: Module-Lattice-Based Key-Encapsulation Mechanism (ML-KEM / Kyber)
- **NIST FIPS 204**: Module-Lattice-Based Digital Signature Algorithm (ML-DSA / Dilithium)
- **NIST SP 800-38D**: Galois/Counter Mode (AES-GCM)
- **FIPS 202**: SHA-3 & SHAKE Permutation-Based Hash Functions

---

## 👥 Authors
Developed for **Smart India Hackathon 2026** by **Team Ve Ni Di**.
