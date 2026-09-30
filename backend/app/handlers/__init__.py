"""Worker methods, grouped by area. Importing this package registers them all with app.rpc."""

from app.handlers import auth, decryption, documents, forensics, identity, ledger, system  # noqa: F401
