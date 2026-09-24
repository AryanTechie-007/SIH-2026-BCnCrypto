# CIPHERTRACE — 5-Minute SIH Demo & Judge Pitch Script
**Presented by Team Ve Ni Di | Smart India Hackathon 2026**

## Elevator Pitch (30 Seconds)
> *"Judges, current document security solutions like Microsoft Purview or Digify rely on cloud KMS or simple metadata watermarks that can be easily stripped. When an air-gapped defense document leaks, tracing it back to an exact individual decryption session is nearly impossible.*
> 
> *We built **CIPHERTRACE**: a 100% offline, post-quantum cryptographic document attribution platform. Every decryption event generates an invisible frequency-domain watermark cryptographically bound to that exact session, signs it using the recipient's NIST standardized **ML-DSA-65** private key, and commits an immutable proof to an air-gapped distributed ledger. When a document leaks, our forensic engine reconstructs the watermark via Reed-Solomon ECC and verifies the post-quantum signature with mathematical certainty."*

---

## The 5-Minute Live Demo Flow

### 🎬 Scene 1: Sender Studio (Envelope Encryption & Distribution) — 60s
1. **Navigate to "Sender Studio" tab**.
2. **Show document payload**: Point to `OPERATION TRIDENT SHIELD` (`CLASSIFIED_NAVAL_OPERATIONS.pdf`).
3. **Point out the SHA3-256 Digest**: *"This is our tamper anchor. We never encrypt the entire file separately per recipient."*
4. **Select Recipients**: Check *Captain A. Verma (Flagship)* and *Commander S. Rao (Destroyer)*.
5. **Click "SECURE ENVELOPE DISTRIBUTE"**:
   - Explain: *"We use hybrid envelope encryption: one AES-256-GCM document ciphertext, but the 256-bit Document Encryption Key is encapsulated using NIST FIPS 203 **ML-KEM-768** lattice cryptography per recipient."*
   - Show the generated key envelopes.

---

### 🎬 Scene 2: Recipient Terminal (Atomic Decryption & PQC Signing) — 60s
1. **Navigate to "Recipient Terminal" tab**.
2. **Select Officer**: Choose *Captain A. Verma (`NAVY-0231`)*.
3. **Show Credentials**: Point to authorized device ID and ML-DSA-65 signing key ID in the secure enclave.
4. **Click "DECRYPT & AUTHORIZE DOCUMENT"**:
   - Watch the animated **6-step atomic security checklist**:
     1. ML-KEM-768 Decapsulation
     2. AES-256-GCM Decryption & Tag Verification
     3. Session Nonce Formulation
     4. Cryptographic Watermark HMAC Derivation
     5. ML-DSA-65 Recipient Signature Generation (FIPS 204)
     6. Air-Gapped Permissioned Ledger Commit
5. **Show Result**:
   - Document is decrypted.
   - Point to the **Watermark Identifier**: `WM-7A91...`.
   - **Crucial Point**: *"If Captain Verma decrypts the same file again 10 minutes later, an entirely new nonce, watermark ID, and ML-DSA signature are generated. Every viewing session has its own forensic timeline."*

---

### 🎬 Scene 3: Forensic Lab (Blind Leaked Document Attribution) — 90s (The WOW Scene)
1. **Navigate to "Forensic Lab" tab**.
2. **Show the scenario**: *"An intelligence team has intercepted a leaked PDF. They do NOT know who leaked it, when it was viewed, or which device rendered it."*
3. **Click "START FORENSIC ATTRIBUTION"**:
   - Watch the 6-stage pipeline animate:
     - Rasterization $\rightarrow$ DCT frequency sampling $\rightarrow$ Reed-Solomon ECC decoding $\rightarrow$ Ledger search $\rightarrow$ ML-DSA verification $\rightarrow$ Merkle proof verification.
4. **Show Hero Result**:
   - **ATTRIBUTION VERIFIED**: Captain A. Verma (`NAVY-0231`).
   - Vessel: *INS Vikramaditya*.
   - Exact Timestamp and Device ID.
   - 6-Link Cryptographic Verification: **All Passed**.
