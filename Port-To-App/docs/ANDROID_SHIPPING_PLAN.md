# 🛡️ CIPHERTRACE Android Client — Feasibility Analysis & Implementation Plan

> **Verdict: ✅ FEASIBLE — with well-defined constraints**

---

## 1. Executive Assessment

| Dimension | Status | Notes |
|:---|:---:|:---|
| **Backend API Readiness** | 🟡 80% | Clean FastAPI REST endpoints exist; need minor hardening for mobile clients |
| **Crypto Protocol Portability** | 🟢 90% | All crypto is server-side (keystore + PQC ops). Android doesn't need to reimplement ML-KEM/ML-DSA |
| **Architecture Compatibility** | 🟢 95% | Backend already enforces API → DB → Blockchain separation |
| **Development Effort** | 🟡 Medium | ~4-6 weeks for full production; 1-2 weeks for core SIH-demo-ready client |
| **Security Model Fit** | 🟢 Excellent | Keystore boundary model maps naturally to Android Keystore + Biometrics |

> **The single most important finding:** The existing architecture is already 90% API-ready. The backend performs **all** cryptographic operations server-side (PQC key generation, encapsulation, decapsulation, signing, watermarking, blockchain commit). The Android client does NOT need to reimplement ML-KEM-768 or ML-DSA-65. It only needs to authenticate, pass keystore passwords securely, and display results.

---

## 2. What Already Works For You

### Your backend is already structured as an API server
Your backend registers clean REST routers:
- `/api/auth/*`
- `/api/documents/*`
- `/api/decryption/*`
- `/api/forensics/*`
- `/api/ledger/*`
- `/api/system/*`

### Your crypto is already server-side-contained
- `KeystoreManager.decapsulate()` — ML-KEM-768 decapsulation inside keystore boundary
- `KeystoreManager.sign()` — ML-DSA-65 signing inside keystore boundary
- Private keys **never** leave the keystore file
- The server handles: keystore unlock → decapsulation → AES-GCM decryption → watermark embedding → ML-DSA-65 signing → blockchain commit
- The client only sends: `document_id`, `recipient_id`, `keystore_password`

**This means**: The Android app doesn't need native PQC crypto libraries at all for the SIH demo.

---

## 3. Architecture: What Goes Where

```
┌─────────────────────────────────────────────────────────────┐
│                     ANDROID APP (Kotlin)                     │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Login     │  │ Dashboard  │  │ Document   │            │
│  │   Screen    │  │   Screen   │  │  Detail    │            │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘            │
│        │               │               │                     │
│  ┌─────┴───────────────┴───────────────┴──────┐             │
│  │          Retrofit API Client               │             │
│  │    (mirrors frontend/src/api/client.ts)    │             │
│  └─────────────────┬──────────────────────────┘             │
│                    │                                         │
│  ┌─────────────────┴──────────────────────────┐             │
│  │         Security Layer                      │             │
│  │  ┌──────────┐ ┌───────────┐ ┌────────────┐ │             │
│  │  │ Android  │ │ Biometric │ │ Encrypted  │ │             │
│  │  │ Keystore │ │  Prompt   │ │ SharedPref │ │             │
│  │  │ (JWT)    │ │ (Decrypt) │ │ (metadata) │ │             │
│  │  └──────────┘ └───────────┘ └────────────┘ │             │
│  └─────────────────────────────────────────────┘             │
│                                                              │
│  FLAG_SECURE on sensitive screens                            │
│  android:allowBackup="false"                                 │
│  CertificatePinner for TLS                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS / HTTP (Dev: 10.0.2.2:8000)
                        ▼
┌───────────────────────────────────────────────────────────────┐
│              EXISTING CIPHERTRACE BACKEND (unchanged)         │
│                                                               │
│  FastAPI ← /api/auth/* /api/documents/* /api/decryption/*    │
│      ↓           ↓            ↓              ↓                │
│  SQLite    Keystore      CryptoEngine    WatermarkEngine     │
│      ↓           ↓            ↓              ↓                │
│  LedgerEngine → Hyperledger Fabric (3-Org Consortium)        │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Mobile Client Security Model

1. **JWT Token Protection**: Kept in `EncryptedSharedPreferences` backed by the Android MasterKey hardware-backed keystore.
2. **Biometric Decryption Gate**: Decryption requires `BiometricPrompt` authentication before triggering server-side PQC decapsulation.
3. **Hardware Display Protection**: `WindowManager.LayoutParams.FLAG_SECURE` enabled on sensitive screens to prevent unauthorized screen captures, screen sharing, or recording during playback.
4. **Zero Local Storage of Plaintext**: Plaintext documents are never saved to unencrypted device storage.
5. **No Cloud Backup**: `android:allowBackup="false"` prevents leaking session tokens to Google Drive backup.

---

## 5. Technology Stack

- **Language**: Kotlin 2.0+
- **UI Framework**: Jetpack Compose + Material 3 (Dark Cyberpunk / Defense Tactical theme)
- **HTTP Client**: Retrofit 2 + OkHttp 4
- **Security**: AndroidX Biometric 1.2+, Jetpack Security Crypto 1.1+ (EncryptedSharedPreferences)
- **Navigation**: Jetpack Compose Navigation
- **Architecture**: MVI / MVVM with Kotlin Coroutines & Flow
