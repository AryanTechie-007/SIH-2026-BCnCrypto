import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.services.crypto_engine import CryptoEngine
from app.routers import system, identity, documents, decryption, forensics, ledger, attacks, auth

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ciphertrace")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle manager."""
    logger.info("================================================================================")
    logger.info("    CIPHERTRACE 2.0 - NIST FIPS 203 & 204 POST-QUANTUM DEFENSE PLATFORM        ")
    logger.info("================================================================================")

    # 1. Validate configuration settings
    settings.validate()
    logger.info(f"[*] Operational Mode: {settings.get_mode_label()} (DEMO_MODE={settings.DEMO_MODE}, SECURE_MODE={settings.SECURE_MODE})")

    # 2. Verify genuine post-quantum cryptographic engine
    backend_info = CryptoEngine.get_backend_info()
    logger.info(f"[*] Cryptographic Backend: {backend_info['backend']}")
    logger.info(f"[*] KEM: {backend_info['kem_algorithm']} | Signature: {backend_info['signature_algorithm']}")
    CryptoEngine.verify_pqc_availability()
    logger.info("[+] Genuine NIST PQC self-test PASSED (ML-KEM-768 round-trip & ML-DSA-65 sign/verify verified)")

    # 3. Initialize SQLite database metadata schema
    await init_db()
    logger.info(f"[+] Database metadata initialized at: {settings.DB_PATH}")

    yield

    logger.info("[*] CIPHERTRACE system shutdown initiated.")


app = FastAPI(
    title="CIPHERTRACE 2.0 — Post-Quantum Confidential Document Security & Provenance Platform",
    description="Confidential Document Security and Leak Attribution System (NIST FIPS 203 ML-KEM-768, FIPS 204 ML-DSA-65, AES-256-GCM, 2D DCT Steganography)",
    version="2.0.0-ENTERPRISE",
    lifespan=lifespan
)

# ── CORS Middleware ────────────────────────────────────────────────────────
allowed_origins = settings.ALLOWED_ORIGINS
if settings.DEMO_MODE and "*" not in allowed_origins:
    allowed_origins = allowed_origins + ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if not settings.DEMO_MODE else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ── Security Headers Middleware ────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Enforces essential defense-grade HTTP security headers."""
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# ── Global Exception Handler ──────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    logger.error(f"Internal processing error on {request.method} {request.url.path}: {exc}")
    error_msg = str(exc) or type(exc).__name__
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Processing Error: {error_msg}"}
    )


# ── Include All System Routers ────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(system.router)
app.include_router(identity.router)
app.include_router(documents.router)
app.include_router(decryption.router)
app.include_router(forensics.router)
app.include_router(ledger.router)
app.include_router(attacks.router)


@app.get("/")
async def root():
    backend_info = CryptoEngine.get_backend_info()
    return {
        "platform": "CIPHERTRACE 2.0",
        "status": "OPERATIONAL",
        "mode": settings.get_mode_label(),
        "cryptography": {
            "kem": backend_info["kem_algorithm"],
            "signature": backend_info["signature_algorithm"],
            "backend": backend_info["backend"],
            "standards": [backend_info["fips_203_standard"], backend_info["fips_204_standard"]]
        },
        "documentation": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
