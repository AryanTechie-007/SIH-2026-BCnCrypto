@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo  CIPHERTRACE - Post-Quantum Forensic Attribution Platform
echo  Smart India Hackathon 2026 - Air-Gapped Demo Launcher
echo ========================================================
echo.

echo [1/3] Starting CIPHERTRACE FastAPI Backend (Port 8000)...
start "CIPHERTRACE Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

echo [2/3] Starting CIPHERTRACE Vite Frontend (Port 5173)...
start "CIPHERTRACE Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [3/3] Waiting for services to initialize...
timeout /t 5 /nobreak >nul

echo Opening Browser at http://127.0.0.1:5173 ...
start http://127.0.0.1:5173

echo.
echo ========================================================
echo CIPHERTRACE is now running!
echo Frontend UI:   http://127.0.0.1:5173
echo Backend API:   http://127.0.0.1:8000/docs
echo ========================================================
echo.
pause
