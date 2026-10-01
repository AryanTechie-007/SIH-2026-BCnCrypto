@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: CIPHERTRACE - Ledger Smoke Test (Windows)
:: ============================================================================

title CIPHERTRACE - Ledger Smoke Test (Windows)

cd /d "%~dp0"
set "REPO_ROOT=%~dp0.."

set "PYTHON_EXE="
if exist "%REPO_ROOT%\backend\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%REPO_ROOT%\backend\.venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

call "%PYTHON_EXE%" "%~dp0scripts\manage_ledger.py" smoke-test
if /i not "%~1"=="--no-pause" (
    echo.
    pause
)
exit /b %errorlevel%
