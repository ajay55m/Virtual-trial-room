import asyncio
import os
import sys

# Ensure backend path is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import httpx
from app.main import app
from app.database import engine, AsyncSessionLocal
from app.models.db_models import GarmentModel, Session as DBSession, Kiosk as DBKiosk, AuditEvent as DBAuditEvent
from sqlalchemy import select, text

async def run_end_to_end_test():
    print("=" * 70)
    print("PROVING END-TO-END NEON POSTGRESQL SERVICES INTEGRATION")
    print("=" * 70)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Health check
        print("\n--> [1/4] Testing GET /health...")
        r = await client.get("/health")
        print(f"Status: {r.status_code}, Response: {r.json()}")
        assert r.status_code == 200, f"Health check failed: {r.text}"

        # 2. Garment Catalog seeded and queried from Neon
        print("\n--> [2/4] Testing GET /v1/catalog...")
        r = await client.get("/v1/catalog")
        catalog_data = r.json()
        print(f"Status: {r.status_code}, Total garments returned: {len(catalog_data)}")
        assert r.status_code == 200 and len(catalog_data) > 0, "Catalog query failed"
        print(f"Sample garment from Neon: {catalog_data[0]['name']} (${catalog_data[0]['price']})")

        # 3. Create Session (persists Kiosk, Session, and AuditEvent in Neon)
        print("\n--> [3/4] Testing POST /v1/sessions...")
        session_payload = {
            "kioskId": "kiosk_flagship_neon_01",
            "heightCm": 178.5,
            "genderPreference": "Unisex",
            "consentSigned": True
        }
        r = await client.post("/v1/sessions", json=session_payload)
        session_res = r.json()
        print(f"Status: {r.status_code}, Created Session ID: {session_res.get('sessionId')}")
        assert r.status_code == 200, f"Session creation failed: {r.text}"
        session_id = session_res["sessionId"]

        # 4. Verify Telemetry & Direct DB confirmation in Neon
        print("\n--> [4/4] Verifying Remote Neon Database Records...")
        async with AsyncSessionLocal() as db:
            # Garments count
            garments_res = await db.execute(select(GarmentModel))
            db_garments = garments_res.scalars().all()
            print(f"Confirmed Garments in Neon Database: {len(db_garments)}")

            # Session record
            sess_res = await db.execute(select(DBSession).where(DBSession.id == session_id))
            saved_session = sess_res.scalar_one_or_none()
            assert saved_session is not None, "Session record not found in Neon!"
            print(f"Confirmed Session in Neon: ID={saved_session.id}, Kiosk={saved_session.kiosk_id}, Height={saved_session.user_height_cm}cm")

            # Kiosk record
            kiosk_res = await db.execute(select(DBKiosk).where(DBKiosk.id == "kiosk_flagship_neon_01"))
            saved_kiosk = kiosk_res.scalar_one_or_none()
            assert saved_kiosk is not None, "Kiosk record not found in Neon!"
            print(f"Confirmed Kiosk in Neon: ID={saved_kiosk.id}, Location={saved_kiosk.store_location}")

            # Audit Events count
            audit_res = await db.execute(select(DBAuditEvent).where(DBAuditEvent.session_id == session_id))
            saved_audits = audit_res.scalars().all()
            print(f"Confirmed Audit Events in Neon for session: {len(saved_audits)} event(s)")

    await engine.dispose()
    print("\n" + "=" * 70)
    print("ALL NEON SERVICES PROVED WORKING END-TO-END WITH ZERO FAILURES!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_end_to_end_test())

