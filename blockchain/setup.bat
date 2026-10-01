@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: CIPHERTRACE - Local Ledger Setup for Windows
:: ============================================================================

title CIPHERTRACE - Ledger Setup (Windows)

:: Change working directory to blockchain folder
cd /d "%~dp0"
set "REPO_ROOT=%~dp0.."

echo ============================================================================
echo                    CIPHERTRACE LOCAL LEDGER SETUP (WINDOWS)
echo       Post-Quantum Confidential Document Sharing with Leak Attribution
echo ============================================================================
echo.

:: ----------------------------------------------------------------------------
:: 1. Resolve Python
:: ----------------------------------------------------------------------------
set "PYTHON_EXE="

if exist "%REPO_ROOT%\backend\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%REPO_ROOT%\backend\.venv\Scripts\python.exe"
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_EXE=python"
    )
)

if not defined PYTHON_EXE (
    echo [ERROR] Python was not found!
    echo Please run install_dependencies.bat from the repository root first.
    echo.
    pause
    exit /b 1
)

:: ----------------------------------------------------------------------------
:: 2. Ensure Client Dependencies are Installed
:: ----------------------------------------------------------------------------
if not exist "%~dp0client\node_modules\" (
    echo [INFO] Installing ledger client dependencies...
    cd /d "%~dp0client"
    call npm install
    cd /d "%~dp0"
)

:: ----------------------------------------------------------------------------
:: 3. Execute Ledger and Identity Setup
:: ----------------------------------------------------------------------------
call "%PYTHON_EXE%" "%~dp0scripts\manage_ledger.py" setup
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Ledger initialization failed!
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo                      LEDGER SETUP COMPLETE!
echo ============================================================================
echo.
echo Ready-to-use identity bundles have been created in:
echo   blockchain\bundles\
echo.
echo You can log into CIPHERTRACE with:
echo   - Username: alice
echo   - Bundle:   blockchain\bundles\alice.zip
echo.
echo   or
echo   - Username: bob
echo   - Bundle:   blockchain\bundles\bob.zip
echo.
if /i not "%~1"=="--no-pause" (
    pause
)
exit /b 0
