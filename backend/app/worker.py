"""
CIPHERTRACE Worker
==================
The desktop app (desktop/main.js) starts this process once and talks to it over
stdin/stdout, one JSON object per line:

    request  {"id": 7, "method": "documents.upload", "params": {"path": "/.../a.pdf"}}
    reply    {"id": 7, "ok": true, "result": ...}
             {"id": 7, "ok": false, "status": 428, "detail": ...}

Before any reply it prints {"event": "ready", "boot_id": ...} once the
post-quantum self-test has passed and the database is ready and wiped (see
services/local_data.py), or
{"event": "fatal", "detail": ...} and exits if either fails. Requests run
concurrently. The worker exits when stdin closes.

stdout carries only these lines: logging, print() and native libraries all
write to stderr instead.
"""

import asyncio
import json
import logging
import os
import sys
import threading

logger = logging.getLogger("ciphertrace.worker")


def _claim_stdout():
    """Keeps the real stdout for replies and points fd 1 and sys.stdout at stderr."""
    reply_fd = os.dup(1)
    os.dup2(2, 1)
    sys.stdout = sys.stderr
    return os.fdopen(reply_fd, "w", encoding="utf-8", newline="\n")


async def _serve(out) -> int:
    # Imported here so that anything printed at import time lands on stderr.
    from app import handlers, rpc  # noqa: F401  (importing handlers registers their methods)
    from app.config import settings
    from app.database import init_db
    from app.errors import ApiError
    from app.services import local_data
    from app.services.crypto_engine import CryptoEngine

    def send(message: dict) -> None:
        out.write(rpc.to_json(message) + "\n")
        out.flush()

    try:
        settings.validate()
        info = CryptoEngine.get_backend_info()
        CryptoEngine.verify_pqc_availability()
        await init_db()
        # Starting is signing out: nothing survives from a session that ended by quitting or crashing.
        await local_data.wipe()
    except Exception as e:
        logger.exception("Startup failed")
        send({"event": "fatal", "detail": str(e) or type(e).__name__})
        return 1

    logger.info(f"Mode {settings.get_mode_label()}; {info['kem_algorithm']} + {info['signature_algorithm']} "
                f"via {info['backend']}; self-test passed; database {settings.DB_PATH}")
    send({"event": "ready", "boot_id": settings.BOOT_ID})

    async def handle(line: str) -> None:
        try:
            request = json.loads(line)
            request_id = request["id"]
        except (ValueError, KeyError, TypeError):
            logger.error(f"Ignoring malformed request: {line[:200]!r}")
            return
        try:
            result = await rpc.call(request.get("method"), request.get("params") or {})
            reply = {"id": request_id, "ok": True, "result": result}
        except ApiError as e:
            reply = {"id": request_id, "ok": False, "status": e.status_code, "detail": e.detail}
        except Exception as e:
            logger.exception(f"{request.get('method')} failed")
            reply = {"id": request_id, "ok": False, "status": 500,
                     "detail": f"Internal Processing Error: {str(e) or type(e).__name__}"}
        try:
            send(reply)
        except Exception as e:
            logger.exception("Could not send reply")
            send({"id": request_id, "ok": False, "status": 500, "detail": f"Unserialisable result: {e}"})

    # stdin is read on a thread: asyncio pipe readers differ across platforms.
    loop = asyncio.get_running_loop()
    lines: asyncio.Queue = asyncio.Queue()

    def read_stdin() -> None:
        for line in sys.stdin:
            loop.call_soon_threadsafe(lines.put_nowait, line)
        loop.call_soon_threadsafe(lines.put_nowait, None)

    threading.Thread(target=read_stdin, name="stdin", daemon=True).start()

    pending = set()
    while (line := await lines.get()) is not None:
        if line.strip():
            task = asyncio.create_task(handle(line))
            pending.add(task)
            task.add_done_callback(pending.discard)

    # stdin closed: the app is quitting. Let running requests finish; the app
    # kills the worker if they take too long.
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)
    rpc.sign_out()
    await local_data.wipe()
    return 0


def main() -> None:
    out = _claim_stdout()
    sys.stdin.reconfigure(encoding="utf-8")
    logging.basicConfig(stream=sys.stderr, level=logging.INFO,
                        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    sys.exit(asyncio.run(_serve(out)))


if __name__ == "__main__":
    main()
