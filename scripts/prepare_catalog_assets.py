#!/usr/bin/env python3
"""
Prepares and normalizes garment catalog assets for Phase 2:
1. Replaces folded sweater with the flat-lay charcoal cashmere sweater (extended sleeves, transparent PNG).
2. Converts white-background saree photos to transparent ghost-mannequin PNGs with proper margins.
3. Centers white t-shirt with clean border margins.
4. Generates companion anchor metadata JSONs for all catalog garments.
"""

import os
import json
from PIL import Image, ImageFilter
import numpy as np

ASSET_DIR = r"c:\AI\frontend\public\assets"
BRAIN_DIR = r"C:\Users\ajay2\.gemini\antigravity-ide\brain\86e5b2d4-9585-4562-a714-2ffb0e98d140"

def process_sweater():
    src = os.path.join(BRAIN_DIR, "flatlay_charcoal_sweater_1792413092177.jpg")
    dst = os.path.join(ASSET_DIR, "garment_basic_sweater.png")
    
    im = Image.open(src).convert('RGB')
    arr = np.array(im, dtype=np.float32)
    
    # Charcoal sweater on white background
    lum = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    bg_thresh = 225.0
    fg_thresh = 180.0
    alpha = np.clip((bg_thresh - lum) / (bg_thresh - fg_thresh) * 255.0, 0, 255).astype(np.uint8)
    
    alpha_im = Image.fromarray(alpha, mode='L').filter(ImageFilter.GaussianBlur(radius=0.6))
    r, g, b = im.split()
    rgba = Image.merge('RGBA', (r, g, b, alpha_im))
    rgba.save(dst, format='PNG')
    print(f"Saved: {dst}")

def process_saree(src_name, dst_name):
    src = os.path.join(BRAIN_DIR, src_name)
    dst = os.path.join(ASSET_DIR, dst_name)
    
    im = Image.open(src).convert('RGB')
    arr = np.array(im, dtype=np.float32)
    
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = 0.299*r + 0.587*g + 0.114*b
    chroma = np.maximum(r, np.maximum(g, b)) - np.minimum(r, np.minimum(g, b))
    
    # White studio background
    is_bg = (lum > 208) & (chroma < 28)
    alpha = np.where(is_bg, 0, 255).astype(np.uint8)
    alpha_im = Image.fromarray(alpha, mode='L').filter(ImageFilter.GaussianBlur(radius=0.5))
    
    r_ch, g_ch, b_ch = im.split()
    rgba = Image.merge('RGBA', (r_ch, g_ch, b_ch, alpha_im))
    
    # Add 5% border margin so right/bottom edge never touches frame border
    target_w, target_h = 896, 1200
    canvas = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    # Scale down by 92%
    scale = 0.92
    scaled_w = int(rgba.width * scale)
    scaled_h = int(rgba.height * scale)
    scaled_rgba = rgba.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
    
    offset_x = (target_w - scaled_w) // 2
    offset_y = (target_h - scaled_h) // 2
    canvas.paste(scaled_rgba, (offset_x, offset_y), scaled_rgba)
    canvas.save(dst, format='PNG')
    print(f"Saved: {dst}")

def center_white_tshirt():
    src = os.path.join(ASSET_DIR, "garment_white_tshirt.png")
    im = Image.open(src)
    arr = np.array(im)
    alpha = arr[:, :, 3]
    y_ind, x_ind = np.where(alpha > 20)
    
    min_x, max_x = np.min(x_ind), np.max(x_ind)
    min_y, max_y = np.min(y_ind), np.max(y_ind)
    
    # Crop to subject bounding box
    cropped = im.crop((int(min_x), int(min_y), int(max_x), int(max_y)))
    
    # Center on fresh 1024x1024 canvas with 8% top padding
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    scale = min(880 / cropped.width, 820 / cropped.height)
    new_w = int(cropped.width * scale)
    new_h = int(cropped.height * scale)
    scaled = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    paste_x = (1024 - new_w) // 2
    paste_y = int(1024 * 0.08)
    canvas.paste(scaled, (paste_x, paste_y), scaled)
    canvas.save(src, format='PNG')
    print(f"Centered and saved: {src}")

