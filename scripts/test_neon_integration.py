import asyncio
import sys
import os

# Include backend path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import engine, AsyncSessionLocal, init_db
from app.models.db_models import Base, GarmentModel, Kiosk, Session, AuditEvent
from sqlalchemy import text, select

async def main():
    print("=" * 60)
    print("TESTING NEON POSTGRESQL INTEGRATION")
    print("=" * 60)

    # 1. Initialize DB schemas
    print("\n[Step 1] Initializing schema on Neon...")
    await init_db()

    # 2. Inspect created tables
    print("\n[Step 2] Querying created tables from information_schema...")
    async with engine.connect() as conn:
        res = await conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        ))
        tables = [row[0] for row in res.fetchall()]
        print("Detected Neon Public Tables:", tables)

    # 3. Test CRUD operations with AsyncSession
    print("\n[Step 3] Testing AsyncSession insert & query on Neon...")
    async with AsyncSessionLocal() as session:
        # Check / Insert test kiosk
        res = await session.execute(select(Kiosk).where(Kiosk.id == "kiosk_test_neon"))
        kiosk = res.scalar_one_or_none()
        if not kiosk:
            kiosk = Kiosk(
                id="kiosk_test_neon",
                store_location="Neon Cloud Showcase Flagship",
                is_active=True
            )
            session.add(kiosk)
            await session.commit()
            print("Successfully inserted test Kiosk: kiosk_test_neon")
        else:
            print("Existing test Kiosk found: kiosk_test_neon")

        # Test querying garments
        res = await session.execute(select(GarmentModel))
        garments = res.scalars().all()
        print(f"Current Garments in Neon Database: {len(garments)}")

    await engine.dispose()
    print("\n[Step 4] All Neon Postgres database checks PASSED successfully!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

