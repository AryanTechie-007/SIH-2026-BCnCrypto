from pydantic import BaseModel
from typing import List, Optional

class EncryptRequest(BaseModel):
    recipient_ids: List[int]

class DecryptRequest(BaseModel):
    recipient_private_key: str
    device_id: str
