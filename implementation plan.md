# CIPHERTRACE — 4-Day Implementation Plan

## Deadline: September 28, 2026

---

## Scope Philosophy

With 4 days, the goal is a **compelling end-to-end demo**, not a production system. Every decision below optimizes for:

1. **Working demo flow** — Encrypt → Decrypt → Watermark → Sign → Ledger → Leak → Verify
2. **Technical credibility** — Real PQC crypto, real watermarking, real hash chains
3. **Visual impact** — Judges must immediately understand the system

---

## What to BUILD (MVP)

| # | Component | Priority | Justification |
|---|-----------|----------|---------------|
| 1 | Identity Authority (simplified) | 🔴 Critical | Foundation for everything |
| 2 | PQC Key Manager (ML-KEM + ML-DSA) | 🔴 Critical | Core differentiator |
| 3 | Document Encryption (envelope encryption) | 🔴 Critical | Core flow |
| 4 | Recipient Decryption | 🔴 Critical | Core flow |
| 5 | Watermark Generation (HMAC-derived, session-bound) | 🔴 Critical | Core innovation |
| 6 | Invisible Watermark Embedding (DCT-domain on rendered pages) | 🔴 Critical | Hardest component |
| 7 | Watermark Extraction | 🔴 Critical | Forensic flow |
| 8 | ML-DSA Event Signing | 🔴 Critical | Non-repudiation |
| 9 | Single-node DLT with hash chaining + Merkle trees | 🔴 Critical | Immutability proof |
| 10 | Forensic Analysis Pipeline | 🔴 Critical | Demo centerpiece |
| 11 | Evidence Bundle Generator | 🟡 High | Strong demo finish |
| 12 | React Frontend (3 dashboards) | 🟡 High | Visual impact |
| 13 | Attack Simulator (3-4 attacks) | 🟡 High | Judge engagement |
| 14 | Tamper Detection Demo | 🟡 High | Shows why DLT matters |

## What to DEFER

| Component | Why |
|-----------|-----|
| Multi-node DLT consensus | Single node with hash chain + Merkle is sufficient proof |
| Air-gap sync / USB bundles | Describe in architecture, don't build |
| Anti-collusion / traitor tracing | Mention as research extension |
| SLH-DSA backup signatures | Mention crypto-agility, don't implement |
| Key rotation / revocation | Design the schema, implement basic revocation only |
| Hardware-backed key storage | Out of scope for prototype |
| Print → scan watermark recovery | Extremely hard; focus on digital attacks |
| Multi-channel watermarking | DCT single-channel is sufficient for demo |
| Privacy-preserving ledger (hashed IDs) | Easy to add later, skip for now |

---

## Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | React + TypeScript + Vite | Fast setup, good visuals |
| **Backend** | Python + FastAPI | Fastest for crypto integration |
| **Database** | SQLite | Zero setup, offline-native |
| **PQC Crypto** | `liboqs-python` (oqs) | NIST ML-KEM-768 + ML-DSA-65 |
| **Symmetric Crypto** | `cryptography` (Python) | AES-256-GCM + SHA3-256 |
| **PDF Processing** | `PyMuPDF` (fitz) + `Pillow` + `numpy` + `scipy` | Render → embed → reconstruct |
| **Watermark** | Custom DCT spread-spectrum | Robust, well-understood |
| **ECC** | `reedsolo` | Reed-Solomon error correction |
| **Containerization** | Docker Compose | Single `docker compose up` |

> [!IMPORTANT]
> `liboqs-python` provides real NIST-standardized ML-KEM and ML-DSA. This is NOT simulated crypto — it's the actual FIPS 203/204 algorithms. This alone sets the project apart.

---

## Day-by-Day Schedule

### Day 1 (Sep 25) — Foundation + Crypto Core

**Morning (4h)**

- [ ] Initialize project structure (monorepo: `backend/`, `frontend/`, `docker/`)
- [ ] Set up FastAPI skeleton with CORS, error handling, health check
- [ ] Set up SQLite database with SQLAlchemy models:

