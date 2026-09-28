@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0.."
set "PROJECT_ROOT=%cd%"

echo ================================================================
echo  CIPHERTRACE / QUANTUMGUARD - Dependency and Setup Uninstaller
echo  Smart India Hackathon 2026 - Clean Slate Test Utility
echo ================================================================
echo.
echo This script will reset your environment to a clean state so you
echo can verify that start_demo.bat and install_dependencies.bat
echo properly detect, download, and install all dependencies from scratch.
echo.
echo Actions to be performed:
echo  1. Stop any running backend (port 8000) or frontend (port 5173) processes
echo  2. Remove frontend\node_modules and frontend\dist
echo  3. Uninstall Python packages from requirements.txt
echo  4. Clean Python cache (__pycache__, *.pyc, .pytest_cache)
echo  5. Clear temporary uploads and runtime artifacts
echo.
set /p CONFIRM="Proceed with complete uninstallation? (Y/N) [default: Y]: "
if /i "%CONFIRM%"=="N" (
    echo [INFO] Uninstallation cancelled by user.
    pause
    exit /b 0
)

echo.
REM ------------------------------------------------------------------
REM 1. TERMINATE RUNNING PROCESSES (PORTS 8000 AND 5173)
REM ------------------------------------------------------------------
echo [1/5] Stopping any active services on ports 8000 and 5173...
for %%p in (8000 5173) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":%%p\>"' ) do (
        if not "%%a"=="0" (
            echo   Killing process PID %%a on port %%p...
            taskkill /F /T /PID %%a >nul 2>&1
        )
    )
)
powershell -Command "Get-NetTCPConnection -LocalPort 8000, 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo [OK] Ports 8000 and 5173 cleared.

REM ------------------------------------------------------------------
REM 2. REMOVE FRONTEND NODE_MODULES AND DIST
REM ------------------------------------------------------------------
echo.
echo [2/5] Removing frontend node_modules and build artifacts...
if exist "%PROJECT_ROOT%\frontend\node_modules" (
    echo   Deleting frontend\node_modules (this may take a few moments)...
    rmdir /s /q "%PROJECT_ROOT%\frontend\node_modules"
    if exist "%PROJECT_ROOT%\frontend\node_modules" (
        powershell -Command "Remove-Item -Recurse -Force '%PROJECT_ROOT%\frontend\node_modules' -ErrorAction SilentlyContinue" >nul 2>&1
    )
    echo [OK] frontend\node_modules removed.
) else (
    echo [INFO] frontend\node_modules was already absent.
)

if exist "%PROJECT_ROOT%\frontend\dist" (
    rmdir /s /q "%PROJECT_ROOT%\frontend\dist"
    echo [OK] frontend\dist removed.
)

REM ------------------------------------------------------------------
REM 3. UNINSTALL PYTHON PACKAGES
REM ------------------------------------------------------------------
echo.
echo [3/5] Uninstalling Python dependencies...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   Uninstalling core dependencies via pip...
    python -m pip uninstall -y -r "%PROJECT_ROOT%\requirements.txt" >nul 2>&1
    python -m pip uninstall -y -r "%PROJECT_ROOT%\backend\requirements.txt" >nul 2>&1
    python -m pip uninstall -y fastapi uvicorn cryptography pymupdf Pillow numpy scipy reedsolo python-multipart sqlalchemy greenlet aiosqlite opencv-python-headless customtkinter requests darkdetect mlkem dilithium-py argon2-cffi pyjwt oqs liboqs-python >nul 2>&1
    echo [OK] Python packages uninstalled.
) else (
    echo [WARNING] Python not detected in PATH. Skipping pip uninstall.
)

REM ------------------------------------------------------------------
REM 4. CLEAN PYTHON CACHES AND BUILD ARTIFACTS
REM ------------------------------------------------------------------
echo.
echo [4/5] Cleaning Python bytecode caches and pytest cache...
for /d /r "%PROJECT_ROOT%" %%d in (__pycache__) do (
    if exist "%%d" rmdir /s /q "%%d" >nul 2>&1
)
for /d /r "%PROJECT_ROOT%" %%d in (.pytest_cache) do (
    if exist "%%d" rmdir /s /q "%%d" >nul 2>&1
)
del /s /q "%PROJECT_ROOT%\*.pyc" >nul 2>&1
del /s /q "%PROJECT_ROOT%\*.pyo" >nul 2>&1
echo [OK] Python caches cleared.

REM ------------------------------------------------------------------
REM 5. CLEAR TEMPORARY UPLOADS AND RUNTIME ARTIFACTS
REM ------------------------------------------------------------------
echo.
echo [5/5] Cleaning temporary runtime forensic uploads...
if exist "%PROJECT_ROOT%\backend\uploads\forensic_temp" (
    rmdir /s /q "%PROJECT_ROOT%\backend\uploads\forensic_temp" >nul 2>&1
    mkdir "%PROJECT_ROOT%\backend\uploads\forensic_temp" >nul 2>&1
)
echo [OK] Temporary uploads reset.

echo.
echo ================================================================
echo  UNINSTALLATION COMPLETE! ENVIRONMENT RESET TO CLEAN SLATE
echo ================================================================
echo.
echo Verification:
if not exist "%PROJECT_ROOT%\frontend\node_modules\" (
    echo  [x] frontend\node_modules: REMOVED (will trigger npm install)
) else (
    echo  [!] frontend\node_modules: Still present
)

python -c "import fastapi" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [x] Python packages:       UNINSTALLED (will trigger pip install)
) else (
    echo  [INFO] Some Python packages still present in global environment
)

echo.
echo  You are now ready to test the automated full install!
echo  Run: start_demo.bat (or install_dependencies.bat)
echo ================================================================
echo.
pause
