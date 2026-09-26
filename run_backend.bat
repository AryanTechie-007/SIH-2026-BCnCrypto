@echo off
title CIPHERTRACE 2.0 - Backend API
cd /d "%~dp0backend"

:: Ensure Python is on PATH if installed in user directory
python --version >nul 2>&1
if %errorlevel% neq 0 (
    for %%P in (
        "%LOCALAPPDATA%\Programs\Python\Python313"
        "%LOCALAPPDATA%\Programs\Python\Python312"
        "%LOCALAPPDATA%\Programs\Python\Python311"
        "%LOCALAPPDATA%\Programs\Python\Python310"
        "C:\Program Files\Python313"
        "C:\Program Files\Python312"
        "C:\Program Files\Python311"
        "C:\Program Files\Python310"
    ) do (
        if exist "%%~fP\python.exe" (
            set "PATH=%%~fP;%%~fP\Scripts;!PATH!"
        )
    )
)

echo ========================================================
echo  CIPHERTRACE 2.0 - Backend API (Uvicorn / FastAPI)
echo  Working Dir: %CD%
echo  Endpoint:    http://127.0.0.1:8000
echo ========================================================
echo.

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Backend process terminated unexpectedly.
    pause
)
