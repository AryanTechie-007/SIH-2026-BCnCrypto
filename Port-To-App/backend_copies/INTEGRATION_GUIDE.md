# 🔌 Backend Mobile Integration & Sync Guide

## Overview

To guarantee that your ongoing website testing and demonstrations remain 100% uninterrupted, all backend modifications and mobile-specific extensions are maintained as parallel copies in `Port-To-App/backend_copies/`.

The files use the `app_backend_*` naming convention:

| Port-To-App File | Original Web Backend File | Mobile Adaptations Included |
|:---|:---|:---|
| `app_backend_config.py` | `backend/app/config.py` | Allowed origins include Android emulator (`10.0.2.2:8000`, `10.0.2.2:3000`) and LAN bindings. |
| `app_backend_models_database.py` | `backend/app/models/database.py` | Added `Device` ORM model for hardware fingerprinting and push tokens. |
| `app_backend_schemas.py` | `backend/app/schemas.py` | Added `DeviceRegisterRequest`, `TokenRefreshResponse`, `DocumentProvenanceResponse`. |
| `app_backend_router_auth.py` | `backend/app/routers/auth.py` | Added `/devices/register`, `/devices/revoke`, and `/refresh` endpoints. |
| `app_backend_router_documents.py` | `backend/app/routers/documents.py` | Added consolidated `GET /{document_id}/provenance` endpoint. |
| `app_backend_service_keystore.py` | `backend/app/services/keystore.py` | Reference copy documenting the server-side PQC keystore boundary. |

---

## When You Are Ready to Merge Into Main Backend:

1. **CORS update**: In `backend/app/config.py`, add `http://10.0.2.2:8000` to `ALLOWED_ORIGINS`.
2. **Device Model**: In `backend/app/models/database.py`, paste the `Device` class and `devices = relationship("Device", ...)` on `User`.
3. **Schemas**: In `backend/app/schemas.py`, paste the mobile schema definitions.
4. **Auth Endpoints**: In `backend/app/routers/auth.py`, paste the `/refresh` and `/devices/*` route handlers.
5. **Provenance Endpoint**: In `backend/app/routers/documents.py`, paste the `GET /{document_id}/provenance` route handler.

*Because all new endpoints are strictly additive and backward-compatible, applying these merges will never break any existing web frontend feature.*