```
Users, Documents, Distributions, DecryptionEvents, LedgerBlocks, WatermarkRecords
```

- [ ] Build `CryptoService` abstraction layer:
  - `generate_kem_keypair()` → ML-KEM-768
  - `encapsulate(public_key, plaintext)` → ciphertext + shared_secret
  - `decapsulate(private_key, ciphertext)` → shared_secret
  - `generate_signing_keypair()` → ML-DSA-65
  - `sign(private_key, message)` → signature
  - `verify(public_key, message, signature)` → bool
  - `aes_encrypt(key, plaintext)` → AES-256-GCM ciphertext
  - `aes_decrypt(key, ciphertext)` → plaintext
  - `sha3_hash(data)` → SHA3-256 digest

**Afternoon (4h)**

- [ ] Build Identity Authority API:
  - `POST /api/identity/register` — register user, generate ML-KEM + ML-DSA keypairs
  - `GET /api/identity/users` — list users
  - `GET /api/identity/users/{id}` — get user + public keys
  - `POST /api/identity/keys/revoke` — revoke a key
- [ ] Build Document Encryption API:
  - `POST /api/documents/upload` — upload + SHA3 hash
  - `POST /api/documents/{id}/encrypt` — envelope encryption for selected recipients
  - Generate random DEK → AES-256-GCM encrypt doc → ML-KEM encapsulate DEK per recipient
- [ ] Build Decryption API:
  - `POST /api/documents/{id}/decrypt` — ML-KEM decapsulate → AES-GCM decrypt → return plaintext
  - Generate `DecryptionEvent` with event_id, session_nonce, timestamp, device_id
  - Canonicalize event → SHA3-256 hash → ML-DSA sign with recipient private key
- [ ] Write crypto round-trip tests (ML-KEM, ML-DSA, AES-GCM)

**Deliverable**: Backend that can register users, encrypt a document for 3 recipients, decrypt per-recipient, and sign decryption events. All PQC crypto working.

---

### Day 2 (Sep 26) — Watermarking + Ledger

**Morning (4h)**

- [ ] Build Watermark Generation:
  - `watermark_payload = HMAC-SHA3-256(secret, doc_hash || recipient_key_hash || session_nonce || event_id)`
  - Truncate to 128 bits (pragmatic for DCT embedding)
  - Reed-Solomon encode → ~512 coded bits
  - Bit interleaving for spread

- [ ] Build DCT Watermark Embedding Engine:
  - Render PDF pages to images using PyMuPDF
  - For each page image:
    - Split into 8×8 blocks
    - Apply DCT transform
    - Embed bits into selected mid-frequency DCT coefficients
    - Inverse DCT
    - Reconstruct image
  - Reassemble watermarked pages into PDF
  - API: `POST /api/watermarks/embed`

- [ ] Build DCT Watermark Extraction Engine:
  - Render suspect PDF pages to images
  - Extract bits from same DCT coefficient positions
  - De-interleave
  - Reed-Solomon decode with error correction
  - Recover watermark payload
  - API: `POST /api/watermarks/extract`

**Afternoon (4h)**

- [ ] Build Ledger Service:
  - `LedgerBlock` with:
    - `block_id`, `event_id`, `document_hash`, `watermark_hash`
    - `recipient_key_id_hash`, `event_hash`, `recipient_signature`
    - `timestamp`, `previous_block_hash`, `merkle_root`
  - Hash chaining: each block references `SHA3-256(previous_block)`
  - Merkle tree: batch events into trees, store roots
  - API: `POST /api/ledger/commit` — commit signed event
  - API: `GET /api/ledger/blocks` — list blocks
  - API: `GET /api/ledger/verify/{event_id}` — verify chain + Merkle proof
  - API: `POST /api/ledger/verify-integrity` — full chain verification

