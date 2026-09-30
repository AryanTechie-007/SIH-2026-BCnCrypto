"""
A handler's refusal, returned to the app as {"ok": false, "status", "detail"}.

Status codes keep their HTTP meanings (400 bad input, 401 not signed in,
428 passphrase needed, 503 ledger unreachable, ...) so the UI can tell cases apart.
"""

from typing import Any


class ApiError(Exception):
    def __init__(self, status_code: int, detail: Any):
        super().__init__(detail if isinstance(detail, str) else str(detail))
        self.status_code = status_code
        self.detail = detail
