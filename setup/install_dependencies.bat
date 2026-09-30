@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."
set "PROJECT_ROOT=%cd%"

echo ================================================================
echo  CIPHERTRACE - Automated Windows Dependency Installer
echo  Zero-Manual Setup: Automated PATH Resolution and Dependencies
echo ================================================================
echo.

REM ------------------------------------------------------------------
REM 1. PYTHON DETECTION AND AUTO-PATH CONFIGURATION
REM ------------------------------------------------------------------
echo [1/4] Detecting Python environment...

set "PYTHON_EXE="

:: 1a. Test python directly from current PATH
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
    goto :python_found
)

:: 1b. Test py launcher
py -3 --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=py -3"
    goto :python_found
)

:: 1c. Scan standard filesystem locations
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "C:\Program Files\Python313\python.exe"
    "C:\Program Files\Python312\python.exe"
    "C:\Program Files\Python311\python.exe"
    "C:\Program Files\Python310\python.exe"
    "C:\Python313\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe"
) do (
    if exist "%%~fP" (
        set "PYTHON_EXE=%%~fP"
        goto :python_found
    )
)

:: 1d. Auto-install Python 3.11 via winget if missing
echo [!] Python was not detected on this system.
echo [+] Attempting installation via Windows Package Manager (winget)...
winget install --id Python.Python.3.11 -e --silent --accept-package-agreements --accept-source-agreements >nul 2>&1

:: Re-check after winget
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "C:\Program Files\Python311\python.exe"
) do (
    if exist "%%~fP" (
        set "PYTHON_EXE=%%~fP"
        goto :python_found
    )
)

if not defined PYTHON_EXE (
    echo [ERROR] Python was not found and automated installation could not complete.
    echo         Please download Python 3.11 or 3.12 from https://www.python.org/
    pause
    exit /b 1
)

:python_found
echo [OK] Using Python runtime: %PYTHON_EXE%
%PYTHON_EXE% --version

REM ------------------------------------------------------------------
REM 2. NODE.JS AND NPM DETECTION
REM ------------------------------------------------------------------
echo.
echo [2/4] Detecting Node.js runtime and npm...

set "NODE_OK=0"
call node -v >nul 2>&1
if %errorlevel% equ 0 set "NODE_OK=1"

if "!NODE_OK!"=="0" (
    for %%N in (
        "C:\Program Files\nodejs"
        "%LOCALAPPDATA%\Programs\nodejs"
        "%ProgramFiles%\nodejs"
        "%ProgramFiles(x86)%\nodejs"
    ) do (
        if exist "%%~fN\node.exe" (
            set "PATH=%%~fN;!PATH!"
            set "NODE_OK=1"
        )
    )
)

if "!NODE_OK!"=="0" (
    echo [!] Node.js not detected on PATH. Attempting automated installation via winget...
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    for %%N in (
        "C:\Program Files\nodejs"
        "%LOCALAPPDATA%\Programs\nodejs"
    ) do (
        if exist "%%~fN\node.exe" (
            set "PATH=%%~fN;!PATH!"
            set "NODE_OK=1"
        )
    )
)

call node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found. Please install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js runtime:
call node -v
echo [OK] NPM package manager:
call npm -v

REM ------------------------------------------------------------------
REM 3. INSTALL BACKEND CRYPTOGRAPHIC AND RUNTIME DEPENDENCIES
REM ------------------------------------------------------------------
echo.
echo [3/4] Installing backend dependencies...

echo [*] Upgrading pip...
%PYTHON_EXE% -m pip install --upgrade pip --quiet >nul 2>&1

echo [*] Installing requirements from backend/requirements.txt...
%PYTHON_EXE% -m pip install --find-links "%PROJECT_ROOT%\setup\wheels" -r "%PROJECT_ROOT%\backend\requirements.txt"
if %errorlevel% neq 0 (
    echo [WARNING] Retrying install with wheel fallback...
    %PYTHON_EXE% -m pip install --find-links "%PROJECT_ROOT%\setup\wheels" pydantic cryptography pymupdf Pillow numpy scipy sqlalchemy greenlet aiosqlite opencv-python-headless dilithium-py argon2-cffi mlkem
)

echo [*] Validating NIST Post-Quantum Cryptography Engine...
%PYTHON_EXE% -c "import sys; sys.path.insert(0, 'backend'); from app.services.crypto_engine import CryptoEngine; CryptoEngine.verify_pqc_availability(); print('[+] NIST FIPS 203 & 204 PQC Engine: ONLINE')"
if %errorlevel% neq 0 (
    echo [WARNING] PQC self-test flagged non-zero. System will operate in compatibility mode.
)

REM ------------------------------------------------------------------
REM 4. INSTALL FRONTEND AND LEDGER CLIENT DEPENDENCIES
REM ------------------------------------------------------------------
echo.
echo [4/4] Installing Frontend React and Vite dependencies...
cd /d "%PROJECT_ROOT%\frontend"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install encountered errors.
    cd /d "%PROJECT_ROOT%"
    pause
    exit /b 1
)

echo [*] Installing ledger client dependencies (blockchain\client, used for sign-in)...
cd /d "%PROJECT_ROOT%\blockchain\client"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install encountered errors in blockchain\client.
    cd /d "%PROJECT_ROOT%"
    pause
    exit /b 1
)

echo [*] Installing desktop app dependencies (Electron)...
cd /d "%PROJECT_ROOT%\desktop"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install encountered errors in desktop.
    cd /d "%PROJECT_ROOT%"
    pause
    exit /b 1
)
cd /d "%PROJECT_ROOT%"

echo.
echo ================================================================
echo  ALL DEPENDENCIES AND PATHS FULLY CONFIGURED!
echo.
echo  To launch CIPHERTRACE:
echo  cd desktop  then  npm start
echo ================================================================
echo.
pause
