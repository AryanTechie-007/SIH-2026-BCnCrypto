"""
CIPHERTRACE Worker Methods
==========================
Handlers register here with @method("area.action"). The worker (app/worker.py)
calls them by name with the JSON params the app sent, and adds what the handler
asks for in its signature:

    db                  a database session for this call
    current_user        the signed-in User (401 when nobody is signed in)
    session_passphrase  the keystore passphrase given at sign-in

The app has one signed-in user at a time. Their passphrase stays in
session_store's memory until sign-out, session expiry, or the worker exiting.
"""

import inspect
import json
from datetime import datetime
from typing import Any, Callable, Dict, Optional

from pydantic import BaseModel, ValidationError

from app.database import AsyncSessionLocal
from app.errors import ApiError
from app.models.database import User
from app.services import session_store

INJECTED = ("db", "current_user", "session_passphrase")

METHODS: Dict[str, Callable] = {}

_session_id: Optional[str] = None
_session_user_id: Optional[int] = None


def method(name: str):
    def register(fn: Callable) -> Callable:
        METHODS[name] = fn
        return fn
    return register


def sign_in(session_id: str, user_id: int) -> None:
    """Makes this the app's session, ending any previous one."""
    global _session_id, _session_user_id
    sign_out()
    _session_id, _session_user_id = session_id, user_id


def sign_out() -> None:
    global _session_id, _session_user_id
    session_store.end(_session_id)
    _session_id, _session_user_id = None, None


async def _signed_in(db) -> tuple:
    """(user, passphrase) for the current session, or 401/403 as the old token check did."""
    if _session_id is None or _session_user_id is None:
        raise ApiError(401, "Not signed in")
    passphrase = session_store.passphrase_for(_session_id, _session_user_id)
    if passphrase is None:
        sign_out()
        raise ApiError(401, "Your session has expired. Sign in again.")

    user = await db.get(User, _session_user_id)
    if not user:
        sign_out()
        raise ApiError(401, "User account no longer exists")
    if user.status != "ACTIVE":
        raise ApiError(403, "User account is deactivated")
    if user.key_status == "REVOKED":
        raise ApiError(403, "User cryptographic key has been revoked")
    return user, passphrase


async def call(name: Any, params: Any) -> Any:
    fn = METHODS.get(name) if isinstance(name, str) else None
    if fn is None:
        raise ApiError(404, f"Unknown method: {name!r}")
    if not isinstance(params, dict):
        raise ApiError(400, "params must be an object")
    if any(key in params for key in INJECTED):
        raise ApiError(400, f"params may not set {', '.join(INJECTED)}")

    wanted = inspect.signature(fn).parameters
    async with AsyncSessionLocal() as db:
        kwargs = dict(params)
        if "db" in wanted:
            kwargs["db"] = db
        if "current_user" in wanted or "session_passphrase" in wanted:
            user, passphrase = await _signed_in(db)
            if "current_user" in wanted:
                kwargs["current_user"] = user
            if "session_passphrase" in wanted:
                kwargs["session_passphrase"] = passphrase
        try:
            inspect.signature(fn).bind(**kwargs)
        except TypeError as e:
            raise ApiError(400, f"Bad params for {name}: {e}")
        try:
            return await fn(**kwargs)
        except ValidationError as e:
            raise ApiError(400, str(e))


def to_json(value: Any) -> str:
    """Serialises a handler's result: pydantic models, datetimes and bytes included."""
    def encode(o: Any) -> Any:
        if isinstance(o, BaseModel):
            return o.model_dump(mode="json")
        if isinstance(o, datetime):
            return o.isoformat()
        if isinstance(o, bytes):
            return o.hex()
        raise TypeError(f"{type(o).__name__} is not JSON serialisable")
    return json.dumps(value, default=encode)
