@echo off
title CIPHERTRACE 2.0 - Frontend UI
cd /d "%~dp0frontend"

:: Ensure Node is on PATH if installed in user directory
call node -v >nul 2>&1
if %errorlevel% neq 0 (
    for %%N in (
        "C:\Program Files\nodejs"
        "%LOCALAPPDATA%\Programs\nodejs"
        "%ProgramFiles%\nodejs"
        "%ProgramFiles(x86)%\nodejs"
    ) do (
        if exist "%%~fN\node.exe" (
            set "PATH=%%~fN;!PATH!"
        )
    )
)

echo ========================================================
echo  CIPHERTRACE 2.0 - Frontend UI (React / Vite)
echo  Working Dir: %CD%
echo  Endpoint:    http://127.0.0.1:5173
echo ========================================================
echo.

call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Frontend process terminated unexpectedly.
    pause
)
