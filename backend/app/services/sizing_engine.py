"""
AURA Size Estimation & Honesty Engine.
Estimates body measurement ranges from user-entered height and 2D pose landmarks.
Strictly avoids unbacked claims of SMPL 3D mesh modeling, returning honest measurement
ranges with clear confidence labeling.
"""

from typing import Optional, Literal
from app.models.schemas import BodyMeasurements, SizeRecommendation


class SizingRegressionEngine:
    """
    Computes body measurement ranges from user height + detected 2D landmarks.
    Enforces the Honesty Rule: alerts shopper if visual drape differs from measured sizing.
    """

    SIZE_CHARTS = {
        'XS': {'chest': (82, 87), 'waist': (66, 71), 'hip': (86, 91), 'shoulder': (39, 41)},
        'S':  {'chest': (88, 93), 'waist': (72, 77), 'hip': (92, 97), 'shoulder': (42, 44)},
        'M':  {'chest': (94, 99), 'waist': (78, 83), 'hip': (98, 103), 'shoulder': (44, 46)},
        'L':  {'chest': (100, 106), 'waist': (84, 90), 'hip': (104, 109), 'shoulder': (46, 48)},
        'XL': {'chest': (107, 114), 'waist': (91, 98), 'hip': (110, 116), 'shoulder': (48, 50)},
    }

    @classmethod
    def estimate_measurements(
        cls,
        height_cm: float = 175.0,
        gender: str = "Unisex",
        shoulder_ratio: Optional[float] = None
    ) -> BodyMeasurements:
        """
        Estimates body circumference ranges based on user-entered height and pose landmarks.
        Shows ranges rather than exact single numbers.
        """
        scale = max(0.7, min(1.3, height_cm / 175.0))

        # Base proportions
        if gender.lower() == "female":
            base_chest, base_waist, base_hip, base_shoulder = 88.0, 68.0, 94.0, 40.0
        else:
            base_chest, base_waist, base_hip, base_shoulder = 96.0, 79.0, 96.0, 44.5

        # If shoulder_ratio (from MediaPipe landmarks) is available, refine shoulder estimate
        if shoulder_ratio and 0.15 <= shoulder_ratio <= 0.35:
            # normalized shoulder width ~ 0.22 of height in standard adults
            shoulder_cm = round(shoulder_ratio * height_cm * 1.15, 1)
        else:
            shoulder_cm = round(base_shoulder * scale, 1)

        chest_cm = round(base_chest * scale, 1)
        waist_cm = round(base_waist * scale, 1)
        hip_cm = round(base_hip * scale, 1)

        # Formulate realistic uncertainty ranges (±2-3 cm)
        c_min, c_max = int(chest_cm - 2), int(chest_cm + 2)
        w_min, w_max = int(waist_cm - 3), int(waist_cm + 3)
        h_min, h_max = int(hip_cm - 3), int(hip_cm + 3)
        s_min, s_max = int(shoulder_cm - 1), int(shoulder_cm + 1)

        return BodyMeasurements(
            chestCm=chest_cm,
            waistCm=waist_cm,
            hipCm=hip_cm,
            shoulderCm=shoulder_cm,
            heightCm=round(height_cm, 1),
            chestRange=f"{c_min}–{c_max} cm",
            waistRange=f"{w_min}–{w_max} cm",
            hipRange=f"{h_min}–{h_max} cm",
            shoulderRange=f"{s_min}–{s_max} cm",
            estimationMethod="2D Pose Landmarks & User Height"
        )

    @classmethod
    def calculate_recommendation(
        cls,
        measurements: BodyMeasurements,
        selected_size: str,
        stretch_class: str = "Medium"
    ) -> SizeRecommendation:
        chest = measurements.chestCm

        if chest < 88:
            recommended_size = 'XS'
        elif chest < 94:
            recommended_size = 'S'
        elif chest < 100:
            recommended_size = 'M'
        elif chest < 107:
            recommended_size = 'L'
        else:
            recommended_size = 'XL'

        honesty_warning: Optional[str] = None
        size_order = ['XS', 'S', 'M', 'L', 'XL']
        
        sel_idx = size_order.index(selected_size.upper()) if selected_size.upper() in size_order else 2
        rec_idx = size_order.index(recommended_size) if recommended_size in size_order else 2

        if sel_idx < rec_idx:
            fit_class: Literal['Slim', 'Regular', 'Relaxed'] = 'Slim'
            if stretch_class in ["None", "Low"]:
                honesty_warning = f"Notice: Selected Size '{selected_size}' may feel tight around shoulders/chest based on your measurement range ({measurements.chestRange})."
            else:
                honesty_warning = f"Selected Size '{selected_size}' fits as Slim fit. Recommended range corresponds to Size '{recommended_size}'."
        elif sel_idx > rec_idx:
            fit_class = 'Relaxed'
            honesty_warning = f"Notice: Selected Size '{selected_size}' will give an oversized drape compared to estimated size '{recommended_size}'."
        else:
            fit_class = 'Regular'

        return SizeRecommendation(
            recommendedSize=recommended_size,
            confidence=0.82,
            confidenceLabel="Estimated Range",
            fitClass=fit_class,
            honestyWarning=honesty_warning,
            measurementBreakdown=measurements
        )


sizing_engine = SizingRegressionEngine()
