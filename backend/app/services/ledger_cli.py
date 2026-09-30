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


async def _run(bundle_dir: str, identity: str, *args: str, label: str = "") -> Optional[Any]:
    """
    Runs `node cli.js <args> <identity>`. Returns parsed stdout, or None on exit code 2.
    `label` is a line cli.js prints before the JSON (e.g. "committed:" for submit).
    """
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

    text = stdout.decode("utf-8").strip()
    if label and text.startswith(label):
        text = text[len(label):]
    try:
        return json.loads(text)
    except ValueError:
        raise LedgerCliError("unknown", f"Unexpected output from cli.js: {text[:200]!r}")


async def _run_with_file(bundle_dir: str, identity: str, command: str, payload: dict, label: str = "") -> Any:
    """For commands that take their JSON input as a file path."""
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "payload.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        return await _run(bundle_dir, identity, command, path, label=label)


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
    return await _run_with_file(bundle_dir, identity, "keys-register", keys)


async def submit_record(bundle_dir: str, identity: str, record: dict) -> dict:
    """
    Writes a decryption record to the forensic chaincode. Returns only once the
    transaction has committed; the identity must be the record's recipient_id.
    """
    return await _run_with_file(bundle_dir, identity, "submit", record, label="committed:")


async def query_record(bundle_dir: str, identity: str, watermark_id: str) -> Optional[dict]:
    """The forensic chaincode's decryption record for a watermark ID, or None."""
    return await _run(bundle_dir, identity, "query", watermark_id)


async def all_records(bundle_dir: str, identity: str) -> List[dict]:
    """Every decryption record on the ledger."""
    return await _run(bundle_dir, identity, "all") or []
