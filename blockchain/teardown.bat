@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: CIPHERTRACE - Reset Local Ledger (Windows)
:: ============================================================================

title CIPHERTRACE - Reset Ledger (Windows)

cd /d "%~dp0"
set "REPO_ROOT=%~dp0.."

set "PYTHON_EXE="
if exist "%REPO_ROOT%\backend\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%REPO_ROOT%\backend\.venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

call "%PYTHON_EXE%" "%~dp0scripts\manage_ledger.py" teardown
exit /b %errorlevel%
