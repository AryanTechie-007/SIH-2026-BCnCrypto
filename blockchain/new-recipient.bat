@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: CIPHERTRACE - Create New Recipient Identity (Windows)
:: ============================================================================

title CIPHERTRACE - Create Recipient (Windows)

cd /d "%~dp0"
set "REPO_ROOT=%~dp0.."

if "%~1"=="" (
    echo Usage: new-recipient.bat ^<username^> [Org1^|Org2] [--role client^|admin]
    echo.
    echo Examples:
    echo   new-recipient.bat charlie
    echo   new-recipient.bat dave Org2
    echo   new-recipient.bat auditor Org1 --role admin
    echo.
    exit /b 1
)

set "PYTHON_EXE="
if exist "%REPO_ROOT%\backend\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%REPO_ROOT%\backend\.venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

call "%PYTHON_EXE%" "%~dp0scripts\manage_ledger.py" new-recipient %*
exit /b %errorlevel%
