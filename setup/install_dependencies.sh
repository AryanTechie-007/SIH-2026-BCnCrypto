#!/usr/bin/env bash
# ================================================================
#  CIPHERTRACE 2.0 - Automated Linux/macOS Dependency Installer
#  Zero-Manual Setup: Automated PATH Resolution & Dependencies
# ================================================================

set -e

# Change directory to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
PROJECT_ROOT="$(pwd)"

echo "================================================================"
echo " CIPHERTRACE 2.0 - Automated Linux/macOS Dependency Installer"
echo " Zero-Manual Setup: Automated PATH Resolution & Dependencies"
echo "================================================================"
echo ""

# Helper function to detect package manager and install packages
install_system_package() {
    PKG_DEBIAN="$1"
    PKG_REDHAT="$2"
    PKG_ARCH="$3"
    PKG_BREW="$4"

    if command -v apt-get &>/dev/null; then
        echo "[+] Using apt-get to install $PKG_DEBIAN..."
        if [ "$EUID" -ne 0 ] && command -v sudo &>/dev/null; then
            sudo apt-get update -qq && sudo apt-get install -y -qq $PKG_DEBIAN
        elif [ "$EUID" -eq 0 ]; then
            apt-get update -qq && apt-get install -y -qq $PKG_DEBIAN
        else
            echo "[!] Please run with sudo or install $PKG_DEBIAN manually."
        fi
    elif command -v dnf &>/dev/null; then
        echo "[+] Using dnf to install $PKG_REDHAT..."
        if [ "$EUID" -ne 0 ] && command -v sudo &>/dev/null; then
            sudo dnf install -y -q $PKG_REDHAT
        else
            dnf install -y -q $PKG_REDHAT
        fi
    elif command -v pacman &>/dev/null; then
        echo "[+] Using pacman to install $PKG_ARCH..."
        if [ "$EUID" -ne 0 ] && command -v sudo &>/dev/null; then
            sudo pacman -S --noconfirm --needed $PKG_ARCH
        else
            pacman -S --noconfirm --needed $PKG_ARCH
        fi
    elif command -v brew &>/dev/null; then
        echo "[+] Using Homebrew to install $PKG_BREW..."
        brew install $PKG_BREW
    fi
}

# Ensure ~/.local/bin and project paths are in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    export PATH="$HOME/.local/bin:$PATH"
    for RC in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [ -f "$RC" ] && ! grep -q 'HOME/.local/bin' "$RC"; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$RC"
        fi
    done
fi

# ------------------------------------------------------------------
# 1. PYTHON DETECTION & AUTOMATED INSTALLATION
# ------------------------------------------------------------------
echo "[1/5] Detecting and configuring Python 3 environment..."
if ! command -v python3 &>/dev/null; then
    echo "[!] Python 3 not detected. Attempting automated package installation..."
    install_system_package "python3 python3-pip python3-venv curl" "python3 python3-pip curl" "python python-pip curl" "python"
fi

if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python 3 could not be installed automatically. Please install Python 3.11+."
    exit 1
fi
echo "[OK] Found $(python3 --version)"

# ------------------------------------------------------------------
# 2. PYTHON VIRTUAL ENVIRONMENT & CRYPTO PACKAGES
# ------------------------------------------------------------------
echo ""
echo "[2/5] Initializing Python virtual environment & backend packages..."

# Ensure pip & venv module
if ! python3 -m pip --version &>/dev/null; then
    echo "[+] Installing pip package..."
    install_system_package "python3-pip python3-venv" "python3-pip" "python-pip" "python"
fi

# Create dedicated virtual environment if missing
if [ ! -d "$PROJECT_ROOT/.venv" ]; then
    echo "[+] Creating isolated virtual environment in .venv..."
    python3 -m venv "$PROJECT_ROOT/.venv" || true
fi

