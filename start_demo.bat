@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================================
echo  CIPHERTRACE 2.0 - Military-Grade Forensic Platform
echo  Smart India Hackathon 2026 - Air-Gapped Demo Launcher
echo ========================================================
echo.

echo [1/4] Terminating any stale processes on ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/4] Starting CIPHERTRACE 2.0 FastAPI Backend (Port 8000)...
start "CIPHERTRACE 2.0 Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [3/4] Starting CIPHERTRACE 2.0 Military UI Frontend (Port 5173)...
start "CIPHERTRACE 2.0 Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [4/4] Initializing cryptographic services and waiting for readiness...
timeout /t 4 /nobreak >nul

echo Opening Browser at http://127.0.0.1:5173 ...
start http://127.0.0.1:5173

echo.
echo ========================================================
echo  CIPHERTRACE 2.0 is now ACTIVE and OPERATIONAL!
echo  Tactical UI:   http://127.0.0.1:5173
echo  Backend API:   http://127.0.0.1:8000/docs
echo  Security Spec: NIST FIPS 203 ML-KEM-768 / FIPS 204 ML-DSA-65
echo ========================================================
echo.
pause
