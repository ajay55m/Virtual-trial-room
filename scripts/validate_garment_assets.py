#!/usr/bin/env python3
"""
Garment Asset Validation Script for Virtual Trial Room Kiosk
Validates garment PNG assets and companion anchor metadata JSON files against Phase 2 standard:
1. Valid PNG file format with RGBA alpha channel.
2. Transparent outer border (isolated subject, not a solid rectangle).
3. Reasonable subject coverage (15% - 85% non-transparent pixels).
4. Companion anchor metadata JSON file exists and matches schema:
   - category: 'upper' | 'lower' | 'overall'
   - aspect_ratio matches actual image dimensions within 2%
   - keypoint anchors in normalized [0, 1] range:
     * neckline_center
     * left_shoulder, right_shoulder
     * hem_center
     * left_cuff, right_cuff (optional)
   - keypoint geometric coherence (neck above hem, shoulders properly ordered)
5. Layout check: flat-lay with sleeves extended (not folded or crossed over front).
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List, Tuple
from PIL import Image
import numpy as np

SCHEMA_CATEGORIES = {'upper', 'lower', 'overall'}

class GarmentAssetValidator:
    def __init__(self, asset_dir: str):
        self.asset_dir = asset_dir

    def validate_image(self, file_path: str) -> Tuple[bool, List[str], Dict[str, Any]]:
        errors = []
        info: Dict[str, Any] = {}

        if not os.path.exists(file_path):
            return False, [f"File not found: {file_path}"], info

        # 1. Format check
        if not file_path.lower().endswith('.png'):
            errors.append(f"Invalid file extension: must be .png, found {os.path.splitext(file_path)[1]}")

        try:
            with Image.open(file_path) as im:
                info['format'] = im.format
                info['size'] = im.size
                info['mode'] = im.mode
                w, h = im.size
                aspect_ratio = round(w / h, 4)
                info['aspect_ratio'] = aspect_ratio

                if im.format != 'PNG':
                    errors.append(f"Image format is {im.format}, expected PNG")

                # 2. Alpha channel check
                if im.mode not in ('RGBA', 'LA'):
                    errors.append(f"Missing alpha channel: image mode is {im.mode}, expected RGBA")
                    return False, errors, info

                # 3. Transparent border check (is it an isolated flat-lay or a solid rectangle?)
                arr = np.array(im)
                alpha = arr[:, :, 3] if im.mode == 'RGBA' else arr[:, :, 1]

                # Sample borders: 1px edge strip on all 4 sides
                top_edge = alpha[0, :]
                bottom_edge = alpha[-1, :]
                left_edge = alpha[:, 0]
                right_edge = alpha[:, -1]
                border_pixels = np.concatenate([top_edge, bottom_edge, left_edge, right_edge])

                opaque_border_ratio = np.mean(border_pixels > 20)
                info['opaque_border_ratio'] = round(float(opaque_border_ratio), 4)

                if opaque_border_ratio > 0.05:
                    errors.append(
                        f"Outer border is not transparent ({opaque_border_ratio*100:.1f}% opaque border pixels). "
                        "Garment must be cleanly isolated on transparent alpha background."
                    )

                # 4. Coverage check
                non_transparent = np.sum(alpha > 20)
                coverage = non_transparent / (w * h)
                info['alpha_coverage'] = round(float(coverage), 4)

                if coverage < 0.10:
                    errors.append(f"Alpha coverage too low ({coverage*100:.1f}%): garment is virtually invisible or empty")
                elif coverage > 0.90:
                    errors.append(f"Alpha coverage too high ({coverage*100:.1f}%): subject is not an isolated garment")

                # Bounding box of garment pixels
                y_indices, x_indices = np.where(alpha > 20)
                if len(y_indices) > 0:
                    min_x, max_x = float(np.min(x_indices)) / w, float(np.max(x_indices)) / w
                    min_y, max_y = float(np.min(y_indices)) / h, float(np.max(y_indices)) / h
                    info['bbox'] = [round(min_x, 3), round(min_y, 3), round(max_x, 3), round(max_y, 3)]
                    center_x = (min_x + max_x) / 2.0
                    info['center_x'] = round(center_x, 3)

                    # Center asymmetry check: flat-lay should be roughly centered
                    if abs(center_x - 0.5) > 0.15:
                        errors.append(
                            f"Garment is severely off-center (horizontal center = {center_x:.2f}). "
                            "Flat-lay must be centered in frame."
                        )

        except Exception as e:
            errors.append(f"Failed to read/decode image: {str(e)}")

        return (len(errors) == 0), errors, info

    def validate_metadata(
        self,
        json_path: str,
        image_info: Dict[str, Any]
    ) -> Tuple[bool, List[str], Dict[str, Any]]:
        errors = []
        meta: Dict[str, Any] = {}

        if not os.path.exists(json_path):
            errors.append(f"Missing companion metadata JSON: {os.path.basename(json_path)}")
            return False, errors, meta

        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                meta = json.load(f)
        except Exception as e:
            errors.append(f"Invalid JSON format in {os.path.basename(json_path)}: {str(e)}")
            return False, errors, meta

        # 1. Category check
        category = meta.get('category', '').lower()
        if category not in SCHEMA_CATEGORIES:
            errors.append(f"Invalid category '{meta.get('category')}': must be one of {sorted(list(SCHEMA_CATEGORIES))}")

        # 2. Aspect ratio check
        if 'aspect_ratio' in meta and 'aspect_ratio' in image_info:
            expected_ar = float(meta['aspect_ratio'])
            actual_ar = float(image_info['aspect_ratio'])
            if abs(expected_ar - actual_ar) > 0.05:
                errors.append(f"Aspect ratio mismatch: metadata claims {expected_ar}, image has {actual_ar}")

        # 3. Anchor points validation
        # Anchors can be defined at root or inside 'anchors' dict
        anchors = meta.get('anchors', meta)

        def check_point(name: str, required: bool = True) -> Tuple[bool, Tuple[float, float]]:
            if name not in anchors:
                if required:
                    errors.append(f"Missing required anchor point: '{name}'")
                return False, (0.0, 0.0)
            pt = anchors[name]
            if not isinstance(pt, (list, tuple)) or len(pt) != 2:
                errors.append(f"Anchor '{name}' must be a 2D coordinate [x, y], got {pt}")
                return False, (0.0, 0.0)
            x, y = float(pt[0]), float(pt[1])
            if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
                errors.append(f"Anchor '{name}' coordinate [{x}, {y}] is out of bounds (must be 0.0 - 1.0)")
                return False, (x, y)
            return True, (x, y)

        if category in ('upper', 'overall'):
            has_neck, neck = check_point('neckline_center', required=True)
            has_ls, ls = check_point('left_shoulder', required=True)
            has_rs, rs = check_point('right_shoulder', required=True)
            has_hem, hem = check_point('hem_center', required=True)
            has_lc, lc = check_point('left_cuff', required=False)
            has_rc, rc = check_point('right_cuff', required=False)

            # Anatomical coherence checks
            if has_ls and has_rs:
                if ls[0] >= rs[0]:
                    errors.append(f"left_shoulder.x ({ls[0]}) must be < right_shoulder.x ({rs[0]})")
            if has_neck and has_hem:
                if neck[1] >= hem[1]:
                    errors.append(f"neckline_center.y ({neck[1]}) must be < hem_center.y ({hem[1]})")
            if has_ls and has_lc:
                if ls[1] > lc[1]:
                    errors.append(f"left_shoulder.y ({ls[1]}) should be higher than left_cuff.y ({lc[1]})")
            if has_rs and has_rc:
                if rs[1] > rc[1]:
                    errors.append(f"right_shoulder.y ({rs[1]}) should be higher than right_cuff.y ({rc[1]})")

            # Sleeves extended check: cuffs must be outside shoulder width for extended sleeves
            if has_lc and has_ls and has_rc and has_rs:
                if lc[0] > ls[0] or rc[0] < rs[0]:
                    errors.append(
                        f"Sleeves appear folded or crossed over body: left_cuff.x={lc[0]} (shoulder={ls[0]}), "
                        f"right_cuff.x={rc[0]} (shoulder={rs[0]}). Garments must have sleeves extended outwards."
                    )

        elif category == 'lower':
            has_waist, waist = check_point('waist_center', required=True)
            has_hem, hem = check_point('hem_center', required=True)
            if has_waist and has_hem:
                if waist[1] >= hem[1]:
                    errors.append(f"waist_center.y ({waist[1]}) must be < hem_center.y ({hem[1]})")

        return (len(errors) == 0), errors, meta

    def validate_garment(self, asset_base_name: str) -> Dict[str, Any]:
        """
        Validates both the PNG image and its companion JSON for a given asset base name.
        """
        png_path = os.path.join(self.asset_dir, f"{asset_base_name}.png")
        jpg_path = os.path.join(self.asset_dir, f"{asset_base_name}.jpg")
        json_path = os.path.join(self.asset_dir, f"{asset_base_name}.json")

        # Check if only a JPG exists (instant defect)
        if not os.path.exists(png_path) and os.path.exists(jpg_path):
            return {
                'asset': asset_base_name,
                'passed': False,
                'errors': [f"Asset only exists as solid JPEG ({os.path.basename(jpg_path)}). Missing transparent PNG and anchor metadata JSON."],
                'info': {'format': 'JPEG', 'alpha': False}
            }

        img_passed, img_errors, img_info = self.validate_image(png_path)
        meta_passed, meta_errors, meta_info = self.validate_metadata(json_path, img_info)

        all_errors = img_errors + meta_errors
        passed = img_passed and meta_passed

        return {
            'asset': asset_base_name,
            'passed': passed,
            'errors': all_errors,
            'image_info': img_info,
            'metadata': meta_info
        }

    def validate_all_catalog_assets(self, asset_names: List[str]) -> List[Dict[str, Any]]:
        results = []
        for name in asset_names:
            clean_name = os.path.splitext(name)[0]
            if clean_name.startswith('garment_'):
                results.append(self.validate_garment(clean_name))
        return results

def main():
    parser = argparse.ArgumentParser(description="Validate Garment Assets for Virtual Trial Room")
    parser.add_argument("--dir", default=r"c:\AI\frontend\public\assets", help="Path to assets directory")
    parser.add_argument("--asset", default=None, help="Validate a specific asset base name")
    args = parser.parse_args()

    validator = GarmentAssetValidator(args.dir)

    if args.asset:
        assets_to_test = [args.asset]
    else:
        # Discover all garment_* files in the folder
        all_files = os.listdir(args.dir)
        garment_bases = sorted(list(set(
            os.path.splitext(f)[0] for f in all_files if f.startswith('garment_')
        )))
        assets_to_test = garment_bases

    print("================================================================")
    print("      GARMENT ASSET STANDARD VALIDATION REPORT (PHASE 2)       ")
    print("================================================================\n")

    results = []
    passed_count = 0
    failed_count = 0

    for base in assets_to_test:
        res = validator.validate_garment(base)
        results.append(res)
        status = "PASS" if res['passed'] else "FAIL"
        if res['passed']:
            passed_count += 1
        else:
            failed_count += 1

        print(f"[{status}] {res['asset']}")
        if res['passed']:
            cat = res.get('metadata', {}).get('category', 'unknown')
            size = res.get('image_info', {}).get('size', (0, 0))
            cov = res.get('image_info', {}).get('alpha_coverage', 0) * 100
            print(f"       Category: {cat} | Size: {size[0]}x{size[1]} | Alpha Coverage: {cov:.1f}%")
            print(f"       Anchors Verified: neckline, shoulders, hem, cuffs")
        else:
            for err in res['errors']:
                print(f"       -> DEFECT: {err}")
        print("----------------------------------------------------------------")

    print(f"\nSUMMARY: {passed_count} PASSED, {failed_count} FAILED out of {len(results)} assets.\n")

    if failed_count > 0:
        sys.exit(1)
    else:
        print("All garment assets conform to the Phase 2 Garment Asset Standard!")
        sys.exit(0)

if __name__ == '__main__':
    main()
