import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .database import init_db
from .routers import system, identity, documents, decryption, forensics, ledger, attacks, auth

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence: initialize database schema
    await init_db()
    yield

app = FastAPI(
    title="CIPHERTRACE 2.0 — Post-Quantum Confidential Document Security & Provenance Platform",
    description="Confidential Document Security and Leak Attribution System (NIST FIPS 203 ML-KEM-768, FIPS 204 ML-DSA-65, AES-256-GCM, 2D DCT Steganography)",
    version="2.0.0-ENTERPRISE",
    lifespan=lifespan
)

# Enable CORS for local Vite development and air-gapped terminal access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler to guarantee structured error delivery to UI
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    error_msg = str(exc) or type(exc).__name__
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Processing Error: {error_msg}"}
    )

# Include All System Routers
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
    return {
        "platform": "CIPHERTRACE 2.0",
        "status": "OPERATIONAL",
        "documentation": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
