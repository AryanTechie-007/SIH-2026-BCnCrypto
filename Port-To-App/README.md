# 📱 CIPHERTRACE Android Native Port (`Port-To-App`)

> **Air-Gapped Post-Quantum Cryptographic Field Terminal for Android**  
> *Developed for Smart India Hackathon (SIH 2026) | Problem Statement: Blockchain & Cryptography*

---

## 🎯 Purpose & Overview

`Port-To-App` contains the complete mobile shipping codebase, architecture specifications, and backend adaptations for deploying **CIPHERTRACE** as a native Android application.

### Key Tenets
1. **Parallel & Non-Disruptive**: The existing web platform in `frontend/` and `backend/` remains completely operational and untouched.
2. **True Native Android Client**: Built using **Kotlin**, **Jetpack Compose**, **Material 3**, **Retrofit**, and **AndroidX Biometrics**. (No insecure WebView wrappers).
3. **Zero-PQC-Client Architecture**: All heavy post-quantum cryptographic operations (ML-KEM-768 decapsulation, ML-DSA-65 digital signatures, 2D DCT steganography) execute within the backend's secure Keystore boundary. The mobile app acts as an authenticated, biometric-gated field terminal.
4. **Defense-Grade Mobile Security**:
   - `FLAG_SECURE` enforcement to block screenshots and screen recordings of confidential files.
   - Hardware-backed JWT storage using `EncryptedSharedPreferences` and the `AndroidKeyStore`.
   - Biometric authentication gate (`BiometricPrompt`) required before document decryption.
   - Backup exclusion (`android:allowBackup="false"`).

---

## 📂 Directory Layout

```
Port-To-App/
├── README.md                           # Master Mobile Shipping documentation
├── docs/
│   ├── ANDROID_SHIPPING_PLAN.md        # Comprehensive feasibility & implementation roadmap
│   ├── ARCHITECTURE.md                 # Security architecture, keystore boundary & biometrics
│   └── BACKEND_SYNC_GUIDE.md           # Network configuration (10.0.2.2 emulator, Wi-Fi LAN IP)
├── backend_copies/                     # Mobile-adapted copies of backend files
│   ├── app_backend_config.py           # Mobile CORS & emulator 10.0.2.2 settings
│   ├── app_backend_models_database.py  # Database models with Device binding
│   ├── app_backend_schemas.py          # Mobile schemas (Device, Provenance, Refresh)
│   ├── app_backend_router_auth.py      # Auth router with mobile device & refresh endpoints
│   ├── app_backend_router_documents.py # Documents router with consolidated provenance endpoint
│   ├── app_backend_service_keystore.py # Keystore service reference showing PQC boundary
│   └── INTEGRATION_GUIDE.md            # Exact steps to sync with website backend when ready
└── android/                            # Complete Native Android Application Project
    ├── build.gradle.kts                # Project build configuration
    ├── settings.gradle.kts             # Gradle settings
    ├── gradle.properties               # JVM & Kotlin build arguments
    └── app/                            # Android App module
        ├── build.gradle.kts            # App dependencies (Compose, Retrofit, Biometric, Security)
        ├── src/main/
        │   ├── AndroidManifest.xml     # Permissions, security config, FLAG_SECURE
        │   ├── res/                    # Values, themes, colors, network config
        │   └── java/com/ciphertrace/android/
        │       ├── CipherTraceApp.kt   # Application initialization
        │       ├── MainActivity.kt      # Main host activity with FLAG_SECURE toggle
        │       ├── data/               # Retrofit API client, DTOs & Repositories
        │       ├── security/           # TokenManager, Biometrics & Keystore integration
        │       └── ui/                 # Jetpack Compose UI (Screens, Theme, Components)
```

---

## 🚦 Implementation Progress

| Phase | Description | Status |
|:---|:---|:---:|
| **Step 1: Scaffolding & Architecture** | Architecture specs, shipping plan, backend mobile copies (`app_backend_*`) | ✅ Complete |
| **Step 2: Core Project, Security & Data** | Gradle build, Manifest, `TokenManager`, `BiometricPromptHelper`, `SecurityManager`, Retrofit API & Repositories | ✅ Complete |
| **Step 3: UI Layer & Native Screens** | Cyberpunk Theme, Components, Navigation, Login, Dashboard, Decryption, Provenance & Settings | ✅ Complete |
| **Step 4: Live Verification & Testing** | Backend connectivity verification, biometric authorization test & demo readiness | 🟢 Ready |

---

## 🚀 Quick Start for Android Development

### 1. Open in Android Studio
1. Open **Android Studio** (Koala / Ladybug or newer recommended).
2. Choose **Open an Existing Project** and navigate to `Port-To-App/android`.
3. Gradle will automatically sync dependencies.

### 2. Connect to Local Backend
1. Start your local CIPHERTRACE backend:
   ```cmd
   run_backend.bat
   ```
2. When testing in the **Android Emulator**, the app automatically connects to `http://10.0.2.2:8000`.
3. When testing on a **physical device over Wi-Fi**, open **Settings** inside the app and enter your PC's LAN IP (e.g. `http://192.168.1.10:8000`).

---

## 🛡️ SIH 2026 Presentation Highlights

When demonstrating the Android App to SIH judges:
1. **Quick-Login / Biometric Login**: Show one-tap operator login for tactical officers.
2. **Hardware Screen Protection**: Attempt to take a screenshot or screen record on a classified document — Android blocks it (`FLAG_SECURE`).
3. **Server-Side PQC Decryption**: Show the officer initiating decryption, biometric prompt firing, and the document rendering with invisible forensic DCT watermark.
4. **Blockchain Provenance Trail**: View the interactive timeline verifying Raft consensus, ML-DSA-65 signature, and 2-of-3 consortium block confirmation.
