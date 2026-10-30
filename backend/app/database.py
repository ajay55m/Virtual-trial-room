from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings
from app.models.db_models import Base
import logging
import re

logger = logging.getLogger(__name__)

# Parse and normalize database URL for Neon / PostgreSQL + asyncpg
raw_url = settings.DATABASE_URL

if raw_url.startswith("postgresql://") or raw_url.startswith("postgres://"):
    # Convert standard postgres URL to asyncpg format
    db_url = re.sub(r"^postgres(ql)?://", "postgresql+asyncpg://", raw_url)
    # Convert sslmode parameter to asyncpg ssl param
    if "sslmode=require" in db_url:
        db_url = db_url.replace("sslmode=require", "ssl=require")
    # Clean up channel_binding which asyncpg does not accept in query string
    db_url = re.sub(r"[?&]channel_binding=[^&]+", "", db_url)
    if "?" not in db_url and "&" in db_url:
        db_url = db_url.replace("&", "?", 1)
else:
    db_url = raw_url

try:
    if "postgresql+asyncpg" in db_url:
        import asyncpg  # type: ignore
except ImportError:
    logger.warning("PostgreSQL asyncpg driver not found in host environment; using SQLite async fallback for local dev.")
    db_url = "sqlite+aiosqlite:///./kiosk_local.db"

# Serverless-ready async engine optimized for Neon
engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,  # Essential for Neon serverless auto-suspend / resume
    pool_recycle=300     # Recycle stale connections every 5 min
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
        logger.info("Database tables initialized successfully on Neon Postgres.")
    except Exception as e:
        logger.warning(f"Database initialization deferred: {e}")

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
