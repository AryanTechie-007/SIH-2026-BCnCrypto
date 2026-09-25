from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    navy_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    rank = Column(String, nullable=False, default="OFFICER")
    command_unit = Column(String, nullable=False, default="TACTICAL COMMAND")
    clearance_level = Column(String, nullable=False, default="LEVEL-5 TOP SECRET")
    device_id = Column(String, nullable=False, default="TERMINAL-01")
    kem_public_key = Column(LargeBinary, nullable=False)
    kem_private_key = Column(LargeBinary, nullable=False)
    dsa_public_key = Column(LargeBinary, nullable=False)
    dsa_private_key = Column(LargeBinary, nullable=False)
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)

    distributions = relationship("Distribution", back_populates="recipient", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, nullable=False)
    title = Column(String, nullable=False)
    sha3_hash = Column(String, nullable=False)
    original_path = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    distributions = relationship("Distribution", back_populates="document", cascade="all, delete-orphan")


class Distribution(Base):
    __tablename__ = "distributions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    encrypted_dek = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="distributions")
    recipient = relationship("User", back_populates="distributions")
    events = relationship("DecryptionEvent", back_populates="distribution", cascade="all, delete-orphan")


class DecryptionEvent(Base):
    __tablename__ = "decryption_events"

    id = Column(Integer, primary_key=True, index=True)
    distribution_id = Column(Integer, ForeignKey("distributions.id"), nullable=False)
    session_nonce = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    device_id = Column(String, nullable=False)
    signature = Column(LargeBinary, nullable=False)
    event_hash = Column(String, nullable=False)

    distribution = relationship("Distribution", back_populates="events")
    watermark = relationship("WatermarkRecord", uselist=False, back_populates="event", cascade="all, delete-orphan")
    ledger_blocks = relationship("LedgerBlock", back_populates="event")


class WatermarkRecord(Base):
    __tablename__ = "watermark_records"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("decryption_events.id"), nullable=False)
    watermark_payload = Column(LargeBinary, nullable=False)
    watermark_hex = Column(String, nullable=False)
    watermarked_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("DecryptionEvent", back_populates="watermark")


class LedgerBlock(Base):
    __tablename__ = "ledger_blocks"

    id = Column(Integer, primary_key=True, index=True) # Block Index (0 = Genesis)
    event_id = Column(Integer, ForeignKey("decryption_events.id"), nullable=True)
    prev_block_hash = Column(String, nullable=False)
    merkle_root = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    data = Column(String, nullable=False) # JSON encoded event record
    block_hash = Column(String, nullable=False)
    endorsers = Column(String, default="NODE_ALPHA_DEFENSE,NODE_BRAVO_AUDIT,NODE_CHARLIE_FORENSIC")
    is_tampered = Column(Boolean, default=False)

    event = relationship("DecryptionEvent", back_populates="ledger_blocks")
