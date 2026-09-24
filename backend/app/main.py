from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
from .database import init_db
from .routers import identity, documents, decryption, forensics, evidence, attacks, ledger_demo, ledger

app = FastAPI(title="CipherTrace Backend")

# CORS configuration for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await init_db()

app.include_router(identity.router)
app.include_router(documents.router)
app.include_router(decryption.router)
app.include_router(forensics.router)
app.include_router(evidence.router)
app.include_router(attacks.router)
app.include_router(ledger_demo.router)
app.include_router(ledger.router)

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "0.1.0"}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": "An internal server error occurred.", "detail": str(exc)},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
