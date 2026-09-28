@echo off
title QuantumGuard SIH 2026 - Setup & Installer
color 0b

echo ==================================================================
echo     🛡️  QUANTUMGUARD - SIH 2026 DEPENDENCY & RUNTIME INSTALLER   
echo ==================================================================

echo [*] Step 1: Installing Python Dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo [*] Step 2: Running NIST Post-Quantum Cryptography Self-Test...
python -c "from backend.app.services.crypto_engine import CryptoEngine, HybridPQCEngine; CryptoEngine.verify_pqc_availability(); print('[+] NIST PQC Self-Test PASSED')"

echo ==================================================================
echo     ✅  INSTALLATION COMPLETE! 
echo ==================================================================
echo To launch Desktop Command Center:
echo    python desktop\main_app.py
echo.
echo To launch Backend Server:
echo    cd backend ^&^& python -m uvicorn app.main:app --port 8000 --reload
echo ==================================================================
pause
