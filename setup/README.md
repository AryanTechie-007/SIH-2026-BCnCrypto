# CIPHERTRACE 2.0 — Dependency & Setup Guide

This folder contains everything needed to install the dependencies for CIPHERTRACE 2.0 on a teammate's computer.

---

## 🚀 Quick Setup (1-Click Windows)

Double-click `install_dependencies.bat` inside this folder (or run it from the terminal):
```cmd
cd setup
install_dependencies.bat
```
This automatically:
1. Installs all Python backend dependencies (`fastapi`, `uvicorn`, `cryptography`, `pymupdf`, etc.).
2. Installs all Frontend React / Vite node modules (`npm install`).
3. Verifies system readiness.

---

## 🛠 Manual Installation

### 1. Prerequisites
- **Python 3.11+**: [https://www.python.org/downloads/](https://www.python.org/downloads/) *(Check "Add Python to PATH")*
- **Node.js LTS (v18+)**: [https://nodejs.org/](https://nodejs.org/)

### 2. Backend Dependencies
```bash
pip install -r backend/requirements.txt
```

### 3. Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

---

## ▶️ Running the Application

Double-click `start_demo.bat` in the root folder:
- **Local Web UI**: `http://127.0.0.1:5173`
- **FastAPI Backend**: `http://127.0.0.1:8000/docs`
- **LAN Access**: Accessible from other laptops on the same Wi-Fi using your IP address (e.g. `http://192.168.x.x:5173`).
