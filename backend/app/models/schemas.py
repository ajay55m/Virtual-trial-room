from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

# Garment Data Models
class GarmentBase(BaseModel):
    sku: str
    name: str
    brand: str
    category: Literal['Upper', 'Lower', 'Dress', 'Outerwear']
    price: str
    fabricComposition: str
    stretchClass: Literal['None', 'Low', 'Medium', 'High']
    patternType: str
    tryonSupported: bool = True
    suitabilityScore: int = Field(default=95, ge=0, le=100)
    flatlayImage: str
    tryonResultImage: str
    availableSizes: List[str]
    description: str

class Garment(GarmentBase):
    id: str
    model_config = ConfigDict(from_attributes=True)

# Body Measurement Models
class BodyMeasurements(BaseModel):
    chestCm: float
    waistCm: float
    hipCm: float
    shoulderCm: float
    heightCm: float

class SizeRecommendation(BaseModel):
    recommendedSize: str
    confidence: float
    fitClass: Literal['Slim', 'Regular', 'Relaxed']
    honestyWarning: Optional[str] = None
    measurementBreakdown: BodyMeasurements

# Pose Quality Verification
class PoseQualityMetrics(BaseModel):
    sharpnessVariance: float
    bodyHeightPercent: float
    horizontalCenterOffset: float
    shoulderYawDegrees: float
    personCount: int = 1
    aPoseCompliant: bool = True
    stabilityTimeSec: float = 1.0

# Session Models
class SessionCreateRequest(BaseModel):
    kioskId: str
    heightCm: float = Field(default=172.0, ge=100.0, le=240.0)
    genderPreference: Optional[str] = "Unisex"
    consentSigned: bool = True

class SessionResponse(BaseModel):
    sessionId: str
    kioskId: str
    createdAt: datetime
    expiresAt: datetime
    status: Literal['ACTIVE', 'EXPIRED', 'COMPLETED']
    token: str
    websocketUrl: str

# Capture Submission
class CaptureMetadata(BaseModel):
    resolution: str
    metrics: PoseQualityMetrics
    timestamp: datetime = Field(default_factory=utc_now)

class CaptureResponse(BaseModel):
    captureId: str
    sessionId: str
    signedUploadUrl: str
    isApproved: bool
    warnings: List[str] = []

# TryOn Job Request
class TryOnJobRequest(BaseModel):
    sessionId: str
    garmentId: str
    selectedSize: str
    renderQuality: Literal['fast_fp16', 'high_fidelity'] = 'high_fidelity'

class TryOnJobResponse(BaseModel):
    jobId: str
    sessionId: str
    garmentId: str
    status: Literal['QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED']
    estimatedSeconds: int = 8
    websocketStream: str

# WebSocket Step Progress Message
class TryOnProgressMessage(BaseModel):
    jobId: str
    stage: Literal['POSE_EXTRACTION', 'DENSEPOSE_SURFACE', 'DIFFUSION_PASS', 'QUALITY_GATE', 'COMPLETED', 'FAILED']
    progressPercent: int
    logMessage: str
    intermediatePreviewUrl: Optional[str] = None
    resultImageUrl: Optional[str] = None
    sizeRecommendation: Optional[SizeRecommendation] = None
    error: Optional[str] = None

# Telemetry Log Model
class TelemetryLog(BaseModel):
    id: str
    timestamp: str
    level: Literal['INFO', 'WARN', 'ERROR', 'AUDIT']
    component: Literal['EdgeVision', 'GatewayAPI', 'CeleryQueue', 'VTONWorker', 'SecurityAudit']
    message: str
