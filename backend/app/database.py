import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from .models.database import Base, User, Document
from .services.crypto_engine import CryptoEngine

# Use absolute path for SQLite database so current working directory never causes path divergence
DB_PATH = os.environ.get("CIPHERTRACE_DB_PATH") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ciphertrace_v2.db"))
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def init_db():
    """Initializes database schema and ensures defense officers are ready for operations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Ensure default officers exist for quick testing/demo
    from .routers.auth import ensure_default_officers
    async with AsyncSessionLocal() as session:
        await ensure_default_officers(session)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
