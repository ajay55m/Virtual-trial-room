from fastapi import APIRouter, HTTPException
from typing import List
from app.models.schemas import Garment

router = APIRouter()

# In-memory luxury catalog feed matching frontend assets
CATALOG_ITEMS: List[dict] = [
    # --- WOMEN'S SAREE COLLECTION ---
    {
        "id": "garm_saree_01",
        "sku": "AUR-SR-KNJ-01",
        "name": "Crimson & Gold Kanjeevaram Silk Saree",
        "brand": "VASTRALAYAM Heritage",
        "category": "Saree",
        "collection": "Women's Saree Collection",
        "gender": "Women",
        "price": "$1,650",
        "fabricComposition": "100% Pure Mulberry Silk with Gold Zari Weave",
        "stretchClass": "None",
        "patternType": "Intricate Temple Border & Rich Pallu",
        "tryonSupported": True,
        "suitabilityScore": 99,
        "flatlayImage": "/assets/garment_saree_kanjeevaram.jpg",
        "tryonResultImage": "/assets/tryon_saree_kanjeevaram.jpg",
        "virtualModelImage": "/assets/tryon_saree_kanjeevaram.jpg",
        "isSaree": True,
        "availableSizes": ["Free Size (6.3m with Blouse)"],
        "description": "Authentic royal crimson Kanjeevaram pure silk saree with opulent 24K gold zari temple motif borders and handwoven ceremonial pallu. Includes tailored raw silk embroidered blouse."
    },
    {
        "id": "garm_saree_02",
        "sku": "AUR-SR-BNR-02",
        "name": "Sapphire Kadwa Banarasi Brocade Saree",
        "brand": "VARANASI Loom Guild",
        "category": "Saree",
        "collection": "Women's Saree Collection",
        "gender": "Women",
        "price": "$1,380",
        "fabricComposition": "100% Katan Silk with Fine Silver Zari",
        "stretchClass": "None",
        "patternType": "Silver Floral Jaal & Broad Paisley Border",
        "tryonSupported": True,
        "suitabilityScore": 97,
        "flatlayImage": "/assets/garment_saree_banarasi.jpg",
        "tryonResultImage": "/assets/tryon_saree_banarasi.jpg",
        "virtualModelImage": "/assets/tryon_saree_banarasi.jpg",
        "isSaree": True,
        "availableSizes": ["Free Size (6.3m with Blouse)"],
        "description": "Heirloom royal sapphire blue Banarasi silk saree woven with traditional silver zari kadwa technique, floral motifs across the drape, and glistening silver pallu."
    },
    {
        "id": "garm_saree_03",
        "sku": "AUR-SR-EMR-03",
        "name": "Emerald Sequin Contemporary Georgette Saree",
        "brand": "AURA Haute Couture",
        "category": "Saree",
        "collection": "Women's Saree Collection",
        "gender": "Women",
        "price": "$920",
        "fabricComposition": "Lightweight Pure Viscose Georgette with Glass Micro-Sequins",
        "stretchClass": "Low",
        "patternType": "Scalloped Embroidered Border & Sequin Scatter",
        "tryonSupported": True,
        "suitabilityScore": 96,
        "flatlayImage": "/assets/garment_saree_emerald.jpg",
        "tryonResultImage": "/assets/tryon_saree_emerald.jpg",
        "virtualModelImage": "/assets/tryon_saree_emerald.jpg",
        "isSaree": True,
        "availableSizes": ["Free Size (6.3m with Blouse)"],
        "description": "Modern luxury emerald green georgette saree featuring delicate handcrafted golden sequin embroidery, scalloped border edging, and a plunge embroidered sleeveless blouse."
    },

    # --- MEN'S LUXURY COLLECTION ---
    {
        "id": "garm_men_01",
        "sku": "AUR-MN-SHR-10",
        "name": "Imperial Ivory Hand-Embroidered Sherwani",
        "brand": "ROYAL HERITAGE Atelier",
        "category": "Menswear",
        "collection": "Men's Luxury Collection",
        "gender": "Men",
        "price": "$1,850",
        "fabricComposition": "Pure Matka Raw Silk with Gilded Zardozi Threading",
        "stretchClass": "None",
        "patternType": "Royal Vine Zardozi Embroidery & Crown Buttons",
        "tryonSupported": True,
        "suitabilityScore": 98,
        "flatlayImage": "/assets/garment_men_sherwani.jpg",
        "tryonResultImage": "/assets/tryon_men_sherwani.jpg",
        "virtualModelImage": "/assets/tryon_men_sherwani.jpg",
        "availableSizes": ["38", "40", "42", "44", "46"],
        "description": "Regal ivory raw silk ceremonial Sherwani coat adorned with intricate zardozi golden thread work along the placket and mandarin collar. Paired with tailored churidar."
    },
    {
        "id": "garm_men_02",
        "sku": "AUR-MN-TXD-20",
        "name": "Midnight Velvet Shawl-Lapel Tuxedo",
        "brand": "SARTORIALE Milano",
        "category": "Menswear",
        "collection": "Men's Luxury Collection",
        "gender": "Men",
        "price": "$1,450",
        "fabricComposition": "Italian Cotton-Silk Velvet & Black Duchesse Satin",
        "stretchClass": "Low",
        "patternType": "Deep Luminous Velvet Finish",
        "tryonSupported": True,
        "suitabilityScore": 95,
        "flatlayImage": "/assets/garment_men_tuxedo.jpg",
        "tryonResultImage": "/assets/tryon_men_tuxedo.jpg",
        "virtualModelImage": "/assets/tryon_men_tuxedo.jpg",
        "availableSizes": ["38R", "40R", "42R", "44R", "46R"],
        "description": "Bespoke midnight navy velvet dinner jacket featuring satin black shawl lapels, single satin button closure, pleated tuxedo shirt, silk bow tie, and tailored trousers."
    },
    {
        "id": "garm_men_03",
        "sku": "AUR-MN-BDG-30",
        "name": "Charcoal Textured Raw Silk Bandhgala Suit",
        "brand": "JODHPUR Imperial Lab",
        "category": "Menswear",
        "collection": "Men's Luxury Collection",
        "gender": "Men",
        "price": "$1,150",
        "fabricComposition": "Handspun Raw Tussar Silk with Horn Shank Buttons",
        "stretchClass": "None",
        "patternType": "Subtle Slub Texture with Crest Embellishments",
        "tryonSupported": True,
        "suitabilityScore": 94,
        "flatlayImage": "/assets/garment_men_bandhgala.jpg",
        "tryonResultImage": "/assets/tryon_men_bandhgala.jpg",
        "virtualModelImage": "/assets/tryon_men_bandhgala.jpg",
        "availableSizes": ["38", "40", "42", "44"],
        "description": "Refined modern Jodhpuri Bandhgala jacket in rich charcoal handwoven raw silk, featuring antique metallic heraldic buttons, welt pocket square, and structured silhouette."
    },

    # --- HAUTE COUTURE & WESTERN COLLECTION ---
    {
        "id": "garm_001",
        "sku": "AURA-BLZ-092",
        "name": "Structured Silk Evening Blazer",
        "brand": "MAISON VELOURS",
        "category": "Upper",
        "collection": "Haute Couture & Western",
        "gender": "Unisex",
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
        "collection": "Haute Couture & Western",
        "gender": "Women",
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
        "collection": "Haute Couture & Western",
        "gender": "Unisex",
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
