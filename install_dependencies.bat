@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: CIPHERTRACE - Automated Dependency Installer for Windows
:: ============================================================================

title CIPHERTRACE - Dependency Installer

:: Change working directory to the repository root
cd /d "%~dp0"

echo ============================================================================
echo                    CIPHERTRACE DEPENDENCY INSTALLER
echo       Post-Quantum Confidential Document Sharing with Leak Attribution
echo ============================================================================
echo.
echo [INFO] Checking system prerequisites...
echo.

:: ----------------------------------------------------------------------------
:: 1. Check for Node.js
:: ----------------------------------------------------------------------------
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH!
    echo.
    echo Please install Node.js version 20+ or 22+ from:
    echo   https://nodejs.org/
    echo.
    echo After installing Node.js, restart your terminal and re-run this script.
    echo.
    goto :failure
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK] Node.js is installed: %NODE_VER%

:: ----------------------------------------------------------------------------
:: 2. Check for npm
:: ----------------------------------------------------------------------------
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in your system PATH!
    echo Please ensure npm is installed alongside Node.js and included in PATH.
    echo.
    goto :failure
)

for /f "tokens=*" %%v in ('call npm -v') do set "NPM_VER=%%v"
echo [OK] npm is installed: v%NPM_VER%

:: ----------------------------------------------------------------------------
:: 3. Check for Python
:: ----------------------------------------------------------------------------
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in your system PATH!
    echo.
    echo Please install Python 3.12 or 3.13 from:
    echo   https://www.python.org/downloads/
    echo.
    echo IMPORTANT: Ensure you check "Add python.exe to PATH" during installation.
    echo.
    goto :failure
)

for /f "tokens=*" %%v in ('python --version 2^>^&1') do set "PYTHON_VER=%%v"
echo [OK] Python is installed: %PYTHON_VER%

:: ----------------------------------------------------------------------------
:: 4. Locate or Install Astral 'uv'
:: ----------------------------------------------------------------------------
echo.
echo [INFO] Checking for Astral 'uv' package manager...

set "UV_CMD="

:: Check if uv is in PATH
where uv >nul 2>nul
if %errorlevel% equ 0 (
    set "UV_CMD=uv"
)

:: Check if python -m uv works
if not defined UV_CMD (
    python -m uv --version >nul 2>nul
    if !errorlevel! equ 0 (
        set "UV_CMD=python -m uv"
    )
)

:: If uv is not found, attempt automatic installation via pip
if not defined UV_CMD (
    echo [INFO] 'uv' was not detected. Attempting to install 'uv' via pip...
    call python -m pip install --quiet uv
    if !errorlevel! equ 0 (
        python -m uv --version >nul 2>nul
        if !errorlevel! equ 0 (
            set "UV_CMD=python -m uv"
            echo [OK] Successfully installed 'uv' via pip.
        )
    )
)

:: If pip install did not work, try Astral's official PowerShell installer
if not defined UV_CMD (
    echo [INFO] Attempting installation of 'uv' via Astral official installer...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex" >nul 2>nul
    if exist "%USERPROFILE%\.cargo\bin\uv.exe" (
        set "UV_CMD="%USERPROFILE%\.cargo\bin\uv.exe""
    ) else if exist "%LOCALAPPDATA%\bin\uv.exe" (
        set "UV_CMD="%LOCALAPPDATA%\bin\uv.exe""
    )
)

if not defined UV_CMD (
    echo [ERROR] Could not detect or automatically install Astral 'uv'.
    echo Please install 'uv' manually by running:
    echo   pip install uv
    echo Or follow instructions at: https://docs.astral.sh/uv/
    echo.
    goto :failure
)

echo [OK] Using uv command: %UV_CMD%

:: ----------------------------------------------------------------------------
:: 5. Check for Docker (Required for running local Hyperledger Fabric network)
:: ----------------------------------------------------------------------------
echo.
echo [INFO] Checking for Docker [required for local blockchain ledger]...
where docker >nul 2>nul
if %errorlevel% equ 0 goto :docker_found
goto :docker_missing

:docker_found
for /f "tokens=*" %%v in ('docker --version 2^>^&1') do set "DOCKER_VER=%%v"
echo [OK] Docker is installed: %DOCKER_VER%
goto :after_docker

:docker_missing
echo [NOTICE] Docker is not installed or not found in system PATH.
echo Docker Desktop is required if you plan to run the Hyperledger Fabric ledger
echo locally on this machine.
echo [Note: If you plan to connect to a remote ledger server, local Docker is not required.]
where winget >nul 2>nul
if %errorlevel% neq 0 (
    echo You can download Docker Desktop manually from:
    echo   https://www.docker.com/products/docker-desktop/
    goto :after_docker
)

