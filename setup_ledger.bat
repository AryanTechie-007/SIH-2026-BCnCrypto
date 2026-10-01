@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: CIPHERTRACE - Root Ledger Setup Shortcut
:: ============================================================================

cd /d "%~dp0"
call "%~dp0blockchain\setup.bat" %*
exit /b %errorlevel%
