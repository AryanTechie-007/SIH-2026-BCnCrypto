@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: CIPHERTRACE - Bundle Identity for Login (Windows)
:: ============================================================================

title CIPHERTRACE - Bundle Identity (Windows)

cd /d "%~dp0"
set "REPO_ROOT=%~dp0.."

if "%~1"=="" (
    echo Usage: bundle-identity.bat ^<username^> [Org1^|Org2] [output-zip]
    echo.
    echo Examples:
    echo   bundle-identity.bat charlie
    echo   bundle-identity.bat dave Org2
    echo.
    exit /b 1
)

set "PYTHON_EXE="
if exist "%REPO_ROOT%\backend\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%REPO_ROOT%\backend\.venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

call "%PYTHON_EXE%" "%~dp0scripts\manage_ledger.py" bundle-identity %*
exit /b %errorlevel%