- [ ] Build Forensic Analysis Pipeline:
  - `POST /api/forensics/analyze` — upload leaked PDF
    1. Extract watermark
    2. Decode ECC
    3. Lookup watermark → event in database
    4. Retrieve ledger record
    5. Verify ML-DSA signature
    6. Verify document hash
    7. Verify Merkle proof
    8. Verify chain integrity
    9. Resolve recipient identity
    10. Return forensic report

- [ ] Build Evidence Bundle Generator:
  - `POST /api/evidence/generate/{event_id}`
  - Generates downloadable JSON bundle with all proofs

**Deliverable**: Complete backend pipeline. Upload doc → encrypt → decrypt → watermark → sign → ledger → leak → extract → verify → evidence.

---

### Day 3 (Sep 27) — Frontend + Attack Simulator

**Morning (4h)**

- [ ] Initialize React + Vite + TypeScript project
- [ ] Design system: dark theme, glassmorphism, accent colors, Inter font
- [ ] Build **Sender Dashboard**:
  - Upload document (drag & drop)
  - Show SHA3-256 hash
  - Select recipients (checkboxes)
  - "Secure Distribute" button
  - Show per-recipient key envelopes
  - Distribution success animation

- [ ] Build **Recipient Dashboard**:
  - Login/select recipient
  - List authorized documents
  - "Decrypt" button with security checklist animation:
    - ✓ ML-KEM decapsulation
    - ✓ Document authenticated
    - ✓ Session generated
    - ✓ Watermark embedded
    - ✓ ML-DSA signed
    - ✓ Ledger committed
  - View/download decrypted document

**Afternoon (4h)**

- [ ] Build **Investigator Dashboard**:
  - Upload leaked document (drag & drop)
  - "Analyze" button
  - Animated forensic pipeline:
    - Extracting watermark... ✓
    - ECC decoding... ✓
    - Searching ledger... ✓
    - Verifying signature... ✓
    - Verifying Merkle proof... ✓
    - Verifying document hash... ✓
  - Results panel:
    - Recipient identity
    - Decryption timestamp
    - Device ID
    - All verification statuses (VALID/INVALID)
  - "Download Evidence Bundle" button

- [ ] Build **Attack Simulator** (3-4 attacks):
  - Backend: `POST /api/attacks/compress`, `/crop`, `/resize`, `/metadata-strip`
  - Frontend: buttons for each attack
  - Show before/after comparison
  - Run forensic extraction on attacked document
  - Display watermark recovery status + confidence

- [ ] Build **Ledger Tamper Demo**:
  - Button: "Tamper with ledger record"
  - Backend modifies a record, then runs verification
  - Show: ❌ HASH MISMATCH, ❌ CHAIN BROKEN
  - Button: "Restore integrity" → reset

**Deliverable**: Full UI with all 3 dashboards, attack simulator, and ledger tamper demo.

---

### Day 4 (Sep 28) — Integration, Polish, Demo

**Morning (4h)**

- [ ] End-to-end integration testing:
  - Register 3 recipients
  - Upload + encrypt document
  - Decrypt as each recipient
  - Verify all 3 get unique watermarks
  - "Leak" one copy
  - Run forensic analysis → correct attribution
  - Run attack simulator → watermark survives
  - Tamper with ledger → detected

- [ ] Fix bugs from integration
- [ ] Add performance metrics display:
  - Key generation times
  - Encryption/decryption latency
  - Watermark embed/extract time
  - Ledger commit time
- [ ] Docker Compose setup for single-command deployment

**Afternoon (4h)**

- [ ] Polish UI:
  - Animations, transitions, loading states
  - Evidence Continuity Graph visualization (D3.js or simple SVG)
  - Security dashboard with live stats
- [ ] Create demo dataset (pre-loaded users, sample PDF)
- [ ] Write README with offline deployment instructions
- [ ] Record demo walkthrough if needed
- [ ] Final testing pass

**Deliverable**: Deployable system with `docker compose up`. Complete demo-ready.

---

