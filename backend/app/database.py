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


def _add_missing_columns(sync_conn):
    """
    Idempotent, additive column migrations. ``create_all`` never alters an existing table, so columns
    added to a model after a database was first created are added here (guarded by PRAGMA table_info).
    """
    additions = {
        "watermark_records": [
            ("render_width", "INTEGER"),
            ("render_height", "INTEGER"),
        ],
    }
    for table, columns in additions.items():
        existing = {row[1] for row in sync_conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()}
        if not existing:
            continue  # table absent; create_all made it with the full schema
        for name, col_type in columns:
            if name not in existing:
                sync_conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {col_type}")


async def init_db():
    """Initializes database schema."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
