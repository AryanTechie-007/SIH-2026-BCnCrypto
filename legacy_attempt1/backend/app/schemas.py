from pydantic import BaseModel
from typing import List, Optional

class EncryptRequest(BaseModel):
    recipient_ids: List[int]

class DecryptRequest(BaseModel):
    recipient_private_key: str
    device_id: str

class DecryptDocRequest(BaseModel):
    document_id: int
    recipient_id: int
    recipient_private_key: Optional[str] = None
    device_id: Optional[str] = "DEV-TACTICAL-SECURE"

