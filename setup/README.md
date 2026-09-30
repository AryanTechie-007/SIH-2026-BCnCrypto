# CIPHERTRACE — Dependency & Setup Guide

This folder installs what you need to run CIPHERTRACE from source on a teammate's
Windows computer. To just use the app, install it from a built installer instead
(see "Desktop app" in the main README).

---

## 🚀 Quick Setup (1-Click Windows)

Double-click `install_dependencies.bat` inside this folder (or run it from the terminal):
```cmd
cd setup
install_dependencies.bat
```
This automatically:
1. Installs the Python dependencies for the app's worker (`cryptography`, `pymupdf`, `mlkem`, etc.).
2. Installs the node modules for the UI (`frontend`), the ledger client (`blockchain\client`) and the desktop app (`desktop`).
3. Runs the post-quantum self-test.

---

## 🛠 Manual Installation

### 1. Prerequisites
- **Python 3.11+**: [https://www.python.org/downloads/](https://www.python.org/downloads/) *(Check "Add Python to PATH")*
- **Node.js LTS (v20+)**: [https://nodejs.org/](https://nodejs.org/)

### 2. Python Dependencies
```bash
pip install --find-links setup/wheels -r backend/requirements.txt
```

### 3. Node Dependencies
```bash
cd frontend && npm install && cd ..
cd blockchain/client && npm install && cd ../..
cd desktop && npm install && cd ..
```

---

## ▶️ Running the Application

```bash
cd desktop
npm start
```
This builds the UI and opens the CIPHERTRACE window. The app starts its Python
worker itself; there is no server or port to open.
