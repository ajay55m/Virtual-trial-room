from datetime import datetime, timezone
import uuid
from typing import Any

try:
    from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, ForeignKey, Text
    from sqlalchemy.orm import declarative_base
    Base = declarative_base()
except ImportError:
    # Graceful fallback for environments where SQLAlchemy is still installing
    class Base:  # type: ignore
        pass
    Column = String = Integer = Float = Boolean = DateTime = JSON = ForeignKey = Text = lambda *args, **kwargs: None  # type: ignore

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Brand(Base):
    __tablename__ = "brands"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)
    tier = Column(String(50), default="Luxury")
    created_at = Column(DateTime(timezone=True), default=utc_now)

class GarmentModel(Base):
    __tablename__ = "garments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sku = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    brand = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    price = Column(String(50), nullable=False)
    fabric_composition = Column(String(200), nullable=False)
    stretch_class = Column(String(50), nullable=False)
    pattern_type = Column(String(100), nullable=False)
    tryon_supported = Column(Boolean, default=True)
    suitability_score = Column(Integer, default=95)
    flatlay_image = Column(String(500), nullable=False)
    tryon_result_image = Column(String(500), nullable=False)
    available_sizes = Column(JSON, nullable=False)
    description = Column(Text, nullable=False)
    size_chart = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

class Kiosk(Base):
    __tablename__ = "kiosks"

    id = Column(String(50), primary_key=True)
    store_location = Column(String(200), nullable=False)
    device_certificate_fingerprint = Column(String(256), nullable=True)
    is_active = Column(Boolean, default=True)
    last_heartbeat = Column(DateTime(timezone=True), default=utc_now)
    ip_address = Column(String(45), nullable=True)

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    kiosk_id = Column(String(50), ForeignKey("kiosks.id"), nullable=False)
    user_height_cm = Column(Float, nullable=False)
    gender_preference = Column(String(50), default="Unisex")
    consent_signed = Column(Boolean, default=True)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), default=utc_now)
    expires_at = Column(DateTime(timezone=True), nullable=False)

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), nullable=True, index=True)
    kiosk_id = Column(String(50), nullable=True)
    event_type = Column(String(100), nullable=False)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)
