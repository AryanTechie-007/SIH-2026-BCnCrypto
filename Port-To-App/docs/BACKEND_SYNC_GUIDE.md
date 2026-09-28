# 🔄 Backend Sync & Network Guide for Mobile App

## 1. Network Connectivity Overview

When running the Android application against your local FastAPI backend, the network configuration depends on your test environment:

| Environment | Backend URL | Setup Notes |
|:---|:---|:---|
| **Android Emulator** (Default) | `http://10.0.2.2:8000` | The Android emulator uses `10.0.2.2` as an alias to your host PC's `127.0.0.1` |
| **Physical Android Device** (Wi-Fi) | `http://192.168.x.x:8000` | Device and PC must be on the same Wi-Fi network; replace with host PC IP |
| **Physical Android Device** (USB ADB) | `http://127.0.0.1:8000` | Run `adb reverse tcp:8000 tcp:8000` over USB cable |
| **Production Server** | `https://api.ciphertrace.mil` | Production deployment with valid SSL/TLS certificate |

---

## 2. In-App Dynamic Server URL Configurator

In the Android App, the `SettingsScreen` includes a dynamic Server URL configuration panel. You can:
1. Select **"Android Emulator (10.0.2.2:8000)"** with a single tap.
2. Select **"Localhost via ADB Reverse (127.0.0.1:8000)"**.
3. Type custom LAN IP (e.g. `http://192.168.1.15:8000`).
4. Test live backend ping and health check (`GET /api/system/health`) with immediate visual confirmation.

---

## 3. Backend Endpoints for Mobile

The backend provides the following endpoints:

### Authentication
- `POST /api/auth/login` — Standard user login (returns JWT token and officer profile)
- `POST /api/auth/quick-login` — Fast operator login for demonstration
- `POST /api/auth/refresh` — Issue fresh JWT token for active session
- `POST /api/auth/devices/register` — Register mobile hardware fingerprint and push token
- `POST /api/auth/devices/revoke` — Revoke compromised device access
- `GET /api/auth/me` — Authenticated officer identity & clearance
- `GET /api/auth/users` — Public key registry

### Documents & Key Envelopes
- `GET /api/documents` — List all classified documents
- `POST /api/documents/upload` — Upload PDF asset (calculates SHA3-256)
- `POST /api/documents/distribute` — Encapsulate DEK with ML-KEM-768 for recipients
- `GET /api/documents/{id}/provenance` — Consolidated lifecycle timeline

### Decryption & Attribution
- `POST /api/decryption/decrypt` — Decapsulate DEK, decrypt AES-GCM, embed 2D DCT watermark, sign ML-DSA-65, commit to Hyperledger Fabric
- `GET /api/decryption/download/{eventId}` — Download watermarked PDF

### Ledger & Verification
- `GET /api/ledger/blocks` — Inspect Hyperledger Fabric blocks and Raft consensus metadata
- `GET /api/ledger/verify` — Cryptographic verification of ledger hash integrity

---

## 4. Preserving the Web Platform

All mobile adaptations and copied backend files are isolated in `Port-To-App/backend_copies/` with distinct `app_backend_*` prefixes. The website files in `backend/` and `frontend/` remain completely untouched and operational for ongoing testing.
