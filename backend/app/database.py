from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings
from app.models.db_models import Base
import logging

logger = logging.getLogger(__name__)

# Determine database URL with graceful local fallback if asyncpg driver is not installed
db_url = settings.DATABASE_URL

try:
    if "postgresql+asyncpg" in db_url:
        import asyncpg  # type: ignore
except ImportError:
    logger.info("PostgreSQL asyncpg driver not found in host environment; using SQLite async fallback for local dev.")
    db_url = "sqlite+aiosqlite:///./kiosk_local.db"

engine = create_async_engine(
    db_url,
    echo=settings.ENVIRONMENT == "development",
    future=True,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.warning(f"Database initialization deferred: {e}")

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
