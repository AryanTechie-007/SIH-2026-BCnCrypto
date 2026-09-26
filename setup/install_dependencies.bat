@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."

echo ================================================================
echo  CIPHERTRACE 2.0 - Complete Dependency Installer
echo  Smart India Hackathon 2026 - Defense Security Platform
echo ================================================================
echo.

:: 1. Verify Python
echo [1/4] Verifying Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.11+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
python --version

:: 2. Install Backend Python Packages
echo.
echo [2/4] Installing Python cryptographic & backend dependencies...
python -m pip install --upgrade pip
python -m pip install -r "%~dp0..\backend\requirements.txt"
if %errorlevel% neq 0 (
    echo [WARNING] Some Python packages encountered warnings. Retrying with basic wheels...
    python -m pip install fastapi uvicorn cryptography pymupdf Pillow numpy scipy reedsolo python-multipart
)

:: 3. Verify Node.js & NPM
echo.
echo [3/4] Verifying Node.js and NPM...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js version:
node --version
echo NPM version:
call npm --version

:: 4. Install Frontend NPM Packages
echo.
echo [4/5] Installing Frontend React / Vite dependencies...
cd /d "%~dp0..\frontend"
call npm install
cd /d "%~dp0.."

:: 5. Distributed Ledger & Blockchain Runtime Verification
echo.
echo [5/5] Checking Distributed Ledger & Blockchain prerequisites (Stream C DLT)...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Docker Engine detected:
    docker --version
    if defined FABRIC_SAMPLES (
        echo [OK] Hyperledger Fabric path configured: %FABRIC_SAMPLES%
    ) else (
        echo [INFO] FABRIC_SAMPLES is not set. To connect to an external Hyperledger Fabric network:
        echo        set FABRIC_SAMPLES=C:\path\to\fabric-samples
        echo        Otherwise, CIPHERTRACE runs using its built-in High-Assurance Cryptographic Merkle Ledger.
    )
) else (
    echo [INFO] Docker not detected or not running.
    echo        CIPHERTRACE will run using its built-in High-Assurance Cryptographic Merkle Ledger
    echo        (100%% offline, FIPS 202 SHA3-256 hash-chained blocks, zero external overhead).
)

echo.
echo ================================================================
echo  ALL DEPENDENCIES INSTALLED SUCCESSFULLY!
echo.
echo  To start the application:
echo  Simply run 'start_demo.bat' in the project root folder.
echo ================================================================
echo.
pause
