"""
CIPHERTRACE Local Data
======================
Nothing a session produces outlives it on this device. wipe() runs at sign-out,
and when the worker starts and stops (so quitting or a crash counts as signing
out). It deletes every database row and every working file:

    database        users, documents, distributions, decryption events,
                    watermark records, the local audit chain
    UPLOAD_DIR      imported documents and their .enc envelopes
    RETURNS_DIR     watermarked copies not yet saved
    BUNDLES_DIR     unpacked identity bundles (they hold the Fabric private key)

The encrypted keystores in KEYSTORE_DIR stay: the key registry is write-once,
so a user whose keystore was deleted could never publish new keys under the
same name. Everything else comes back from the ledger at the next sign-in.
"""

import logging
import os
import shutil

from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.models.database import Base

logger = logging.getLogger("ciphertrace.local_data")


async def wipe() -> None:
    async with engine.begin() as conn:
        # Overwrite deleted rows instead of leaving them in free pages.
        await conn.execute(text("PRAGMA secure_delete=ON"))
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    # Shrink the file and fold the write-ahead log back in, so no old pages remain.
    async with engine.connect() as conn:
        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
        await conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
        await conn.execute(text("VACUUM"))

    for folder in (settings.UPLOAD_DIR, settings.RETURNS_DIR, settings.BUNDLES_DIR):
        _empty(folder)
    logger.info("Local data wiped (keystores kept)")


def _empty(folder: str) -> None:
    """Deletes the folder's contents, keeping the folder itself and .gitkeep."""
    if not os.path.isdir(folder):
        return
    for name in os.listdir(folder):
        if name == ".gitkeep":
            continue
        path = os.path.join(folder, name)
        try:
            if os.path.isdir(path) and not os.path.islink(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
        except OSError as e:
            logger.warning(f"Could not delete {path}: {e}")
