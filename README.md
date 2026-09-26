# 🛡️ CIPHERTRACE
> **Post-Quantum Cryptographic Document Security, Watermarking & Immutable Provenance Platform**  
> *Developed for Smart India Hackathon (SIH 2026) | Problem Statement: Blockchain & Cryptography*

---

## 📌 Executive Summary
**CIPHERTRACE** solves the critical **insider threat and post-decryption leak problem** for any individual, team, or enterprise handling confidential documents.

While traditional security protects files in transit and at rest, once an authorized recipient decrypts a document, traditional controls vanish. If a user photographs their screen, prints, or leaks the PDF, attribution is nearly impossible due to plausible deniability.

CIPHERTRACE guarantees that **no recipient can access a confidential document without their identity being indelibly, invisibly fused into every page via 2D Discrete Cosine Transform (DCT) spread-spectrum steganography, signed with Post-Quantum Digital Signatures (ML-DSA-65), and committed to an immutable append-only Merkle ledger.**

---

## 🚀 Key Architecture & Innovations

```
       SENDER (Document Owner / Sender)
                 │
                 ▼
[ Upload PDF: "Confidential Project Roadmap" ]
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
   LEAK DETECTED (Web, Forum, or Social Channels)
        │
        ▼
[ Forensic Attribution Lab ]
  1. Ingest leaked PDF / screenshot
  2. 2D DCT frequency analysis extracts hidden bitstream
  3. Reed-Solomon (255, 127) ECC recovers payload despite compression/cropping
  4. Query ledger & identify leaker with cryptographic evidence bundle
```

### 1. ⚛️ Post-Quantum Cryptography (NIST Standardized)
- **ML-KEM-768 (Kyber)**: Quantum-resistant key encapsulation mechanism securing symmetric data encryption keys per recipient.
- **ML-DSA-65 (Dilithium)**: Quantum-resistant digital signatures establishing non-repudiation during recipient decryption.
- **AES-256-GCM**: High-throughput authenticated symmetric cipher for the document payload.

### 2. 👁️ Imperceptible & Robust 2D DCT Watermarking
- **2D Discrete Cosine Transform (DCT)**: Modulates mid-frequency DCT coefficients in the luminance ($Y$) channel of every page.
- **Reed-Solomon ECC (255, 127)**: Corrects bit flips caused by lossy JPEG compression, screen photographs, and noise.
- **Cropping & Geometric Resilience**: Spatial spread-spectrum distribution allows payload recovery even if page margins are trimmed.

### 3. ⛓️ Hybrid Distributed Ledger Layer (Hyperledger Fabric + Merkle DLT)
- **Hyperledger Fabric Interoperability (`Stream C DLT`)**: Fully compatible with enterprise Hyperledger Fabric v2.5.16 smart contracts (`RecordDecryption`, `LookupByWatermark`) with multi-organization majority endorsement (`Org1MSP`, `Org2MSP`).
- **High-Assurance Air-Gapped Fallback**: Operates zero-dependency cryptographic hash-chaining (SHA3-256) and binary Merkle trees when running offline or without Docker containers.
- **Strict Anti-Tamper Detection**: Detects any unauthorized retroactive SQL modifications or history rewrite attempts.

### 4. 🛡️ Zero-Storage Privacy Architecture (No Server Document Hoarding)
- **Zero Raw Document Persistence**: CIPHERTRACE is strictly an encryption, watermarking, and forensic tracing service—NOT a cloud storage repository.
- **Immediate In-Memory/Ephemeral Lifecycle**: Once a document is encrypted into an envelope (.enc), the plaintext PDF is immediately purged from the server disk.
- **Ephemeral Watermarked Delivery**: Decrypted watermarked PDFs are streamed to authorized recipients and cleaned up via background tasks immediately upon delivery.

### 5. 📴 100% Offline & Universal Operation
- Zero reliance on external cloud services, third-party Certificate Authorities, or internet access.
- Deployable on local workstations, enterprise servers, isolated intranets, or air-gapped secure labs.

---

## 🖥️ Interactive User Modules

1. **Secure Distribution (Send)**: Upload documents, select authorized recipients, and generate quantum-resistant encrypted distribution packages (.enc).
2. **Recipient Vault (Receive)**: Decapsulate encrypted files with post-quantum lattice keys and download personal watermarked copies.
3. **Forensic Audit Lab (Investigate)**: Ingest suspected leaks (PDFs, screenshots, crops), extract the hidden watermark payload, verify against the tamper-proof ledger, and identify the leaker with cryptographic evidence.

---

## 🛠️ Software, Dependencies & Technical Specifications

