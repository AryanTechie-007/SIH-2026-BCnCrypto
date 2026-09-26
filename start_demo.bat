@echo off
setlocal enabledelayedexpansion

:: Set the working directory to the script's location
cd /d "%~dp0"

echo ========================================================
echo  CIPHERTRACE 2.0 - Forensic Platform
echo  Smart India Hackathon 2026 - Robust Demo Launcher
echo ========================================================
echo.

:: --------------------------------------------------------
:: 1. PRIVILEGE CHECK
:: --------------------------------------------------------
echo [1/6] Checking system privileges...
net session >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Administrative privileges detected.
) else (
    echo [INFO] Standard user mode active. Elevated session check bypassed.
)

:: --------------------------------------------------------
:: 2. DEPENDENCY CHECKS & AUTO-PATH RESOLUTION
:: --------------------------------------------------------
echo [2/6] Validating environment and dependencies...

:: Scan for Python if not on PATH
python --version >nul 2>&1
if %errorlevel% neq 0 call :detect_python

:: Scan for Node if not on PATH
call node -v >nul 2>&1
if %errorlevel% neq 0 call :detect_node

:: Re-verify Python & Node. If missing, auto-trigger installer!
set "NEEDS_INSTALL=0"
python --version >nul 2>&1
if %errorlevel% neq 0 set "NEEDS_INSTALL=1"
call npm -v >nul 2>&1
if %errorlevel% neq 0 set "NEEDS_INSTALL=1"

if "!NEEDS_INSTALL!"=="1" (
    echo [!] Python or Node.js missing from environment.
    echo [*] Automatically launching the automated dependency installer...
    call setup\install_dependencies.bat
)

:: Frontend Dependencies
if not exist "frontend\node_modules\" (
    echo [SETUP] Installing frontend node_modules...
    pushd "%~dp0frontend"
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed. Check your internet connection.
        popd
        pause
        exit /b 1
    )
    popd
)

:: Backend Dependencies - Simplified check
echo [SETUP] Verifying Python environment...
python -c "import fastapi, uvicorn, pymupdf, cryptography" >nul 2>&1
if %errorlevel% neq 0 (
    echo [SETUP] Missing or outdated Python packages detected. Installing...
    python -m pip install --upgrade pip
    python -m pip install -r "%~dp0backend\requirements.txt"
    if !errorlevel! neq 0 (
        echo [ERROR] Python package installation failed.
        pause
        exit /b 1
    )
)
echo [OK] All dependencies verified.

:: --------------------------------------------------------
:: 3. PORT CLEANUP (Safe check, skip PID 0)
:: --------------------------------------------------------
echo [3/6] Terminating stale processes on ports 8000 and 5173...
for %%p in (8000 5173) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":%%p\>"' ) do (
        if not "%%a"=="0" (
            echo Killing process %%a on port %%p...
            taskkill /F /T /PID %%a >nul 2>&1
        )
    )
)
powershell -Command "Get-NetTCPConnection -LocalPort 8000, 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: --------------------------------------------------------
:: 4. START BACKEND
:: --------------------------------------------------------
echo [4/6] Starting Backend (Port 8000)...
start "CIPHERTRACE Backend" "%~dp0run_backend.bat"

:: --------------------------------------------------------
:: 5. START FRONTEND
:: --------------------------------------------------------
echo [5/6] Starting Frontend (Port 5173)...
start "CIPHERTRACE Frontend" "%~dp0run_frontend.bat"

:: --------------------------------------------------------
:: 6. FINALIZATION
:: --------------------------------------------------------
echo [6/6] Waiting for services to initialize...
ping 127.0.0.1 -n 6 >nul

echo.
echo Opening Browser at http://127.0.0.1:5173 ...
start http://127.0.0.1:5173

echo.
echo ========================================================
echo  CIPHERTRACE 2.0 is now ACTIVE and OPERATIONAL!
echo  Local UI:      http://127.0.0.1:5173
echo  Backend API:   http://127.0.0.1:8000/docs
echo ========================================================
echo.
echo Note: Keep the other terminal windows open to maintain the services.
pause
exit /b 0

:: --------------------------------------------------------
:: SUBROUTINES FOR SAFE PATH RESOLUTION
:: --------------------------------------------------------
:detect_python
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python313"
    "%LOCALAPPDATA%\Programs\Python\Python312"
    "%LOCALAPPDATA%\Programs\Python\Python311"
    "%LOCALAPPDATA%\Programs\Python\Python310"
    "C:\Program Files\Python313"
    "C:\Program Files\Python312"
    "C:\Program Files\Python311"
    "C:\Program Files\Python310"
) do (
    if exist "%%~fP\python.exe" (
        set "PATH=%%~fP;%%~fP\Scripts;!PATH!"
        goto :eof
    )
)
goto :eof

:detect_node
for %%N in (
    "C:\Program Files\nodejs"
    "%LOCALAPPDATA%\Programs\nodejs"
    "%ProgramFiles%\nodejs"
    "%ProgramFiles(x86)%\nodejs"
) do (
    if exist "%%~fN\node.exe" (
        set "PATH=%%~fN;!PATH!"
        goto :eof
    )
)
goto :eof
