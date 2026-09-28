# 🏛️ CIPHERTRACE Mobile Client Architecture

## Overview

The CIPHERTRACE Android Application is a high-security, native Android client built in **Kotlin** and **Jetpack Compose**. It acts as a field terminal for tactical recipients and investigators to access post-quantum encrypted, watermarked documents and verify blockchain provenance on mobile devices.

---

## 1. Zero-PQC-Client Principle

In CIPHERTRACE, post-quantum cryptography (NIST FIPS 203 ML-KEM-768 and NIST FIPS 204 ML-DSA-65) is completely encapsulated within the backend **Keystore Boundary**:

```
[Android App] ──(Biometric Auth + TLS)──> [FastAPI Server] ──> [Keystore Boundary]
                                                                     │
                                                              ML-KEM-768 Decapsulation
                                                              ML-DSA-65 Signing
                                                              AES-256-GCM Decryption
                                                              2D DCT Watermarking
                                                                     │
[Android App] <──(Watermarked PDF Render) <──────────────────────────┘
```

### Why this design is superior:
1. **No C++ Native Library Hassles**: Running `liboqs` (C library) across ARMv7, ARM64-v8a, x86, and x86_64 on Android requires large NDK binaries and complex JNI bridges.
2. **Private Key Airgap**: Recipient private keys are stored within the secure, encrypted server keystores (`Argon2id` + `AES-256-GCM`). They are never transferred over wireless networks to mobile devices.
3. **Hardware Battery & Latency**: PQC decapsulation and 2D DCT steganography are compute-intensive. Performing them server-side ensures immediate rendering on any mobile device.

---

## 2. Security Architecture

### 2.1 Hardware-Backed Key Storage
Authentication tokens (JWTs) and user session parameters are stored in `EncryptedSharedPreferences`, using AES-256-GCM encryption with an AES-256 key generated in the **Android Keystore System** (`AndroidKeyStore`).

### 2.2 Biometric Decryption Gate
Access to sensitive cryptographic decryption operations requires explicit biometric authentication (`BiometricPrompt` with `BIOMETRIC_STRONG` or device credential fallback).
- User triggers "Decrypt & Verify"
- Biometric sensor prompts the user
- Upon biometric success, the authorization token or keystore unlock secret is provided to the API call.

### 2.3 Operating System Shielding (`FLAG_SECURE`)
All screens displaying decrypted documents, recipient cryptographic credentials, or sensitive forensic watermarks enforce `WindowManager.LayoutParams.FLAG_SECURE`.
- Prevents screenshots and screen recordings.
- Blank screens are rendered in Android Recents / App Switcher.
- Blocks unauthorized external display mirroring.

### 2.4 Network Security & Cleartext Traffic
- Production enforces HTTPS (TLS 1.3) with Certificate Pinning.
- Development / Demo mode allows cleartext traffic strictly to the Android Emulator host bridge (`10.0.2.2:8000`) or dedicated LAN addresses via `res/xml/network_security_config.xml`.

---

## 3. Directory Layout in `Port-To-App`

- `Port-To-App/docs/`: Architecture specifications, shipping plan, and backend sync guides.
- `Port-To-App/backend_copies/`: Copies of backend files enhanced for mobile, named with `app_backend_*` prefix to preserve the website's existing files without conflict.
- `Port-To-App/android/`: Complete, production-grade Android native project (Kotlin, Jetpack Compose, Retrofit, OkHttp, AndroidX Biometrics).
