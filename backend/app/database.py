import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import event
from .models.database import Base, User, Document
from app.config import settings

DATABASE_URL = f"sqlite+aiosqlite:///{settings.DB_PATH}"

# Connect args for SQLite WAL mode and busy timeout
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"timeout": 15}
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)


@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enforces SQLite WAL journal mode, foreign key constraints, and busy timeout."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


async def init_db():
    """Initializes database schema and ensures defense officers are ready for operations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Ensure default officers exist for testing/demo
    from .routers.auth import ensure_default_officers
    async with AsyncSessionLocal() as session:
        await ensure_default_officers(session)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
