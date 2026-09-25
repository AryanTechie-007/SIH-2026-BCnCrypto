from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, LargeBinary, Boolean
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    kem_public_key = Column(LargeBinary, nullable=False)  # ML-KEM-768 Public Key
    dsa_public_key = Column(LargeBinary, nullable=False)  # ML-DSA-65 Public Key
    status = Column(String, default="active") # active, revoked
    created_at = Column(DateTime, default=datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, nullable=False)
    sha3_hash = Column(String, nullable=False)
    original_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Distribution(Base):
    __tablename__ = "distributions"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"))
    encrypted_dek = Column(LargeBinary, nullable=False) # ML-KEM Encapsulated DEK
    created_at = Column(DateTime, default=datetime.utcnow)

class DecryptionEvent(Base):
    __tablename__ = "decryption_events"
    id = Column(Integer, primary_key=True, index=True)
    distribution_id = Column(Integer, ForeignKey("distributions.id"))
    session_nonce = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    device_id = Column(String, nullable=False)
    signature = Column(LargeBinary, nullable=False) # ML-DSA signature of event data

class LedgerBlock(Base):
    __tablename__ = "ledger_blocks"
    id = Column(Integer, primary_key=True, index=True)
    prev_block_hash = Column(String, nullable=True)
    merkle_root = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    data = Column(String, nullable=False) # JSON representation of batch

class WatermarkRecord(Base):
    __tablename__ = "watermark_records"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("decryption_events.id"))
    watermark_payload = Column(LargeBinary, nullable=False)
