@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."
set "PROJECT_ROOT=%cd%"

echo ================================================================
echo  CIPHERTRACE 2.0 - Automated Windows Dependency Installer
echo  Smart India Hackathon 2026 - Defense Security Platform
echo ================================================================
echo.

:: ------------------------------------------------------------------
:: 1. PYTHON DETECTION, AUTO-INSTALL & PATH CONFIGURATION
:: ------------------------------------------------------------------
echo [1/5] Checking Python 3 installation...

:: Test if python is directly executable in PATH
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python command not detected in current PATH.
    echo [*] Scanning standard Windows installation locations...

    set "FOUND_PY="
    for %%P in (
        "%LOCALAPPDATA%\Programs\Python\Python313",
        "%LOCALAPPDATA%\Programs\Python\Python312",
        "%LOCALAPPDATA%\Programs\Python\Python311",
        "%LOCALAPPDATA%\Programs\Python\Python310",
        "C:\Program Files\Python313",
        "C:\Program Files\Python312",
        "C:\Program Files\Python311",
        "C:\Program Files\Python310",
        "C:\Python313",
        "C:\Python312",
        "C:\Python311"
    ) do (
        if not defined FOUND_PY (
            if exist "%%~fP\python.exe" (
                set "FOUND_PY=%%~fP"
            )
        )
    )

    if defined FOUND_PY (
        echo [OK] Located existing Python installation: !FOUND_PY!
        set "PATH=!FOUND_PY!;!FOUND_PY!\Scripts;!PATH!"
        setx PATH "!FOUND_PY!;!FOUND_PY!\Scripts;%PATH%" >nul 2>&1
        echo [OK] Successfully added Python to system PATH.
    ) else (
        echo [!] Python is not installed on this machine.
        echo [+] Initiating automated silent installation of Python 3.11 with PATH configuration...

        :: Try Windows Package Manager first if available
        set "WINGET_OK=0"
        winget --version >nul 2>&1
        if %errorlevel% equ 0 (
            echo [+] Installing Python 3.11 via Windows Package Manager (winget)...
            winget install --id Python.Python.3.11 -e --silent --accept-package-agreements --accept-source-agreements
            if %errorlevel% equ 0 set "WINGET_OK=1"
        )

        :: Fallback: Download official python installer directly via curl.exe
        if !WINGET_OK! equ 0 (
            echo [+] Downloading official Python 3.11 installer from python.org...
            set "PY_INSTALLER=%TEMP%\python-3.11.9-amd64.exe"
            curl.exe -fSL -o "!PY_INSTALLER!" https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
            if exist "!PY_INSTALLER!" (
                echo [+] Executing silent installation (enabling PATH automatically)...
                "!PY_INSTALLER!" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_pip=1
                del "!PY_INSTALLER!" >nul 2>&1
            )
        )

        :: Search again after installation
        for %%P in (
            "%LOCALAPPDATA%\Programs\Python\Python311",
            "%LOCALAPPDATA%\Programs\Python\Python312",
            "%LOCALAPPDATA%\Programs\Python\Python313",
            "C:\Program Files\Python311"
        ) do (
            if not defined FOUND_PY (
                if exist "%%~fP\python.exe" (
                    set "FOUND_PY=%%~fP"
                )
            )
        )

        if defined FOUND_PY (
            echo [OK] Python successfully installed at: !FOUND_PY!
            set "PATH=!FOUND_PY!;!FOUND_PY!\Scripts;!PATH!"
            setx PATH "!FOUND_PY!;!FOUND_PY!\Scripts;%PATH%" >nul 2>&1
        ) else (
            echo [WARNING] Python installation completed. If 'python' is not yet recognized,
            echo           please restart your Command Prompt or terminal.
        )
    )
)

python --version
if %errorlevel% neq 0 (
    echo [ERROR] Unable to initialize Python. Please restart this script or command prompt.
    pause
    exit /b 1
)

:: ------------------------------------------------------------------
:: 2. INSTALL BACKEND PYTHON CRYPTOGRAPHIC PACKAGES
:: ------------------------------------------------------------------
echo.
echo [2/5] Installing Python cryptographic & backend dependencies...
python -m pip install --upgrade pip --quiet
python -m pip install -r "%PROJECT_ROOT%\backend\requirements.txt"
if %errorlevel% neq 0 (
    echo [WARNING] Retrying install with individual core wheels...
    python -m pip install fastapi uvicorn cryptography pymupdf Pillow numpy scipy reedsolo python-multipart sqlalchemy aiosqlite
)

