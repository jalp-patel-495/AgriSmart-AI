"""
AgriSmart AI – Farm Sustainability & Ecological Resilience Scoring Engine
Calculates a transparent 0-100 score with granular sub-pillar breakdowns.
"""
from typing import Dict, Any, List, Optional


def calculate_sustainability_score(
    soil_health_val: float = 85.0,        # 0-100
    water_efficiency_val: float = 80.0,   # 0-100
    crop_health_val: float = 90.0,        # 0-100
    resource_efficiency_val: float = 75.0, # 0-100
    weights: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Computes weighted sustainability rating and generates agronomic optimization suggestions.
    """
    if weights is None:
        weights = {
            "soil": 0.30,
            "water": 0.30,
            "crop": 0.25,
            "resource": 0.15
        }

    # Normalize values between 0 and 100
    s_val = max(0.0, min(100.0, float(soil_health_val)))
    w_val = max(0.0, min(100.0, float(water_efficiency_val)))
    c_val = max(0.0, min(100.0, float(crop_health_val)))
    r_val = max(0.0, min(100.0, float(resource_efficiency_val)))

    total_score = (
        s_val * weights.get("soil", 0.3) +
        w_val * weights.get("water", 0.3) +
        c_val * weights.get("crop", 0.25) +
        r_val * weights.get("resource", 0.15)
    )
    total_score = round(total_score, 1)

    if total_score >= 85.0:
        category = "Exemplary Eco-Regenerative"
    elif total_score >= 70.0:
        category = "Sustainable & Efficient"
    elif total_score >= 50.0:
        category = "Moderate – Improvement Needed"
    else:
        category = "Critical Ecological Deficit"

    suggestions: List[str] = []
    if w_val < 70.0:
        suggestions.append("Adopt sensor-guided drip irrigation to curb evaporative water losses.")
    if s_val < 70.0:
        suggestions.append("Incorporate cover cropping (legumes) and bio-compost to increase soil organic carbon.")
    if c_val < 70.0:
        suggestions.append("Apply proactive biological IPM scouting to address foliar blights early.")
    if r_val < 70.0:
        suggestions.append("Calibrate precision fertilizer application based on periodic NPK soil lab tests.")

    if not suggestions:
        suggestions.append("Maintain existing balanced agronomic management practices.")

    return {
        "score": total_score,
        "category": category,
        "soil_health": s_val,
        "water_efficiency": w_val,
        "crop_health": c_val,
        "resource_efficiency": r_val,
        "weights_applied": weights,
        "improvement_suggestions": suggestions
    }
