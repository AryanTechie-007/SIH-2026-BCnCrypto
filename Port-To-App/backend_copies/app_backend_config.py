"""
CIPHERTRACE Configuration Module (Mobile & Web Compatible).

Adapted copy for Port-To-App:
- Adds Android Emulator origins (10.0.2.2:8000, 10.0.2.2:5173, 10.0.2.2:3000)
- Preserves all original web settings, modes, and security invariants
- Keeps the website files untouched
"""

import os
from dataclasses import dataclass, field
from typing import List


def _bool_env(key: str, default: bool = False) -> bool:
    """Parse a boolean from an environment variable."""
    val = os.environ.get(key, "").strip().lower()
    if val in ("1", "true", "yes", "on"):
        return True
    if val in ("0", "false", "no", "off"):
        return False
    return default


@dataclass(frozen=True)
class CipherTraceSettings:
    """Immutable application settings loaded from environment at startup."""

    # ── Operational Mode ──────────────────────────────────────────────
    DEMO_MODE: bool = field(default_factory=lambda: _bool_env("DEMO_MODE", default=True))
    SECURE_MODE: bool = field(default_factory=lambda: _bool_env("SECURE_MODE", default=False))

    # ── Cryptographic Backend ─────────────────────────────────────────
    PQC_BACKEND: str = field(default_factory=lambda: os.environ.get("PQC_BACKEND", "auto"))

    # ── Watermark Secret ──────────────────────────────────────────────
    SYSTEM_SECRET: str = field(
        default_factory=lambda: os.environ.get("CIPHERTRACE_SYSTEM_SECRET", "")
    )

    # ── Blockchain / Ledger ───────────────────────────────────────────
    FABRIC_SAMPLES_PATH: str = field(
        default_factory=lambda: os.environ.get("FABRIC_SAMPLES", "")
    )
    FABRIC_CHANNEL: str = field(
        default_factory=lambda: os.environ.get("CHANNEL_NAME", "mychannel")
    )
    FABRIC_CHAINCODE: str = field(
        default_factory=lambda: os.environ.get("CC_NAME", "forensic")
    )

    # ── Authentication ────────────────────────────────────────────────
    JWT_SECRET_KEY: str = field(
        default_factory=lambda: os.environ.get(
            "JWT_SECRET_KEY", "DEMO_JWT_SECRET_NOT_FOR_PRODUCTION"
        )
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = field(
        default_factory=lambda: int(os.environ.get("JWT_EXPIRY_MINUTES", "1440"))  # 24h for mobile convenience
    )

    # ── CORS / Network (Mobile + Web) ─────────────────────────────────
    ALLOWED_ORIGINS: List[str] = field(
        default_factory=lambda: os.environ.get(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000,http://10.0.2.2:8000,http://10.0.2.2:5173"
        ).split(",")
    )

    # ── File Security ─────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = field(
        default_factory=lambda: int(os.environ.get("MAX_UPLOAD_SIZE_MB", "50"))
    )
    MAX_PDF_PAGES: int = field(
        default_factory=lambda: int(os.environ.get("MAX_PDF_PAGES", "100"))
    )

    # ── Keystore ──────────────────────────────────────────────────────
    KEYSTORE_DIR: str = field(
        default_factory=lambda: os.environ.get(
            "KEYSTORE_DIR",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", "keystores"))
        )
    )

    # ── Database ──────────────────────────────────────────────────────
    DB_PATH: str = field(
        default_factory=lambda: os.environ.get(
            "CIPHERTRACE_DB_PATH",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", "ciphertrace_v2.db"))
        )
    )

    def validate(self):
        """Validates configuration at startup."""
        errors = []
        if self.SECURE_MODE and self.DEMO_MODE:
            errors.append("SECURE_MODE and DEMO_MODE cannot both be true.")
        if self.SECURE_MODE and not self.SYSTEM_SECRET:
            errors.append("CIPHERTRACE_SYSTEM_SECRET is required in SECURE_MODE.")
        if self.SECURE_MODE and self.JWT_SECRET_KEY == "DEMO_JWT_SECRET_NOT_FOR_PRODUCTION":
            errors.append("JWT_SECRET_KEY must be set to a strong secret in SECURE_MODE.")
        if errors:
            raise RuntimeError("CIPHERTRACE Configuration Errors:\n" + "\n".join(f"  ✗ {e}" for e in errors))

    def get_system_secret_bytes(self) -> bytes:
        if self.SYSTEM_SECRET:
            return self.SYSTEM_SECRET.encode("utf-8")
        if self.SECURE_MODE:
            raise RuntimeError("CIPHERTRACE_SYSTEM_SECRET is required in SECURE_MODE but not set.")
        return b"DEMO_SECRET_NOT_FOR_PRODUCTION"

    def get_mode_label(self) -> str:
        if self.SECURE_MODE:
            return "SECURE (Air-Gapped)"
        if self.DEMO_MODE:
            return "DEMONSTRATION"
        return "DEVELOPMENT"


settings = CipherTraceSettings()