## Innovations Kept (Ranked by Impact-to-Effort)

| # | Innovation | Effort | Demo Impact | Keep? |
|---|-----------|--------|-------------|-------|
| 1 | Session-bound cryptographic watermark (not just recipient ID) | Low | 🔥🔥🔥 | ✅ **YES** |
| 2 | ML-DSA signed decryption events | Low | 🔥🔥🔥 | ✅ **YES** |
| 3 | Hash-chained ledger with Merkle proofs | Medium | 🔥🔥🔥 | ✅ **YES** |
| 4 | Cryptographic Evidence Bundle | Low | 🔥🔥🔥 | ✅ **YES** |
| 5 | Attack simulator (digital attacks) | Medium | 🔥🔥🔥 | ✅ **YES** |
| 6 | Ledger tamper detection demo | Low | 🔥🔥🔥 | ✅ **YES** |
| 7 | Reed-Solomon ECC watermark | Medium | 🔥🔥 | ✅ **YES** |
| 8 | Anonymous watermark IDs (only forensic authority resolves) | Low | 🔥🔥 | ✅ **YES** |
| 9 | Envelope encryption (one ciphertext, N key envelopes) | Low | 🔥🔥 | ✅ **YES** |
| 10 | Evidence Continuity Graph visualization | Medium | 🔥🔥 | ✅ **YES** |
| 11 | Confidence scoring (not binary) | Low | 🔥 | ✅ **YES** |
| 12 | Key revocation (basic) | Low | 🔥 | ✅ **YES** |
| 13 | Multi-node DLT consensus | High | 🔥 | ❌ Defer |
| 14 | Anti-collusion traitor tracing | Very High | 🔥🔥 | ❌ Defer (mention as future) |
| 15 | Air-gap USB sync | High | 🔥 | ❌ Defer |
| 16 | Print → scan watermark recovery | Very High | 🔥🔥 | ❌ Defer |
| 17 | Multi-channel watermarking | High | 🔥 | ❌ Defer |
| 18 | Privacy-preserving ledger (hashed IDs) | Low | 🔥 | ⚡ If time permits |

---

## Key Architecture Decisions

### Watermark Strategy: DCT Spread-Spectrum

```
128-bit HMAC payload
       ↓
Reed-Solomon (128 → ~512 coded bits)
       ↓
Bit interleaving
       ↓
DCT mid-frequency coefficient modification
       ↓
Spread across multiple 8×8 blocks per page
       ↓
Multiple pages for redundancy
```

**Why DCT?**
- Well-understood, extensively studied
- Survives JPEG compression (our main threat)
- Implementable in 4 days with numpy/scipy
- Good trade-off between robustness and imperceptibility

**Why 128 bits?**
- Enough for a truncated HMAC identifier
- Manageable embedding capacity
- Good ECC overhead ratio with Reed-Solomon

### Ledger: Custom Append-Only Chain (Not Hyperledger)

Hyperledger Fabric is too heavy for 4 days. Instead:

```
Custom SQLite-backed append-only ledger
  + SHA3-256 hash chaining
  + Merkle trees per batch
  + Tamper detection on read
  + Single authority node (prototype)
```

**This is honest**: we call it a "permissioned append-only ledger with hash chaining and Merkle proofs" — not "blockchain." We explain that multi-node consensus is the production extension.

### Private Key Storage: Server-Side (Prototype Only)

For the prototype, recipient private keys are stored encrypted in the backend database. In production, these would be in hardware security modules or secure client-side storage.

> [!WARNING]
> Explicitly acknowledge this in the demo: "In production, private keys would be stored in HSMs or secure client enclaves. For this prototype, they're encrypted at rest in the backend."

---

## Project Structure