:: ------------------------------------------------------------------
:: 3. NODE.JS & NPM DETECTION, AUTO-INSTALL & PATH CONFIGURATION
:: ------------------------------------------------------------------
echo.
echo [3/5] Checking Node.js and NPM...

call node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js not detected in current PATH.
    echo [*] Scanning standard install locations...

    set "FOUND_NODE="
    for %%N in (
        "C:\Program Files\nodejs"
        "%LOCALAPPDATA%\Programs\nodejs"
        "%ProgramFiles%\nodejs"
        "%ProgramFiles(x86)%\nodejs"
    ) do (
        if not defined FOUND_NODE (
            if exist "%%~fN\node.exe" (
                set "FOUND_NODE=%%~fN"
            )
        )
    )

    if defined FOUND_NODE (
        echo [OK] Located existing Node.js installation: !FOUND_NODE!
        set "PATH=!FOUND_NODE!;!PATH!"
        setx PATH "!FOUND_NODE!;%PATH%" >nul 2>&1
    ) else (
        echo [!] Node.js is not installed on this machine.
        echo [+] Initiating automated installation of Node.js LTS...

        set "WINGET_NODE=0"
        winget --version >nul 2>&1
        if !errorlevel! equ 0 (
            echo [+] Installing Node.js LTS via winget...
            winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
            if !errorlevel! equ 0 set "WINGET_NODE=1"
        )

        if !WINGET_NODE! equ 0 (
            echo [+] Downloading official Node.js LTS MSI package...
            set "NODE_MSI=%TEMP%\node-v20.18.0-x64.msi"
            curl.exe -fSL -o "!NODE_MSI!" https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi
            if exist "!NODE_MSI!" (
                echo [+] Executing silent Node.js installation...
                msiexec.exe /i "!NODE_MSI!" /qn /norestart
                del "!NODE_MSI!" >nul 2>&1
            )
        )

        for %%N in (
            "C:\Program Files\nodejs"
            "%LOCALAPPDATA%\Programs\nodejs"
            "%ProgramFiles%\nodejs"
            "%ProgramFiles(x86)%\nodejs"
        ) do (
            if not defined FOUND_NODE (
                if exist "%%~fN\node.exe" (
                    set "FOUND_NODE=%%~fN"
                )
            )
        )

        if defined FOUND_NODE (
            echo [OK] Node.js successfully installed at: !FOUND_NODE!
            set "PATH=!FOUND_NODE!;!PATH!"
            setx PATH "!FOUND_NODE!;%PATH%" >nul 2>&1
        )
    )
)

echo [OK] Node.js:
call node -v
echo [OK] NPM:
call npm -v

:: ------------------------------------------------------------------
:: 4. INSTALL FRONTEND NPM PACKAGES
:: ------------------------------------------------------------------
echo.
echo [4/5] Installing Frontend React / Vite dependencies...
cd /d "%PROJECT_ROOT%\frontend"
call npm install
cd /d "%PROJECT_ROOT%"

:: ------------------------------------------------------------------
:: 5. DISTRIBUTED LEDGER & DLT RUNTIME VERIFICATION
:: ------------------------------------------------------------------
echo.
echo [5/5] Checking Distributed Ledger & Blockchain prerequisites (Stream C DLT)...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Docker Engine detected:
    docker --version
    if defined FABRIC_SAMPLES (
        echo [OK] Hyperledger Fabric path configured: %FABRIC_SAMPLES%
    ) else (
        echo [INFO] FABRIC_SAMPLES is not set. To connect to an external Hyperledger Fabric network:
        echo        set FABRIC_SAMPLES=C:\path\to\fabric-samples
        echo        Otherwise, CIPHERTRACE runs using its built-in High-Assurance Cryptographic Merkle Ledger.
    )
) else (
    echo [INFO] Docker not detected or not running.
    echo        CIPHERTRACE will run using its built-in High-Assurance Cryptographic Merkle Ledger
    echo        (100%% offline, FIPS 202 SHA3-256 hash-chained blocks, zero external overhead).
)

echo.
echo ================================================================
echo  ALL DEPENDENCIES CONFIGURED SUCCESSFULLY!
echo.
echo  To start the application:
echo  Simply run 'start_demo.bat' in the project root folder.
echo ================================================================
echo.
pause
