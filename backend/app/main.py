import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, UploadFile, File
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
        "platform": "CIPHERTRACE 2.0 (QuantumGuard)",
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


@app.post("/analyze")
@app.post("/api/analyze")
async def analyze_document(file: UploadFile = File(...)):
    """
    Dynamic AI Content Classifier & Sensitivity Analyzer for Desktop & Mobile clients.
    Extracts text from uploaded documents (PDF, TXT, MD, etc.) and determines defense classification policy.
    """
    from app.services.ai_engine import DocumentIntelligence
    classifier = DocumentIntelligence()

    content = await file.read()
    text = ""
    # Extract text if PDF
    if (file.filename and file.filename.lower().endswith(".pdf")) or content.startswith(b"%PDF"):
        try:
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            for page in doc:
                text += page.get_text() + " "
        except Exception:
            text = content.decode("utf-8", errors="ignore")
    else:
        text = content.decode("utf-8", errors="ignore")

    result = classifier.classify_and_configure(text)
    return {
        "status": "ANALYZED",
        "file_name": file.filename or "uploaded_document",
        "size_bytes": len(content),
        "label": result["label"],
        "policy": result["policy"],
        "text_sample": text[:200]
    }


def get_sensitivity(text: str) -> str:
    # Dynamic AI Logic
    keywords = {"SECRET": 3, "CONFIDENTIAL": 2, "INTERNAL": 1, "NUCLEAR": 5, "WARHEAD": 5, "DEPLOYMENT": 4}
    score = sum(text.upper().count(k) * v for k, v in keywords.items())
    return "HIGH" if score > 5 else "MEDIUM" if score > 0 else "LOW"


@app.post("/secure-upload")
async def secure_upload(file: UploadFile = File(...)):
    """
    QuantumGuard Secure Upload Endpoint:
    Combines Dynamic AI Sensitivity Analysis with NIST ML-KEM-768 + AES-256-GCM encryption.
    """
    from app.services.crypto_engine import QuantumCrypto
    crypto = QuantumCrypto()

    content = await file.read()
    
    # AI Classification
    sensitivity = get_sensitivity(content.decode(errors='ignore'))
    
    # Encrypt based on AI result
    result = crypto.encrypt_file(content)
    result["sensitivity"] = sensitivity
    result["file_name"] = file.filename or "secured_document"
    
    return {"status": "SUCCESS", "data": result}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