if [ -f "$PROJECT_ROOT/.venv/bin/activate" ]; then
    source "$PROJECT_ROOT/.venv/bin/activate"
    echo "[OK] Project virtual environment active."
    export PATH="$PROJECT_ROOT/.venv/bin:$PATH"
fi

python3 -m pip install --upgrade pip --quiet 2>/dev/null || true

echo "[*] Installing backend dependencies from requirements.txt..."
python3 -m pip install -r "$PROJECT_ROOT/backend/requirements.txt" || {
    echo "[WARNING] Retrying install with individual packages..."
    python3 -m pip install fastapi uvicorn cryptography pymupdf Pillow numpy scipy reedsolo python-multipart sqlalchemy greenlet aiosqlite opencv-python-headless dilithium-py argon2-cffi pyjwt customtkinter requests mlkem jinja2 python-pptx trafilatura python-docx
}

echo "[*] Validating NIST Post-Quantum Cryptography Engine..."
python3 -c "import sys; sys.path.insert(0, 'backend'); from app.services.crypto_engine import CryptoEngine; CryptoEngine.verify_pqc_availability(); print('[+] NIST FIPS 203 & 204 PQC Engine: ONLINE')"

# ------------------------------------------------------------------
# 3. NODE.JS & NPM DETECTION & AUTOMATED INSTALLATION
# ------------------------------------------------------------------
echo ""
echo "[3/5] Checking Node.js and NPM..."

if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "[!] Node.js or NPM not found. Attempting automated installation..."
    if command -v apt-get &>/dev/null; then
        echo "[+] Configuring NodeSource Node.js LTS repository..."
        if [ "$EUID" -ne 0 ] && command -v sudo &>/dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y -qq nodejs
        else
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y -qq nodejs
        fi
    elif command -v dnf &>/dev/null; then
        if [ "$EUID" -ne 0 ] && command -v sudo &>/dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo dnf install -y -q nodejs
        else
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
            dnf install -y -q nodejs
        fi
    else
        install_system_package "nodejs npm" "nodejs npm" "nodejs npm" "node"
    fi
fi

if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "[ERROR] Node.js/NPM could not be installed automatically. Please install Node.js LTS from https://nodejs.org/"
    exit 1
fi

echo "[OK] Node.js: $(node --version)"
echo "[OK] NPM:     $(npm --version)"

# ------------------------------------------------------------------
# 4. FRONTEND NPM PACKAGES
# ------------------------------------------------------------------
echo ""
echo "[4/5] Installing Frontend React & Vite dependencies..."
cd "$PROJECT_ROOT/frontend"
npm install --quiet || npm install
echo "[*] Building frontend production bundle..."
npm run build || echo "[WARNING] Build returned non-zero code. Dev server will run during demo."
cd "$PROJECT_ROOT"

# ------------------------------------------------------------------
# 5. DISTRIBUTED LEDGER & BLOCKCHAIN PRECHECK
# ------------------------------------------------------------------
echo ""
echo "[5/5] Checking Distributed Ledger & Blockchain prerequisites (Stream C DLT)..."
if command -v docker &>/dev/null; then
    echo "[OK] Docker Engine detected: $(docker --version)"
    if [ -n "$FABRIC_SAMPLES" ] && [ -d "$FABRIC_SAMPLES" ]; then
        echo "[OK] Hyperledger Fabric path configured: $FABRIC_SAMPLES"
    else
        echo "[INFO] FABRIC_SAMPLES not set. Using built-in High-Assurance Cryptographic Merkle Ledger."
    fi
else
    echo "[INFO] Docker not detected. CIPHERTRACE will run using its built-in High-Assurance Cryptographic Merkle Ledger"
    echo "       (100% offline, FIPS 202 SHA3-256 hash-chained blocks, zero external overhead)."
fi

echo ""
echo "================================================================"
echo " ALL DEPENDENCIES & PATHS FULLY CONFIGURED!"
echo " Zero manual action required."
echo ""
echo " To launch the platform on Linux/macOS:"
echo "   ./start_demo.sh"
echo "================================================================"
