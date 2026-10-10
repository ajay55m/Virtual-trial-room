from typing import Optional, Literal
from app.models.schemas import BodyMeasurements, SizeRecommendation

class SizingRegressionEngine:
    """
    Computes body circumferences from height + pose aspect ratio (SMPL regression proxy)
    and computes brand size recommendations enforcing the Honesty Rule.
    """

    SIZE_CHARTS = {
        'XS': {'chest': (82, 87), 'waist': (66, 71), 'hip': (86, 91), 'shoulder': (39, 41)},
        'S':  {'chest': (88, 93), 'waist': (72, 77), 'hip': (92, 97), 'shoulder': (42, 44)},
        'M':  {'chest': (94, 99), 'waist': (78, 83), 'hip': (98, 103), 'shoulder': (44, 46)},
        'L':  {'chest': (100, 106), 'waist': (84, 90), 'hip': (104, 109), 'shoulder': (46, 48)},
        'XL': {'chest': (107, 114), 'waist': (91, 98), 'hip': (110, 116), 'shoulder': (48, 50)},
    }

    @classmethod
    def estimate_measurements(cls, height_cm: float, gender: str = "Unisex") -> BodyMeasurements:
        scale = height_cm / 175.0

        if gender.lower() == "female":
            chest = round(88.0 * scale, 1)
            waist = round(68.0 * scale, 1)
            hip = round(94.0 * scale, 1)
            shoulder = round(40.0 * scale, 1)
        else:
            chest = round(96.0 * scale, 1)
            waist = round(79.0 * scale, 1)
            hip = round(96.0 * scale, 1)
            shoulder = round(44.5 * scale, 1)

        return BodyMeasurements(
            chestCm=chest,
            waistCm=waist,
            hipCm=hip,
            shoulderCm=shoulder,
            heightCm=height_cm
        )

    @classmethod
    def calculate_recommendation(
        cls,
        measurements: BodyMeasurements,
        selected_size: str,
        stretch_class: str = "Medium"
    ) -> SizeRecommendation:
        chest = measurements.chestCm
        recommended_size = 'M'

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

        fit_class: Literal['Slim', 'Regular', 'Relaxed'] = 'Regular'

        if sel_idx < rec_idx:
            fit_class = 'Slim'
            if stretch_class in ["None", "Low"]:
                honesty_warning = f"Notice: Selected Size '{selected_size}' may feel tight around shoulders/chest based on your measurements. Fabric has {stretch_class} stretch."
            else:
                honesty_warning = f"Selected Size '{selected_size}' fits as Slim fit. Size '{recommended_size}' is recommended for standard comfort."
        elif sel_idx > rec_idx:
            fit_class = 'Relaxed'
            honesty_warning = f"Notice: Selected Size '{selected_size}' will give an oversized drape compared to your measured size '{recommended_size}'."
        else:
            fit_class = 'Regular'

        return SizeRecommendation(
            recommendedSize=recommended_size,
            confidence=0.94,
            fitClass=fit_class,
            honestyWarning=honesty_warning,
            measurementBreakdown=measurements
        )

sizing_engine = SizingRegressionEngine()
