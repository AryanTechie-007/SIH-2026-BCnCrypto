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

## ⚡ How to Run Locally on Your System

### 📋 Prerequisites
Make sure you have these installed on your computer:
1. **Python 3.11 or higher**: [Download Python](https://www.python.org/downloads/) *(Important: Check "Add Python to PATH" during installation!)*
2. **Node.js LTS (v18+)**: [Download Node.js](https://nodejs.org/)
3. **Git**: [Download Git](https://git-scm.com/)

---

### 🚀 Method 1: The 1-Click Installer (Fastest & Recommended)

#### Step 1: Clone the Repository
```bash
git clone https://github.com/AryanTechie-007/SIH-2026-BCnCrypto.git
cd SIH-2026-BCnCrypto
```

#### Step 2: Install All Dependencies
Double-click:
```bat
install_dependencies.bat
```
*(Or inside the `setup/` subfolder, double-click `setup\install_dependencies.bat`)*  
This automatically installs all required Python cryptographic packages and Frontend npm modules.

#### Step 3: Launch the Platform
Double-click:
```bat
start_demo.bat
```
This terminates any stale port processes, starts both the FastAPI backend and React frontend, and opens `http://127.0.0.1:5173` in your browser.

---

### 💻 Method 2: Manual Terminal Execution

#### Terminal 1 — FastAPI Cryptographic Backend (Port 8000)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Verify Backend: Open `http://127.0.0.1:8000/docs` in your browser.

#### Terminal 2 — React Military Defense UI (Port 5173)
```bash
cd frontend
npm install
npm run dev
```
- Open UI: Navigate to `http://127.0.0.1:5173` in your browser.

---

### 🌐 Method 3: Multi-Device / LAN Wi-Fi Access (Cross-Laptop Demo)
To let friends or evaluators connect from their laptops/phones on the same Wi-Fi:
1. Find the host laptop's local IP address (open PowerShell and run `ipconfig`).
2. Have your friends navigate to:
   ```
   http://<YOUR_LOCAL_IP>:5173
   ```
   *(Example: `http://192.168.0.110:5173`)*
3. Vite's proxy automatically routes API requests to the host's backend with zero CORS issues!

---

### 🐳 Method 4: Docker Container Deployment
```bash
docker-compose up --build
```

---

## ❓ Troubleshooting & Common Questions

#### 1. "Failed to fetch" on Operator Login or Enrollment
- **Cause**: The React frontend is open, but the **FastAPI backend is not running** on port 8000.
- **Fix**: Make sure you ran `start_demo.bat` (which starts BOTH servers), or run `python -m uvicorn app.main:app --port 8000` in the `backend` folder. Check `http://127.0.0.1:8000/api/system/health` to confirm the backend is live.

#### 2. "localhost refused to connect"
- **Cause**: Trying to open `localhost:5173` on a friend's machine while the code is running on your machine.
- **Fix**: Use your local Wi-Fi IP address instead of `localhost` (e.g. `http://192.168.x.x:5173`).

#### 3. "403 Forbidden / ACCESS DENIED" during Decryption
- **Cause**: This is **intended post-quantum access control**! When a classified file is encrypted in Stage 1, it is bound ONLY to the selected recipients' ML-KEM-768 public keys. If an unauthorized operator attempts to decrypt it, the enclave strictly rejects them.
- **Fix**: Switch your active operator to the officer who was granted access during distribution (e.g., Captain Verma or Commander Rao), or check your own username in Stage 1 when distributing.

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