CIPHERTRACE is engineered with an enterprise-grade, post-quantum cryptographic stack that operates 100% offline with zero external cloud dependencies. Below is the complete manifest of software, runtimes, and libraries utilized across the platform:

### 1. 💻 Core System Runtimes & Infrastructure
| Software / Tool | Minimum Version | Category | Purpose in CIPHERTRACE |
| :--- | :--- | :--- | :--- |
| **Python** | `3.11+` | Backend Runtime | Core execution engine for PQC cryptography, DCT steganography, and REST APIs |
| **Node.js** | `v18.0+` (LTS) | Frontend Runtime | JavaScript runtime powering the Vite build pipeline and development server |
| **NPM** | `v9.0+` | Package Manager | Dependency management and script orchestration for the React client |
| **Git** | `2.30+` | Version Control | Source code control, multi-developer collaboration, and deployment tracking |
| **Docker** | `24.0+` *(Optional)* | Container Engine | Containerized deployment for isolated air-gapped environments |
| **Docker Compose** | `v2.20+` *(Optional)* | Orchestration | Multi-service orchestration for automated backend + frontend container clustering |
| **Windows PowerShell / Batch** | Windows 10/11 | OS Automation | Native 1-click startup (`start_demo.bat`) and dependency setup (`install_dependencies.bat`) |

---

### 2. 🐍 Backend Dependencies (`backend/requirements.txt`)

#### A. Cryptography, Post-Quantum Security & Distributed Ledger
| Package | Version / Source | Function & Technical Role |
| :--- | :--- | :--- |
| **`liboqs-python`** | Open Quantum Safe | **Post-Quantum Cryptography**: Direct C-bindings to NIST-standardized lattice algorithms: **ML-KEM-768** (FIPS 203 Kyber) for recipient key encapsulation and **ML-DSA-65** (FIPS 204 Dilithium) for quantum-resistant digital non-repudiation signatures. |
| **`cryptography`** | Latest (`pyca/cryptography`) | **Symmetric & Primitive Crypto**: Hardware-accelerated **AES-256-GCM** (NIST SP 800-38D) authenticated encryption, HKDF key derivation, and cryptographic random salt generation. |
| **`hashlib`** | Python Standard Library | **Ledger & Hashing Engine**: **SHA3-256** (FIPS 202) for Merkle leaf/root hashing, blockchain previous-block hash chaining, and HMAC-SHA3-256 session token generation. |
| **`sqlalchemy`** | `2.0+` | **Async ORM**: Async data mapping and transactional ledger state persistence. |
| **`aiosqlite`** | `0.19+` | **Async Database Driver**: High-concurrency, non-blocking asynchronous driver for the local SQLite tamper-evident blockchain ledger. |

#### B. Steganography, Signal Processing & Forensic Analysis
| Package | Version / Source | Function & Technical Role |
| :--- | :--- | :--- |
| **`scipy`** | `1.11+` (`scipy.fftpack`) | **Frequency-Domain Transformation**: Computes 2D Discrete Cosine Transforms (`dct` / `idct`) to modulate mid-frequency spatial frequencies with invisible watermark bits across the luminance ($Y$) channel. |
| **`numpy`** | `1.24+` | **High-Performance Math**: Vectorized multidimensional matrix manipulation, coordinate transformations, and coefficient modulation matrices. |
| **`opencv-python-headless`** | `4.8+` | **Computer Vision & Colorimetry**: Lossless RGB to YCrCb color space conversions, luminance separation, and forensic image preprocessing. |
| **`reedsolo`** | `1.7+` | **Forward Error Correction (FEC)**: Implements Reed-Solomon **RS(255, 127)** error-correcting codes, enabling 100% watermark payload recovery even under heavy print/scan artifacts, lossy compression, or image cropping. |
| **`pymupdf` (`fitz`)** | `1.23+` | **Document Engine**: High-fidelity PDF parsing, per-page vector-to-raster rendering, watermark injection, and multi-page PDF document reconstruction. |
| **`Pillow` (`PIL`)** | `10.0+` | **Image Manipulation**: Raw image buffer decoding, DPI scaling, and cross-format rendering for forensic upload processing. |

#### C. Web API & Network Server
| Package | Version / Source | Function & Technical Role |
| :--- | :--- | :--- |
| **`fastapi`** | `0.115+` | **Asynchronous REST Framework**: Ultra-low latency API framework handling document distribution, decryption handshakes, forensic scanning, and real-time ledger auditing. |
| **`uvicorn`** | `0.30+` (`[standard]`) | **ASGI Production Server**: High-throughput asynchronous server supporting parallel cryptographic operations. |
| **`python-multipart`** | `0.0.9+` | **Multipart Streaming**: High-speed, streaming file upload handler for large PDF and forensic image files. |

