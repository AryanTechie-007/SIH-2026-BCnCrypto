@echo off
setlocal

:: ============================================================================
:: CIPHERTRACE - User Account & Identity Bundle Creation Tool
:: ============================================================================

title CIPHERTRACE - Account Provisioning Tool

cd /d "%~dp0"

set "PYTHON_EXE=%~dp0backend\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_EXE=python"
    ) else (
        echo [ERROR] Python environment was not found.
        echo Please run install_dependencies.bat first.
        pause
        exit /b 1
    )
)

call "%PYTHON_EXE%" "%~dp0blockchain\scripts\create_account.py" %*
set "EXIT_CODE=%errorlevel%"

if "%~1"=="" (
    pause
)

exit /b %EXIT_CODE%
