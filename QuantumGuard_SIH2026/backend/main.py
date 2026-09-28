import os
import sys
from fastapi import FastAPI, UploadFile, File
import uvicorn

# Ensure local services package can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.crypto_engine import QuantumCrypto

app = FastAPI(title="QuantumGuard PQC Backend - SIH 2026")
crypto = QuantumCrypto()

def get_sensitivity(text):
    # Dynamic AI Logic
    keywords = {"SECRET": 3, "CONFIDENTIAL": 2, "INTERNAL": 1}
    score = sum(text.upper().count(k) * v for k, v in keywords.items())
    return "HIGH" if score > 5 else "MEDIUM" if score > 0 else "LOW"

@app.post("/secure-upload")
async def secure_upload(file: UploadFile = File(...)):
    content = await file.read()
    
    # AI Classification
    sensitivity = get_sensitivity(content.decode(errors='ignore'))
    
    # Encrypt based on AI result
    result = crypto.encrypt_file(content)
    result["sensitivity"] = sensitivity
    
    return {"status": "SUCCESS", "data": result}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