---

### 3. ⚛️ Frontend Client Dependencies (`frontend/package.json`)

#### A. Production Dependencies
| Package | Version | Function & Technical Role |
| :--- | :--- | :--- |
| **`react`** | `^19.2.8` | **UI Architecture**: Core component library providing declarative, concurrent state management for real-time cryptographic workflows. |
| **`react-dom`** | `^19.2.8` | **DOM Renderer**: High-performance browser DOM rendering engine for React 19. |
| **`lucide-react`** | `^1.48.0` | **Security Iconography**: Vector iconography for cyber defense status badges, ledger block states, and cryptographic locks. |

#### B. Development & Tooling Dependencies
| Package | Version | Function & Technical Role |
| :--- | :--- | :--- |
| **`vite`** | `^8.3.0` | **Build System & Dev Server**: Next-generation bundler with instant Hot Module Replacement (HMR) and reverse proxy routing (`/api` -> FastAPI). |
| **`typescript`** | `~6.0.2` | **Type Safety**: End-to-end static typing across all cryptographic models, ledger blocks, API schemas, and UI state. |
| **`@vitejs/plugin-react`** | `^6.1.1` | **Compiler Plugin**: Official Vite plugin for React JSX/TSX Fast Refresh compilation. |
| **`oxlint`** | `^1.81.0` | **Static Analysis**: Rust-based high-speed linter enforcing code quality and strict performance standards. |
| **`@types/react`** | `^19.2.18` | **Type Definitions**: TypeScript definitions for React components and lifecycle hooks. |
| **`@types/react-dom`** | `^19.2.7` | **Type Definitions**: TypeScript definitions for React DOM. |
| **`@types/node`** | `^24.13.3` | **Environment Types**: TypeScript definitions for Node.js runtime and pathing. |

---

### 4. 📜 Cryptographic Standards Compliance
- **NIST FIPS 203**: Module-Lattice-Based Key-Encapsulation Mechanism (ML-KEM / Kyber-768)
- **NIST FIPS 204**: Module-Lattice-Based Digital Signature Algorithm (ML-DSA / Dilithium-3 / ML-DSA-65)
- **NIST SP 800-38D**: Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (AES-256-GCM)
- **NIST FIPS 202**: SHA-3 Standard: Permutation-Based Hash and Extendable-Output Functions (SHA3-256)
- **CCSDS 131.0-B-3**: Reed-Solomon Forward Error Correction (RS(255, 127))

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

#### Terminal 2 — React Web Application UI (Port 5173)
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

#### 1. "Failed to fetch" on Login or Account Creation
- **Cause**: The React frontend is open, but the **FastAPI backend is not running** on port 8000.
- **Fix**: Make sure you ran `start_demo.bat` (which starts BOTH servers), or run `python -m uvicorn app.main:app --port 8000` in the `backend` folder. Check `http://127.0.0.1:8000/api/system/health` to confirm the backend is live.

#### 2. "localhost refused to connect"
- **Cause**: Trying to open `localhost:5173` on a friend's machine while the code is running on your machine.
- **Fix**: Use your local Wi-Fi IP address instead of `localhost` (e.g. `http://192.168.x.x:5173`).

#### 3. "403 Forbidden / ACCESS DENIED" during Decryption
- **Cause**: This is **intended post-quantum access control**! When a file is encrypted in Stage 1, it is bound ONLY to the selected recipients' ML-KEM-768 public keys. If an unauthorized user attempts to decrypt it, the platform strictly rejects them.
- **Fix**: Switch your active user to the recipient who was granted access during distribution (e.g., Bob or Alice), or check your own account in Stage 1 when distributing.

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
│   │       ├── crypto_engine.py      # PQC (ML-KEM, ML-DSA), AES-256-GCM, SHA3
│   │       ├── watermark_engine.py   # 2D DCT spread-spectrum & Reed-Solomon ECC
│   │       └── ledger_engine.py      # Hash-chained blocks & Merkle trees
│   ├── tests/                    # Crypto and pipeline unit tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/client.ts         # API client & error handling
│   │   ├── components/           # UI components, header, auth modal
│   │   ├── views/                # 5 core security consoles
│   │   ├── types/                # TypeScript domain types
│   │   └── index.css             # Design system styling
│   ├── package.json
│   └── vite.config.ts
├── setup/                        # Automated dependency installation scripts
├── docker-compose.yml            # Multi-container orchestration
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
