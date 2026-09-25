from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from .models.database import Base

DATABASE_URL = "sqlite+aiosqlite:///./ciphertrace.db"

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default operational actors if missing
    from .models.database import User
    from .services.crypto_service import CryptoService
    from sqlalchemy.future import select

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        existing = result.scalars().all()
        existing_names = {u.name for u in existing}
        default_actors = [
            "Captain A. Verma",
            "Commander S. Rao",
            "Wing Commander N. Joshi"
        ]
        added = False
        for name in default_actors:
            if name not in existing_names:
                kem_pub, _ = CryptoService.generate_kem_keypair()
                dsa_pub, _ = CryptoService.generate_signing_keypair()
                user = User(
                    name=name,
                    kem_public_key=kem_pub,
                    dsa_public_key=dsa_pub,
                    status="active"
                )
                session.add(user)
                added = True
        if added:
            await session.commit()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

