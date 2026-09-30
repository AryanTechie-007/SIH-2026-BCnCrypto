# CIPHERTRACE — 5-Minute SIH Demo & Judge Pitch Script
**Presented by Team Ve Ni Di | Smart India Hackathon 2026**

## Elevator Pitch (30 Seconds)
> *"Judges, current document security solutions like Microsoft Purview or Digify rely on cloud KMS or simple metadata watermarks that can be easily stripped. When an air-gapped defense document leaks, tracing it back to an exact individual decryption session is nearly impossible.*
>
> *We built **CIPHERTRACE**: a 100% offline, post-quantum cryptographic document attribution platform. Every decryption event generates an invisible frequency-domain watermark bound to that exact session, the recipient signs a record of it with their NIST standardized **ML-DSA-65** private key, and that record is committed to a permissioned Hyperledger Fabric ledger. When a document leaks, our forensic engine reconstructs the watermark via Reed-Solomon ECC and verifies the post-quantum signature with mathematical certainty."*

---

## Before the Demo

- Ledger running (`blockchain/scripts/setup.sh`), with two users signed up:
  `alice` (Org1) and `bob` (Org2), bundles in `blockchain/bundles/`.
- Both have signed in once, so their keystores and public keys already exist.
- Backend and frontend running; a sample PDF on the desktop.
- A terminal open in `blockchain/client` for Scene 5.

---

## The 5-Minute Live Demo Flow

### 🎬 Scene 1: Ledger Sign-In — 30s
1. **Sign in as `alice`**: enter the username and choose `alice.zip`, then **Continue**.
   - Explain: *"There is no password database. Identities are issued on the Fabric ledger. The app proves this bundle is genuine by asking the ledger peer, which only answers requests signed by a certificate its organization issued."*
2. **Enter Alice's keystore passphrase** and sign in.
   - Explain: *"Her post-quantum private keys live only in an encrypted keystore on this device. The passphrase is never stored anywhere."*

---

### 🎬 Scene 2: Encryption Lab (Envelope Encryption) — 45s
1. **Navigate to "Encryption Lab"** and upload the PDF.
2. **Point out the SHA3-256 Digest**: *"This is our tamper anchor."*
3. **Select `bob` as recipient** and distribute.
   - Explain: *"The document is encrypted once with AES-256-GCM, and its key is wrapped for each recipient with their NIST FIPS 203 **ML-KEM-768** public key, which comes from the ledger's key registry. Nobody can substitute their own key for Bob's."*
4. **Download the `.enc` package**: this is what travels to Bob.

---

### 🎬 Scene 3: Decryption Lab (Watermarking & Signed Ledger Record) — 60s
1. **Sign out and sign in as `bob`** (`bob.zip` + Bob's passphrase).
2. **Navigate to "Decryption Lab"** and upload the `.enc` package.
3. **Click decrypt** and walk through the 7 stages:
   Selection → Auth → Decryption → Fingerprint → Signature → Ledger Commit → Release.
4. **Show Result**:
   - Point to the **Watermark ID**.
   - **Crucial Point**: *"The watermarked copy is only released after the Fabric ledger accepts a record of this decryption, signed by Bob's ML-DSA-65 key and submitted under Bob's own ledger identity. If the ledger refuses, Bob gets nothing."*
   - *"If Bob decrypts the same file again, he gets a new watermark, a new signature and a new ledger record. Every session has its own forensic trail."*

---

### 🎬 Scene 4: Forensic Leak Lab (Blind Leaked Document Attribution) — 75s (The WOW Scene)
1. **Navigate to "Forensic Leak Lab"**.
2. **Show the scenario**: *"An audit team has intercepted a leaked copy. They do NOT know who leaked it."*
3. **Upload Bob's watermarked copy.** (Only use a screenshot here if you have rehearsed it: the current watermark engine reads the image as-is, without detecting and rescaling the page.)
4. **Show Hero Result**:
   - **Attribution**: `bob`, with the exact decryption time and session.
   - Verification gates: watermark and Reed-Solomon parity, decryption session found, ML-DSA-65 signature, document SHA3-256 digest, local hash-chain integrity.
5. **Export the evidence package** and point out: *"An independent authority can verify this offline using the public keys and the ledger record."*

---

### 🎬 Scene 5: Ledger Proof (Terminal) — 30s
1. **Show the record on Fabric** (use the watermark ID from Scene 3):
   ```bash
   FABRIC_SAMPLES=../bundles/bob node cli.js query <watermark_id> bob
   ```
   *"This is the record as both organizations' peers hold it: Bob's signature, the watermark, and the hashes of the original and of his copy."*
2. **Show that nobody can write a record in someone else's name** (from `blockchain/`):
   ```bash
   source scripts/env-recipient.sh user-117
   ./scripts/invoke.sh testdata/record-valid.json    # names user-042 -> identity mismatch
   ```
3. **Explain**: *"This answers 'Why blockchain?'. Records are write-once, every write needs both organizations to endorse it, and the chaincode rejects any record not submitted by the person it names."*

---

## Top 5 Judge Questions & Golden Answers

### Q1: *"Why do you need blockchain/DLT in an air-gapped system?"*
> **Answer**: *"A centralized SQL database has a 'root admin' who can run `UPDATE logs SET recipient = 'User B' WHERE event_id = '123'` or simply delete a row. On our Hyperledger Fabric network, two independent organizations each keep a full copy of the ledger and must both endorse every record. Records are write-once, and the chaincode only accepts a record from the person it names, so no single administrator can rewrite or quietly remove history. In the demo both organizations run on one laptop; in deployment they would be separate authorities."*

### Q2: *"Why Post-Quantum Cryptography (ML-KEM and ML-DSA) right now?"*
> **Answer**: *"NIST finalized FIPS 203 (ML-KEM) and FIPS 204 (ML-DSA) in August 2024. Defense documents distributed today have a 20-to-30-year operational classification. Under 'Store Now, Decrypt Later' threats, adversaries store encrypted intercepts until quantum computers can break RSA/ECC. Using ML-KEM-768 and ML-DSA-65 ensures post-quantum secrecy and non-repudiation."*

### Q3: *"How does your watermark survive if someone crops or screenshots the document?"*
> **Answer**: *"The watermark is embedded in the 2D DCT frequency domain of the rendered page, protected by a Reed-Solomon RS(31, 27) code over GF(2^5). The short 155-bit codeword is repeated hundreds of times across every page, so any intact region can carry it, and Reed-Solomon corrects residual symbol errors."*

### Q4: *"Does the signature prove that the human physically decrypted it?"*
> **Answer**: *"No signature alone can prove physical human presence. It proves **cryptographic attribution**: the recipient's ML-DSA-65 private key, which only unlocks with their passphrase on their device, signed a record of that exact decryption session, bound to a unique session nonce and to the watermark in their copy."*

### Q5: *"Does the watermark reveal the officer's name to anyone who inspects the file?"*
> **Answer**: *"No. The watermark carries a pseudonymous 80-bit identifier derived with HMAC-SHA3-256. It contains no human-readable names. Only someone with access to the ledger and the decryption records can resolve it back to the recipient."*
