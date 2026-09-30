"""
CIPHERTRACE Ledger CLI Bridge
=============================
All ledger access goes through blockchain/client/cli.js. Each call runs it once
with FABRIC_SAMPLES pointed at the signed-in user's identity bundle, so every
request reaches the peer signed with that user's own Fabric key.

cli.js exit codes: 0 success (JSON on stdout), 1 error ("[kind] message" on
stderr), 2 not found.
"""

import asyncio
import json
import os
import re
import tempfile
from typing import Any, List, Optional

from app.config import settings


class LedgerCliError(Exception):
    """cli.js failed. `kind` mirrors LedgerError.kind in ledger.js:
    validation, duplicate, identity, notfound, policy, config, network, unknown."""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind


_ERROR_RE = re.compile(r"^\[(\w+)\]\s*(.*)$", re.DOTALL)


async def _run(bundle_dir: str, identity: str, *args: str) -> Optional[Any]:
    """Runs `node cli.js <args> <identity>`. Returns parsed stdout, or None on exit code 2."""
    env = os.environ.copy()
    env["FABRIC_SAMPLES"] = bundle_dir
    env["DEFAULT_IDENTITY"] = identity

    try:
        proc = await asyncio.create_subprocess_exec(
            settings.NODE_BIN, settings.LEDGER_CLI_PATH, *args, identity,
            cwd=os.path.dirname(settings.LEDGER_CLI_PATH),
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        raise LedgerCliError("config", f"Node.js executable '{settings.NODE_BIN}' was not found (set NODE_BIN)")

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=settings.LEDGER_CLI_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise LedgerCliError("network", f"Ledger did not respond within {settings.LEDGER_CLI_TIMEOUT_SECONDS}s")

    if proc.returncode == 2:
        return None

    if proc.returncode != 0:
        text = (stderr.decode("utf-8", errors="replace") or stdout.decode("utf-8", errors="replace")).strip()
        if "Cannot find module" in text:
            raise LedgerCliError("config", "Ledger client dependencies are missing: run `npm install` in blockchain/client")
        match = _ERROR_RE.match(text)
        if match:
            raise LedgerCliError(match.group(1), match.group(2).strip())
        raise LedgerCliError("unknown", text or f"cli.js exited with code {proc.returncode}")

    try:
        return json.loads(stdout.decode("utf-8"))
    except ValueError:
        raise LedgerCliError("unknown", f"Unexpected output from cli.js: {stdout[:200]!r}")


async def whoami(bundle_dir: str, identity: str) -> dict:
    """What the chaincode sees as the submitting identity: msp_id, common_name, username, is_admin."""
    return await _run(bundle_dir, identity, "whoami")


async def get_keys(bundle_dir: str, identity: str, username: str) -> Optional[dict]:
    """A user's key-registry record, or None if they have not published keys."""
    return await _run(bundle_dir, identity, "keys-get", username)


async def get_all_keys(bundle_dir: str, identity: str) -> List[dict]:
    """Every key-registry record — the recipient directory."""
    return await _run(bundle_dir, identity, "keys-all")


async def register_keys(bundle_dir: str, identity: str, keys: dict) -> dict:
    """Publishes the identity's own public keys. Write-once on the ledger."""
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "keys.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(keys, f)
        return await _run(bundle_dir, identity, "keys-register", path)