5. **Click "Inspect & Export Cryptographic Evidence Package"**:
   - Show `CIPHERTRACE_EVIDENCE.json`.
   - Point out: *"An independent court or military audit authority can verify this evidence bundle offline using public keys and ledger roots."*

---

### 🎬 Scene 4: Adversarial Watermark Attack Simulator — 60s
1. **Navigate to "Attack Simulator" tab**.
2. **Click "Severe JPEG Recompression (Quality 35%)"**:
   - Click **"Re-Run Degradation Test"**.
   - Show: Raw Bit Error Rate is 6.4%, but Reed-Solomon ECC corrected all corrupted symbols. Payload recovery: **100%**.
3. **Click "Complete PDF Metadata Stripping"**:
   - Show: Watermark survived 100%.
   - Explain: *"Attackers often wipe Exif/XMP metadata thinking they removed the watermark. Our watermark is embedded in the 2D DCT frequency lattice of the visual document, rendering metadata stripping useless."*

---

### 🎬 Scene 5: Ledger & Tamper Demo — 30s
1. **Navigate to "Ledger & Tamper Demo" tab**.
2. **Show the Blocks**: Point out the hash-chained blocks and Merkle roots.
3. **Click "Simulate Rogue Admin Attack (Tamper Block #1)"**:
   - Immediately, the system alerts:
     - ❌ **HASH CHAIN BROKEN**
     - ❌ **MERKLE INCLUSION PROOF INVALID**
     - ❌ **CONSENSUS NODES REJECT STATE**
4. **Explain**: *"This answers the question: 'Why blockchain?' A malicious privileged administrator cannot secretly edit historical audit logs to frame someone else without consensus nodes detecting the mismatch immediately."*
5. **Click "Restore Ledger Integrity"**.

---

### 🎬 Scene 6: Continuity Graph — 20s
1. **Navigate to "Continuity Graph" tab**.
2. Show the visual end-to-end lineage from Document $\rightarrow$ Envelopes $\rightarrow$ Sessions $\rightarrow$ Watermarks $\rightarrow$ Ledger Blocks.
3. Click any node to demonstrate offline inspectability.

---

## Top 5 Judge Questions & Golden Answers

### Q1: *"Why do you need blockchain/DLT in an air-gapped system?"*
> **Answer**: *"A centralized SQL database has a 'root admin' who can run `UPDATE logs SET recipient = 'Bob' WHERE event_id = '123'`. In defense and military scenarios, insider threats are critical. Our permissioned DLT ensures that multiple authorities (Security, Audit, and Forensic command) maintain cryptographic replicas with SHA3-256 hash chaining and Merkle trees. No single admin can rewrite history."*

### Q2: *"Why Post-Quantum Cryptography (ML-KEM and ML-DSA) right now?"*
> **Answer**: *"NIST finalized FIPS 203 (ML-KEM) and FIPS 204 (ML-DSA) in August 2024. Defense documents distributed today have a 20-to-30-year operational classification. Under 'Store Now, Decrypt Later' threats, adversaries store encrypted intercepts until quantum computers can break RSA/ECC. Using ML-KEM-768 and ML-DSA-65 ensures post-quantum secrecy and non-repudiation."*

### Q3: *"How does your watermark survive if someone crops or screenshots the document?"*
> **Answer**: *"We use a multi-region DCT-domain spread-spectrum embedding combined with Reed-Solomon (255, 127) error-correcting codes. Even if an attacker crops 12% of the margins or compresses the image, the redundant spatial interleaving and parity bytes math-reconstruct the original 128-bit payload."*

### Q4: *"Does the signature prove that the human physically decrypted it?"*
> **Answer**: *"No signature alone can prove physical human consciousness. It proves **cryptographic attribution**: that the authorized hardware device and private signing key held by that enrolled officer authorized the exact decryption event. We combine this with device attestation and session nonces."*

### Q5: *"Does the watermark reveal the officer's name to anyone who inspects the file?"*
> **Answer**: *"No. The watermark payload is a pseudonymous cryptographic hash derived via HMAC-SHA3-256. It contains no human-readable names. Only the authorized forensic authority with access to the offline ledger can resolve the watermark ID back to the decryption event and recipient identity."*