if /i "%~1"=="--no-pause" goto :after_docker

echo.
set /p "INSTALL_DOCKER=Would you like to install Docker Desktop now via winget? [Y/N]: "
if /i not "!INSTALL_DOCKER!"=="Y" goto :after_docker

echo.
echo [INFO] Launching Docker Desktop installer via winget...
echo [Please approve the Administrator / UAC prompt if asked]
call winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
echo.
echo [NOTE] Docker Desktop has been downloaded and installed.
echo Remember to restart your computer and enable WSL 2 if prompted.

:after_docker

echo.
echo ============================================================================
echo                     INSTALLING APPLICATION PACKAGES
echo ============================================================================

:: ----------------------------------------------------------------------------
:: Step 1: Backend Python Environment (ML-KEM, ML-DSA, Watermarking, etc.)
:: ----------------------------------------------------------------------------
echo.
echo [1/4] Setting up Python virtual environment and backend dependencies...
cd /d "%~dp0backend"
if %errorlevel% neq 0 goto :failure

call %UV_CMD% sync
if %errorlevel% neq 0 (
    echo [ERROR] Backend dependency sync via uv failed!
    goto :failure
)

if not exist "%~dp0backend\.venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment was not created at backend\.venv\
    goto :failure
)
echo [OK] Backend environment successfully prepared with post-quantum cryptography packages.

:: ----------------------------------------------------------------------------
:: Step 2: Frontend UI Dependencies (React, Vite, Lucide, Tailwind/CSS)
:: ----------------------------------------------------------------------------
echo.
echo [2/4] Installing frontend UI dependencies...
cd /d "%~dp0frontend"
if %errorlevel% neq 0 goto :failure

call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Frontend npm install failed!
    goto :failure
)
echo [OK] Frontend packages installed.

:: ----------------------------------------------------------------------------
:: Step 3: Desktop App Dependencies (Electron, Electron Builder, esbuild)
:: ----------------------------------------------------------------------------
echo.
echo [3/4] Installing desktop Electron application dependencies...
cd /d "%~dp0desktop"
if %errorlevel% neq 0 goto :failure

call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Desktop npm install failed!
    goto :failure
)
echo [OK] Desktop packages installed.

:: ----------------------------------------------------------------------------
:: Step 4: Blockchain Ledger Client Dependencies (Fabric Gateway, gRPC)
:: ----------------------------------------------------------------------------
echo.
echo [4/4] Installing blockchain ledger client dependencies...
cd /d "%~dp0blockchain\client"
if %errorlevel% neq 0 goto :failure

call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Blockchain client npm install failed!
    goto :failure
)
echo [OK] Blockchain client packages installed.

:: ----------------------------------------------------------------------------
:: Step 5: Pre-build Frontend Distribution Bundle
:: ----------------------------------------------------------------------------
echo.
echo [INFO] Pre-building frontend UI distribution bundle...
cd /d "%~dp0frontend"
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Building frontend bundle failed!
    goto :failure
)
echo [OK] Frontend bundle built successfully in frontend\dist\

:: ----------------------------------------------------------------------------
:: Step 6: Initialize Local Ledger and Generate Default Identity Bundles
:: ----------------------------------------------------------------------------
echo.
echo [INFO] Initializing local ledger and creating user identity bundles...
call "%~dp0blockchain\setup.bat" --no-pause
if %errorlevel% neq 0 (
    echo [WARNING] Ledger setup had warnings, but core packages are installed.
)

:: Return to project root
cd /d "%~dp0"

echo.
echo ============================================================================
echo              SUCCESS: ALL DEPENDENCIES INSTALLED SUCCESSFULLY!
echo ============================================================================
echo.
echo The CIPHERTRACE application is fully configured and ready to run.
echo.
echo You can now launch the application at any time by running:
echo   Ciphertracelauncher.bat
echo.
if /i not "%~1"=="--no-pause" (
    echo Press any key to exit this installer...
    pause >nul
)
exit /b 0

:failure
cd /d "%~dp0"
echo.
echo ============================================================================
echo                INSTALLATION FAILED OR WAS INTERRUPTED
echo ============================================================================
echo Please inspect the error messages above and resolve any missing prerequisites.
echo.
if /i not "%~1"=="--no-pause" (
    echo Press any key to close this window...
    pause >nul
)
exit /b 1
