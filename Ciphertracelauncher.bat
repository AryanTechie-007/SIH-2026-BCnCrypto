@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: CIPHERTRACE - Application Launcher for Windows
:: ============================================================================

title CIPHERTRACE - Application Launcher

:: Change working directory to the repository root
cd /d "%~dp0"

echo ============================================================================
echo                           CIPHERTRACE LAUNCHER
echo       Post-Quantum Confidential Document Sharing with Leak Attribution
echo ============================================================================
echo.

:: ----------------------------------------------------------------------------
:: 1. Verify Dependencies
:: ----------------------------------------------------------------------------
set "MISSING_DEP=0"

if not exist "%~dp0backend\.venv\Scripts\python.exe" (
    echo [MISSING] Python virtual environment: backend\.venv\
    set "MISSING_DEP=1"
)

if not exist "%~dp0frontend\node_modules\" (
    echo [MISSING] Frontend dependencies: frontend\node_modules\
    set "MISSING_DEP=1"
)

if not exist "%~dp0desktop\node_modules\" (
    echo [MISSING] Desktop dependencies: desktop\node_modules\
    set "MISSING_DEP=1"
)

if not exist "%~dp0blockchain\client\node_modules\" (
    echo [MISSING] Blockchain client dependencies: blockchain\client\node_modules\
    set "MISSING_DEP=1"
)

if "!MISSING_DEP!"=="1" goto :handle_missing_deps
goto :check_ui_build

:handle_missing_deps
echo.
echo [WARNING] One or more required packages or environments are missing!
echo.
set /p "RUN_INSTALL=Would you like to run install_dependencies.bat now? [Y/N]: "
if /i "!RUN_INSTALL!"=="Y" (
    echo.
    call "%~dp0install_dependencies.bat"
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] Dependency installation failed. Cannot launch application.
        pause
        exit /b 1
    )
) else (
    echo.
    echo [INFO] Launch aborted. Please run install_dependencies.bat first.
    pause
    exit /b 1
)

:check_ui_build
:: ----------------------------------------------------------------------------
:: 2. Ensure Frontend UI and Ledger Bundles are Ready
:: ----------------------------------------------------------------------------
if not exist "%~dp0frontend\dist\index.html" (
    echo [INFO] Frontend UI bundle not found. Building UI before launch...
    cd /d "%~dp0desktop"
    call npm run build:ui
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to compile frontend UI!
        pause
        exit /b 1
    )
    cd /d "%~dp0"
)

if not exist "%~dp0blockchain\bundles\alice.zip" (
    echo [INFO] Identity bundles not found. Initializing local ledger identities...
    call "%~dp0blockchain\setup.bat" --no-pause
)

:: ----------------------------------------------------------------------------
:: 3. Set Up Runtime Environment
:: ----------------------------------------------------------------------------
:: Enable local ledger by default when running locally on Windows
if "%USE_LOCAL_LEDGER%"=="" (
    set "USE_LOCAL_LEDGER=true"
)

:: Point FABRIC_SAMPLES to local crypto if not defined
if "%FABRIC_SAMPLES%"=="" (
    set "FABRIC_SAMPLES=%~dp0blockchain\crypto"
)

:: Set system secret if not already set by user
if "%CIPHERTRACE_SYSTEM_SECRET%"=="" (
    set "CIPHERTRACE_SYSTEM_SECRET=ciphertrace-local-system-secret"
)

:: Clear ELECTRON_RUN_AS_NODE to prevent Electron from starting in headless Node CLI mode
set ELECTRON_RUN_AS_NODE=

:: Configure Python output buffering
set PYTHONUNBUFFERED=1
set PYTHONIOENCODING=utf-8

:: ----------------------------------------------------------------------------
:: 4. Launch Application
:: ----------------------------------------------------------------------------
if /i "%~1"=="--dev" goto :launch_dev
if /i "%~1"=="dev" goto :launch_dev
if /i "%~1"=="-d" goto :launch_dev

:launch_normal
echo [INFO] Starting CIPHERTRACE Desktop Application...
echo.
cd /d "%~dp0desktop"
call npm start
goto :finish

:launch_dev
echo [INFO] Launching in Developer Mode (hot reload)...
echo [INFO] Starting Vite development server in background...
start "CIPHERTRACE - Vite Dev Server" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
timeout /t 3 /nobreak >nul
echo [INFO] Starting Desktop App connected to Dev Server...
cd /d "%~dp0desktop"
call node scripts\launch.js --dev
goto :finish

:finish
cd /d "%~dp0"
echo.
echo ============================================================================
echo [INFO] CIPHERTRACE application closed.
echo ============================================================================
echo.
if /i not "%~1"=="--no-pause" if /i not "%~2"=="--no-pause" (
    pause
)
exit /b 0