def write_companion_metadata():
    garment_metadata = {
        "garment_basic_shirt": {
            "sku": "VF-TOP-SHT-03",
            "name": "Basic Shirt",
            "category": "upper",
            "aspect_ratio": 1.0,
            "neckline_center": [0.50, 0.10],
            "left_shoulder": [0.33, 0.13],
            "right_shoulder": [0.67, 0.13],
            "hem_center": [0.50, 0.92],
            "left_cuff": [0.11, 0.52],
            "right_cuff": [0.90, 0.52],
            "bbox": [0.11, 0.07, 0.90, 0.92]
        },
        "garment_basic_sweater": {
            "sku": "VF-TOP-SWT-02",
            "name": "Basic Sweater (Flat-Lay Cashmere)",
            "category": "upper",
            "aspect_ratio": 1.0,
            "neckline_center": [0.50, 0.17],
            "left_shoulder": [0.35, 0.19],
            "right_shoulder": [0.65, 0.19],
            "hem_center": [0.50, 0.85],
            "left_cuff": [0.06, 0.78],
            "right_cuff": [0.94, 0.78],
            "bbox": [0.05, 0.16, 0.95, 0.85]
        },
        "garment_white_tshirt": {
            "sku": "VF-TOP-TSH-01",
            "name": "Basic T-Shirt",
            "category": "upper",
            "aspect_ratio": 1.0,
            "neckline_center": [0.50, 0.12],
            "left_shoulder": [0.29, 0.15],
            "right_shoulder": [0.71, 0.15],
            "hem_center": [0.50, 0.88],
            "left_cuff": [0.08, 0.38],
            "right_cuff": [0.92, 0.38],
            "bbox": [0.07, 0.08, 0.93, 0.89]
        },
        "garment_blazer": {
            "sku": "BLK-SLK-BLZ-09",
            "name": "Tailored Midnight Silk Blazer",
            "category": "upper",
            "aspect_ratio": 0.7467,
            "neckline_center": [0.50, 0.13],
            "left_shoulder": [0.24, 0.16],
            "right_shoulder": [0.76, 0.16],
            "hem_center": [0.50, 0.90],
            "left_cuff": [0.12, 0.55],
            "right_cuff": [0.88, 0.55],
            "bbox": [0.12, 0.10, 0.88, 0.90]
        },
        "garment_jacket": {
            "sku": "CYB-TCK-JKT-11",
            "name": "Cybernetic Techwear Jacket",
            "category": "upper",
            "aspect_ratio": 0.7467,
            "neckline_center": [0.51, 0.13],
            "left_shoulder": [0.36, 0.16],
            "right_shoulder": [0.66, 0.16],
            "hem_center": [0.50, 0.89],
            "left_cuff": [0.08, 0.55],
            "right_cuff": [0.92, 0.55],
            "bbox": [0.08, 0.10, 0.92, 0.89]
        },
        "garment_dress": {
            "sku": "EMR-EVE-GWN-08",
            "name": "Emerald Evening Gown",
            "category": "overall",
            "aspect_ratio": 0.7467,
            "neckline_center": [0.50, 0.09],
            "left_shoulder": [0.37, 0.12],
            "right_shoulder": [0.62, 0.12],
            "hem_center": [0.60, 0.96],
            "bbox": [0.20, 0.06, 0.81, 0.96]
        },
        "garment_men_sherwani": {
            "sku": "AUR-MN-SHR-10",
            "name": "Imperial Ivory Embroidered Sherwani",
            "category": "overall",
            "aspect_ratio": 0.7467,
            "neckline_center": [0.50, 0.08],
            "left_shoulder": [0.31, 0.12],
            "right_shoulder": [0.69, 0.12],
            "hem_center": [0.50, 0.98],
            "left_cuff": [0.12, 0.52],
            "right_cuff": [0.88, 0.52],
            "bbox": [0.01, 0.05, 0.99, 0.99]
        },
        "garment_men_tuxedo": {
            "sku": "AUR-MN-TXD-20",
            "name": "Midnight Velvet Shawl-Lapel Tuxedo",
            "category": "overall",
            "aspect_ratio": 0.7467,
            "neckline_center": [0.50, 0.12],
            "left_shoulder": [0.27, 0.15],
            "right_shoulder": [0.73, 0.15],
            "hem_center": [0.50, 0.92],
            "left_cuff": [0.06, 0.58],
            "right_cuff": [0.94, 0.58],
            "bbox": [0.04, 0.09, 0.96, 0.93]
        },
        "garment_men_bandhgala": {
            "sku": "AUR-MN-BDG-30",
            "name": "Royal Jodhpuri Bandhgala Suit",
            "category": "overall",
            "aspect_ratio": 0.7467,
            "neckline_center": [0.50, 0.08],
            "left_shoulder": [0.29, 0.12],
            "right_shoulder": [0.71, 0.12],
            "hem_center": [0.50, 0.98],
            "left_cuff": [0.06, 0.55],
            "right_cuff": [0.94, 0.55],
            "bbox": [0.01, 0.06, 0.99, 0.99]
        },
        "garment_saree_kanjeevaram": {
            "sku": "AUR-SR-KNJ-01",
            "name": "Crimson & Gold Kanjeevaram Saree",
            "category": "overall",
            "aspect_ratio": 0.7467,
            "neckline_center": [0.38, 0.12],
            "left_shoulder": [0.24, 0.13],
            "right_shoulder": [0.54, 0.13],
            "hem_center": [0.45, 0.97],
            "bbox": [0.15, 0.06, 0.95, 0.98]
        },
        "garment_saree_banarasi": {
            "sku": "AUR-SR-BNR-02",
            "name": "Sapphire Kadwa Banarasi Brocade Saree",
            "category": "overall",
            "aspect_ratio": 0.7467,
            "neckline_center": [0.42, 0.11],
            "left_shoulder": [0.28, 0.13],
            "right_shoulder": [0.58, 0.13],
            "hem_center": [0.48, 0.97],
            "bbox": [0.20, 0.04, 0.83, 0.98]
        },
        "garment_saree_emerald": {
            "sku": "AUR-SR-EMR-03",
            "name": "Emerald Brocade Zari Saree",
            "category": "overall",
            "aspect_ratio": 0.7467,
            "neckline_center": [0.44, 0.11],
            "left_shoulder": [0.29, 0.13],
            "right_shoulder": [0.58, 0.13],
            "hem_center": [0.48, 0.97],
            "bbox": [0.21, 0.07, 0.94, 0.98]
        },
        "garment_short_pants": {
            "sku": "VF-BOT-SHT-04",
            "name": "Short Pants",
            "category": "lower",
            "aspect_ratio": 1.0,
            "waist_center": [0.50, 0.12],
            "left_hip": [0.22, 0.16],
            "right_hip": [0.78, 0.16],
            "hem_center": [0.50, 0.92],
            "bbox": [0.00, 0.01, 0.99, 0.99]
        },
        "garment_training_pants": {
            "sku": "VF-BOT-TRN-06",
            "name": "Training Pants",
            "category": "lower",
            "aspect_ratio": 1.0,
            "waist_center": [0.50, 0.08],
            "left_hip": [0.25, 0.14],
            "right_hip": [0.75, 0.14],
            "hem_center": [0.50, 0.96],
            "bbox": [0.00, 0.00, 0.99, 0.99]
        },
        "garment_white_shoes": {
            "sku": "VF-FTW-SNK-05",
            "name": "Short shoes (White)",
            "category": "lower",
            "aspect_ratio": 1.0,
            "waist_center": [0.50, 0.35],
            "hem_center": [0.50, 0.85],
            "bbox": [0.00, 0.00, 0.99, 0.99]
        },
        "garment_brown_shoes": {
            "sku": "VF-FTW-OXF-07",
            "name": "Brown Oxford Shoes",
            "category": "lower",
            "aspect_ratio": 1.0,
            "waist_center": [0.50, 0.35],
            "hem_center": [0.50, 0.85],
            "bbox": [0.00, 0.00, 0.99, 0.99]
        }
    }

    for base_name, meta in garment_metadata.items():
        json_path = os.path.join(ASSET_DIR, f"{base_name}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
        print(f"Generated metadata: {json_path}")

if __name__ == "__main__":
    print("Processing garment assets...")
    process_sweater()
    process_saree("flatlay_saree_kanjeevaram_1792412950785.jpg", "garment_saree_kanjeevaram.png")
    process_saree("flatlay_saree_banarasi_1792412973727.jpg", "garment_saree_banarasi.png")
    process_saree("flatlay_saree_emerald_1792412994806.jpg", "garment_saree_emerald.png")
    center_white_tshirt()
    write_companion_metadata()
    print("Catalog assets processing complete.")
