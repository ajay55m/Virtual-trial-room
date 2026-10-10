from fastapi import APIRouter
from pydantic import BaseModel
from app.models.schemas import SizeRecommendation, BodyMeasurements
from app.services.sizing_engine import sizing_engine

router = APIRouter()

class SizingRequest(BaseModel):
    heightCm: float = 175.0
    selectedSize: str = "M"
    genderPreference: str = "Unisex"
    stretchClass: str = "Medium"

@router.post("/calculate", response_model=SizeRecommendation)
async def calculate_size_recommendation(request: SizingRequest):
    """
    Computes anthropometric 3D body proportions and enforces the Honesty Rule.
    """
    measurements = sizing_engine.estimate_measurements(
        height_cm=request.heightCm,
        gender=request.genderPreference
    )
    recommendation = sizing_engine.calculate_recommendation(
        measurements=measurements,
        selected_size=request.selectedSize,
        stretch_class=request.stretchClass
    )
    return recommendation
