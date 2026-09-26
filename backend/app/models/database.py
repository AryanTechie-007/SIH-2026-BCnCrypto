from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    """
    User model.
    CRITICAL SECURITY ASSURANCE:
    Private keys (ML-KEM and ML-DSA) are NEVER stored in this database.
    Private keys reside exclusively in the user's encrypted local keystore.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False) # Argon2id hash
    navy_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    rank = Column(String, nullable=False, default="OFFICER")
    command_unit = Column(String, nullable=False, default="TACTICAL COMMAND")
    clearance_level = Column(String, nullable=False, default="LEVEL-5 TOP SECRET")
    device_id = Column(String, nullable=False, default="TERMINAL-01")
    role = Column(String, nullable=False, default="RECIPIENT") # SENDER, RECIPIENT, INVESTIGATOR, ADMIN

    # Public Keys & Key Metadata ONLY (No private keys)
    kem_public_key = Column(LargeBinary, nullable=False)
    kem_key_id = Column(String, nullable=False)
    dsa_public_key = Column(LargeBinary, nullable=False)
    dsa_key_id = Column(String, nullable=False)
    key_version = Column(Integer, default=1, nullable=False)
    key_status = Column(String, default="ACTIVE", nullable=False) # ACTIVE, REVOKED, ROTATED

    # Local encrypted keystore location (client/device side)
    keystore_path = Column(String, nullable=True)

    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

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
    signature = Column(LargeBinary, nullable=False) # ML-DSA-65 signature
    signature_algorithm = Column(String, default="ML-DSA-65", nullable=False)
    kem_algorithm = Column(String, default="ML-KEM-768", nullable=False)
    event_hash = Column(String, nullable=False)
    fabric_tx_id = Column(String, nullable=True)
    fabric_block_number = Column(Integer, nullable=True)

    distribution = relationship("Distribution", back_populates="events")
    watermark = relationship("WatermarkRecord", uselist=False, back_populates="event", cascade="all, delete-orphan")
    ledger_blocks = relationship("LedgerBlock", back_populates="event")


class WatermarkRecord(Base):
    __tablename__ = "watermark_records"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("decryption_events.id"), nullable=False)
    watermark_id = Column(String, index=True, nullable=False) # 20 hex chars for authoritative lookup
    watermark_payload = Column(LargeBinary, nullable=False)
    watermark_hex = Column(String, nullable=False)
    protocol_version = Column(Integer, default=2, nullable=False)
    reed_solomon_profile = Column(String, default="RS(255,127)", nullable=False)
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
    signature_algorithm = Column(String, default="ML-DSA-65", nullable=False)
    fabric_tx_id = Column(String, nullable=True)
    is_tampered = Column(Boolean, default=False)

    event = relationship("DecryptionEvent", back_populates="ledger_blocks")
