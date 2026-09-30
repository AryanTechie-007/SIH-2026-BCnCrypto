"""
CIPHERTRACE Unlocked Sessions
=============================
Holds each signed-in session's keystore passphrase in process memory, so the
user types it once at sign-in rather than at every decryption.

The passphrase is never written anywhere: not the database, a file, or the
ledger. Entries end at sign-out, at token expiry, or when the process exits.
Private keys themselves are still only decrypted for the moment they are used.
"""

import secrets
import time
from typing import Dict, Optional, Tuple

# session id -> (user id, passphrase, expires at [unix seconds])
_sessions: Dict[str, Tuple[int, str, float]] = {}


def create(user_id: int, passphrase: str, ttl_seconds: int) -> str:
    _purge_expired()
    session_id = secrets.token_urlsafe(24)
    _sessions[session_id] = (user_id, passphrase, time.time() + ttl_seconds)
    return session_id


def passphrase_for(session_id: Optional[str], user_id: int) -> Optional[str]:
    """The session's passphrase, or None if the session is unknown, expired, or someone else's."""
    entry = _sessions.get(session_id or "")
    if entry is None:
        return None
    owner, passphrase, expires_at = entry
    if time.time() >= expires_at:
        _sessions.pop(session_id, None)
        return None
    return passphrase if owner == user_id else None


def end(session_id: Optional[str]) -> None:
    _sessions.pop(session_id or "", None)


def _purge_expired() -> None:
    now = time.time()
    for sid in [sid for sid, (_, _, exp) in _sessions.items() if now >= exp]:
        _sessions.pop(sid, None)
