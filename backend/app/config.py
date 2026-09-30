"""
CIPHERTRACE Configuration Module.

Centralizes all security-critical environment flags and operational modes.
Controls the behavioral boundary between:
  - DEMO_MODE:   demo secrets tolerated
  - SECURE_MODE: real secrets required, no demo fallbacks

Every path can be overridden by an environment variable. The desktop app sets
them so that a packaged install keeps its data in the OS app-data folder; when
unset (development) everything stays under backend/.

Usage:
    from app.config import settings
    if settings.DEMO_MODE:
        ...
"""

import os
import uuid
from dataclasses import dataclass, field


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

    # Fresh on every worker start; the UI signs out when it changes
    BOOT_ID: str = field(default_factory=lambda: uuid.uuid4().hex)

    # ── Operational Mode ──────────────────────────────────────────────
    # DEMO_MODE=true   → demo secrets tolerated
    # SECURE_MODE=true → CIPHERTRACE_SYSTEM_SECRET must be set
    # Both can be false (development mode).  Both true is contradictory.
    DEMO_MODE: bool = field(default_factory=lambda: _bool_env("DEMO_MODE", default=True))
    SECURE_MODE: bool = field(default_factory=lambda: _bool_env("SECURE_MODE", default=False))

    # ── Watermark Secret ──────────────────────────────────────────────
    # In SECURE_MODE this MUST be set via environment or keystore.
    # In DEMO_MODE a fallback is tolerated (but logged as warning).
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

    # ── Ledger Identity (blockchain/client/cli.js) ────────────────────
    # Every ledger call runs `node cli.js ...` with FABRIC_SAMPLES pointed at
    # the signed-in user's identity bundle.
    NODE_BIN: str = field(default_factory=lambda: os.environ.get("NODE_BIN", "node"))
    LEDGER_CLI_PATH: str = field(
        default_factory=lambda: os.environ.get(
            "LEDGER_CLI_PATH",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "blockchain", "client", "cli.js"))
        )
    )
    LEDGER_CLI_TIMEOUT_SECONDS: int = field(
        default_factory=lambda: int(os.environ.get("LEDGER_CLI_TIMEOUT_SECONDS", "120"))
    )
    # Unpacked identity bundles (certificate + Fabric private key), one folder per user.
    BUNDLES_DIR: str = field(
        default_factory=lambda: os.environ.get(
            "BUNDLES_DIR",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "bundles"))
        )
    )

    # ── Session ───────────────────────────────────────────────────────
    # How long the keystore passphrase given at sign-in stays in memory.
    SESSION_TTL_MINUTES: int = field(
        default_factory=lambda: int(os.environ.get("SESSION_TTL_MINUTES", "60"))
    )

    # ── File Security ─────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = field(
        default_factory=lambda: int(os.environ.get("MAX_UPLOAD_SIZE_MB", "50"))
    )
    # Uploaded documents and their .enc envelopes.
    UPLOAD_DIR: str = field(
        default_factory=lambda: os.environ.get(
            "UPLOAD_DIR",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
        )
    )
    # Watermarked copies, kept only until the user saves them.
    RETURNS_DIR: str = field(
        default_factory=lambda: os.environ.get(
            "RETURNS_DIR",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "returns"))
        )
    )

    # ── Keystore ──────────────────────────────────────────────────────
    KEYSTORE_DIR: str = field(
        default_factory=lambda: os.environ.get(
            "KEYSTORE_DIR",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "keystores"))
        )
    )

    # ── Database ──────────────────────────────────────────────────────
    DB_PATH: str = field(
        default_factory=lambda: os.environ.get(
            "CIPHERTRACE_DB_PATH",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ciphertrace.db"))
        )
    )

    def validate(self):
        """
        Validates configuration at startup.
        Raises RuntimeError for contradictory or insecure configurations.
        """
        errors = []

        if self.SECURE_MODE and self.DEMO_MODE:
            errors.append(
                "SECURE_MODE and DEMO_MODE cannot both be true. "
                "Set DEMO_MODE=false for secure operation."
            )

        if self.SECURE_MODE and not self.SYSTEM_SECRET:
            errors.append(
                "CIPHERTRACE_SYSTEM_SECRET is required in SECURE_MODE. "
                "Set it via environment variable or secure keystore."
            )

        if errors:
            raise RuntimeError(
                "CIPHERTRACE Configuration Errors:\n" +
                "\n".join(f"  ✗ {e}" for e in errors)
            )

    def get_system_secret_bytes(self) -> bytes:
        """Returns the system secret as bytes. Fails closed in SECURE_MODE if missing."""
        if self.SYSTEM_SECRET:
            return self.SYSTEM_SECRET.encode("utf-8")
        if self.SECURE_MODE:
            raise RuntimeError(
                "CIPHERTRACE_SYSTEM_SECRET is required in SECURE_MODE but not set."
            )
        # DEMO_MODE fallback — clearly not a real secret
        return b"DEMO_SECRET_NOT_FOR_PRODUCTION"

    def get_mode_label(self) -> str:
        """Human-readable mode label for UI display."""
        if self.SECURE_MODE:
            return "SECURE (Air-Gapped)"
        if self.DEMO_MODE:
            return "DEMONSTRATION"
        return "DEVELOPMENT"


# ── Singleton instance ────────────────────────────────────────────────
settings = CipherTraceSettings()
