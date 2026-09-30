# PyInstaller spec for the desktop app's Python worker.
#
#   cd backend && .venv/bin/python -m PyInstaller --noconfirm --clean ciphertrace-worker.spec
#
# Output: dist/ciphertrace-worker/ (a folder, not a single file: a one-file
# build unpacks itself on every launch, which is slow with numpy, scipy and
# OpenCV). desktop/package.json copies it into the app as resources/worker/.
# PyInstaller cannot cross-compile: build on the OS you are packaging for.
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = (
    # Registered by name at runtime, so static analysis can miss them.
    collect_submodules("app")
    + ["aiosqlite", "sqlalchemy.dialects.sqlite.aiosqlite"]
    # Pure-Python ML-KEM / ML-DSA fallbacks import parts of themselves lazily.
    + collect_submodules("mlkem")
    + collect_submodules("dilithium_py")
)

a = Analysis(
    ["run_worker.py"],
    pathex=["."],
    hiddenimports=hiddenimports,
    excludes=["tkinter", "matplotlib", "IPython", "pytest", "fastapi", "uvicorn"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="ciphertrace-worker",
    console=True,  # stdin/stdout are its channel to the app; Electron starts it hidden
    upx=False,
)

coll = COLLECT(exe, a.binaries, a.datas, name="ciphertrace-worker", upx=False)