```
ciphertrace/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app
│   │   ├── config.py               # Settings
│   │   ├── database.py             # SQLite + SQLAlchemy
│   │   ├── models/                 # DB models
│   │   │   ├── user.py
│   │   │   ├── document.py
│   │   │   ├── distribution.py
│   │   │   ├── decryption_event.py
│   │   │   └── ledger.py
│   │   ├── services/
│   │   │   ├── crypto_service.py   # ML-KEM, ML-DSA, AES-GCM, SHA3
│   │   │   ├── identity_service.py
│   │   │   ├── encryption_service.py
│   │   │   ├── decryption_service.py
│   │   │   ├── watermark_service.py  # HMAC derivation
│   │   │   ├── embedding_service.py  # DCT embed/extract
│   │   │   ├── signing_service.py
│   │   │   ├── ledger_service.py
│   │   │   ├── forensic_service.py
│   │   │   └── evidence_service.py
│   │   ├── routers/
│   │   │   ├── identity.py
│   │   │   ├── documents.py
│   │   │   ├── decryption.py
│   │   │   ├── ledger.py
│   │   │   ├── forensics.py
│   │   │   ├── attacks.py
│   │   │   └── evidence.py
│   │   └── utils/
│   │       ├── merkle.py
│   │       └── canonical.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── pages/
│   │   │   ├── SenderDashboard.tsx
│   │   │   ├── RecipientDashboard.tsx
│   │   │   ├── InvestigatorDashboard.tsx
│   │   │   ├── AttackLab.tsx
│   │   │   └── SecurityDashboard.tsx
│   │   ├── components/
│   │   │   ├── ForensicPipeline.tsx
│   │   │   ├── EvidenceBundle.tsx
│   │   │   ├── LedgerViewer.tsx
│   │   │   ├── ContinuityGraph.tsx
│   │   │   └── SecurityChecklist.tsx
│   │   └── api/
│   │       └── client.ts
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `liboqs-python` installation issues on Windows | Medium | High | Test immediately Day 1 morning; fallback to pre-built Docker |
| DCT watermark not surviving compression | Medium | High | Tune embedding strength; accept lower PSNR for more robustness |
| Watermark extraction too noisy | Medium | High | Reed-Solomon ECC is the safety net; increase redundancy |
| 4 days too tight | High | High | Cut attack simulator to 2 attacks; simplify UI |
| PDF rendering inconsistencies | Medium | Medium | Standardize on PyMuPDF rendering at fixed DPI |

---

## Demo Script (5 minutes)

### Scene 1: "Secure Distribution" (60s)
> Upload `CLASSIFIED_NAVAL_OPERATIONS.pdf`. Show SHA3-256 hash. Select 3 recipients. Click **SECURE DISTRIBUTE**. Show envelope encryption animation.

### Scene 2: "Recipient Decryption" (60s)
> Login as Recipient A. Click **DECRYPT**. Watch security checklist animate through: ML-KEM ✓, Auth ✓, Session ✓, Watermark ✓, ML-DSA ✓, Ledger ✓. Open document.

### Scene 3: "Unique Fingerprints" (30s)
> Show Recipient A and Recipient B documents side-by-side. Visually identical. Show their watermark IDs are different. Show even the SAME recipient decrypting TWICE gets different watermarks.

### Scene 4: "The Leak" (90s)
> Upload "leaked" copy to Investigator Dashboard. Watch forensic pipeline animate. Watermark extracted → ECC decoded → Ledger matched → Signature verified → Merkle proof valid → **RECIPIENT A IDENTIFIED**. Show full evidence report.

### Scene 5: "Attack Resilience" (60s)
> Run JPEG compression attack on leaked copy. Run forensic analysis again → **STILL DETECTED**. Show ECC recovered 100% of payload.

### Scene 6: "Tamper Proof" (30s)
> Click "Tamper with ledger record." Show hash chain breaks. ❌ INTEGRITY VIOLATION DETECTED.

---

> [!TIP]
> **Key talking point for judges**: "This is not just watermarking or just encryption. It's the cryptographic binding between all five layers — document hash, session-bound watermark, post-quantum signature, hash-chained ledger, and Merkle proof — that makes forensic attribution independently verifiable."
