import os
import sys
import uvicorn

# Ensure backend directory is in python search path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app

if __name__ == "__main__":
    print("==================================================================")
    print("    🛡️  QUANTUMGUARD / CIPHERTRACE - DEFENSE BACKEND SERVER       ")
    print("==================================================================")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
