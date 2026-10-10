from fastapi import APIRouter, HTTPException
from typing import List
from app.models.schemas import Garment

router = APIRouter()

# In-memory luxury catalog feed matching frontend assets
CATALOG_ITEMS: List[dict] = [
    {
        "id": "garm_001",
        "sku": "AURA-BLZ-092",
        "name": "Structured Silk Evening Blazer",
        "brand": "MAISON VELOURS",
        "category": "Upper",
        "price": "$1,450",
        "fabricComposition": "85% Mulberry Silk, 15% Virgin Wool",
        "stretchClass": "Low",
        "patternType": "Solid Minimalist",
        "tryonSupported": True,
        "suitabilityScore": 98,
        "flatlayImage": "/assets/garment_blazer.jpg",
        "tryonResultImage": "/assets/tryon_blazer.jpg",
        "availableSizes": ["XS", "S", "M", "L", "XL"],
        "description": "Handcrafted peak-lapel blazer with sculpted waistline and matte horn buttons. Precision-tailored silhouette designed for gallery evenings and modern formal engagements."
    },
    {
        "id": "garm_002",
        "sku": "AURA-DRS-118",
        "name": "Draped Emerald Column Gown",
        "brand": "ATELIER LUMIÈRE",
        "category": "Dress",
        "price": "$2,200",
        "fabricComposition": "100% Hammered Silk Satin",
        "stretchClass": "Medium",
        "patternType": "Fluid Monochrome",
        "tryonSupported": True,
        "suitabilityScore": 95,
        "flatlayImage": "/assets/garment_dress.jpg",
        "tryonResultImage": "/assets/tryon_dress.jpg",
        "availableSizes": ["XS", "S", "M", "L"],
        "description": "Floor-length bias-cut column gown with asymmetric cowl neckline and architectural back drapery. Emits a subtle liquid-emerald sheen under directional lighting."
    },
    {
        "id": "garm_003",
        "sku": "AURA-JKT-440",
        "name": "Cybernetic Technical Shell Jacket",
        "brand": "NEO-KINESIS",
        "category": "Outerwear",
        "price": "$980",
        "fabricComposition": "3-Layer Ripstop Cordura + Hydrophobic Membrane",
        "stretchClass": "None",
        "patternType": "Modular Techwear",
        "tryonSupported": True,
        "suitabilityScore": 92,
        "flatlayImage": "/assets/garment_jacket.jpg",
        "tryonResultImage": "/assets/tryon_jacket.jpg",
        "availableSizes": ["S", "M", "L", "XL"],
        "description": "Waterproof storm-proof technical outerwear featuring fidlock magnetic buckle closures, articulated raglan sleeves, and laser-welded ventilation seams."
    }
]

@router.get("", response_model=List[Garment])
async def get_garment_catalog():
    """Retrieve full catalog of virtual try-on compatible garments."""
    return CATALOG_ITEMS

@router.get("/{garment_id}", response_model=Garment)
async def get_garment_by_id(garment_id: str):
    """Retrieve specific garment item by unique ID."""
    for item in CATALOG_ITEMS:
        if item["id"] == garment_id:
            return item
    raise HTTPException(status_code=404, detail="Garment not found")
