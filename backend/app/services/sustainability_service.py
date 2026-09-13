"""
AgriSmart AI – Sustainability Score Service (Bonus Module D)
Provides explainable, transparent, and reproducible sustainability scoring
from Water Efficiency (40%), Resource Use (30%), and Crop Health (30%).
"""
import re
from typing import Dict, Any, Optional, Tuple, List, Union
from pathlib import Path
import pandas as pd

from backend.app.schemas.sustainability import (
    SustainabilityScoreRequest,
    SustainabilityScoreResponse,
    ComponentDetail,
)
from ai.src.crop_recommendation.predict import resolve_crop_alias, _load_global_crop_profiles_and_aliases


# Fallback typical literature NPK values by crop category if not specifically listed in literature
DEFAULT_CATEGORY_NPK = {
    "Pulse": (25.0, 45.0, 25.0),
    "Cereal": (100.0, 50.0, 40.0),
    "Cereal (Pseudo-grain)": (60.0, 40.0, 30.0),
    "Vegetable": (100.0, 60.0, 60.0),
    "Fruit": (80.0, 40.0, 50.0),
    "Oilseed": (60.0, 40.0, 30.0),
    "Spice": (60.0, 40.0, 40.0),
    "Commercial": (120.0, 60.0, 60.0),
    "Fibre": (70.0, 35.0, 35.0),
    "Medicinal/Aromatic": (50.0, 30.0, 30.0),
    "Fodder": (80.0, 40.0, 40.0),
}
GENERAL_FALLBACK_NPK = (80.0, 40.0, 40.0)


def get_crop_reference_npk(crop_name: Optional[str]) -> Tuple[float, float, float, str]:
    """
    Looks up literature N-P-K reference values for a given crop from global_crops.csv / json.
    Returns (N_target, P_target, K_target, resolved_crop_name).
    """
    if not crop_name or not str(crop_name).strip():
        return (*GENERAL_FALLBACK_NPK, "General Agricultural Baseline")

    profiles, aliases = _load_global_crop_profiles_and_aliases()
    raw_name = str(crop_name).strip()
    resolved_name = resolve_crop_alias(raw_name)

    # 1. Search in profiles
    profile = profiles.get(resolved_name.lower()) or profiles.get(raw_name.lower())
    if not profile:
        for k, v in profiles.items():
            if resolved_name.lower() in k or k in resolved_name.lower():
                profile = v
                break

    if profile:
        fert_str = str(profile.get("fertilizer_npk", "") or profile.get("fertilizer_requirements", ""))
        match = re.search(r"(\d+)\s*[-–]\s*(\d+)\s*[-–]\s*(\d+)", fert_str)
        if match:
            n, p, k = float(match.group(1)), float(match.group(2)), float(match.group(3))
            return (n, p, k, profile.get("crop_name", resolved_name))

        # Check category fallback
        cat = profile.get("crop_category", "")
        if cat in DEFAULT_CATEGORY_NPK:
            return (*DEFAULT_CATEGORY_NPK[cat], profile.get("crop_name", resolved_name))

    # 2. Try direct CSV lookup
    try:
        csv_path = Path(__file__).resolve().parents[3] / "data" / "global_crops.csv"
        if csv_path.exists():
            df = pd.read_csv(csv_path)
            row = df[df["crop_name"].str.lower() == resolved_name.lower()]
            if not row.empty:
                fert_str = str(row.iloc[0].get("fertilizer_npk", ""))
                match = re.search(r"(\d+)\s*[-–]\s*(\d+)\s*[-–]\s*(\d+)", fert_str)
                if match:
                    n, p, k = float(match.group(1)), float(match.group(2)), float(match.group(3))
                    return (n, p, k, row.iloc[0]["crop_name"])
                cat = str(row.iloc[0].get("crop_category", ""))
                if cat in DEFAULT_CATEGORY_NPK:
                    return (*DEFAULT_CATEGORY_NPK[cat], row.iloc[0]["crop_name"])
    except Exception:
        pass

    return (*GENERAL_FALLBACK_NPK, resolved_name)


def calculate_water_efficiency(
    irrigation_prediction: Optional[Union[str, bool]],
    rain_probability: Optional[float] = None,
    forecast_precipitation: Optional[float] = None,
    weather_risk: Optional[str] = None,
) -> Tuple[Optional[int], int, str, str]:
    """
    Component A: Water Efficiency (Max 40 points)
    Deterministic Rules:
    - Irrigation NOT required + favorable rainfall/weather: 40 points
    - Irrigation NOT required + normal weather: 35 points
    - Irrigation required + rain likely: 25 points
    - Irrigation required + rain unlikely: 20 points
    - Missing irrigation data: unavailable (None)
    """
    if irrigation_prediction is None:
        return (None, 40, "unavailable", "Data unavailable — missing irrigation prediction.")

    # Normalize prediction
    pred_str = str(irrigation_prediction).strip().upper()
    is_required = pred_str in ["YES", "REQUIRED", "SCHEDULED", "TRUE", "1"]
    is_not_required = pred_str in ["NO", "NOT REQUIRED", "ADEQUATE", "FALSE", "0", "NONE"]

    if not is_required and not is_not_required:
        return (None, 40, "unavailable", f"Data unavailable — unrecognized irrigation prediction '{irrigation_prediction}'.")

    # Assess rain/weather context
    rain_likely = False
    if rain_probability is not None and rain_probability >= 50.0:
        rain_likely = True
    elif forecast_precipitation is not None and forecast_precipitation >= 5.0:
        rain_likely = True

    is_favorable_weather = False
    if rain_probability is not None and rain_probability >= 30.0:
        is_favorable_weather = True
    elif forecast_precipitation is not None and forecast_precipitation > 0.0:
        is_favorable_weather = True
    elif weather_risk is not None and str(weather_risk).strip().upper() == "LOW":
        is_favorable_weather = True

    if is_not_required:
        if is_favorable_weather:
            score = 40
            desc = "Optimal water efficiency: Irrigation not required and favorable atmospheric/rain conditions."
        else:
            score = 35
            desc = "Efficient water management: Irrigation not required under standard weather conditions."
    else:
        if rain_likely:
            score = 25
            desc = "Irrigation is currently indicated, but rain is likely. Delayed/timed scheduling recommended to conserve water."
        else:
            score = 20
            desc = "Irrigation is required under dry weather conditions. Timely application needed to prevent crop water stress."

    return (score, 40, "available", desc)


def calculate_resource_use(
    crop: Optional[str],
    nitrogen: Optional[float],
    phosphorus: Optional[float],
    potassium: Optional[float],
) -> Tuple[Optional[int], int, str, str]:
    """
    Component B: Resource Use (Max 30 points)
    Compares submitted N, P, K against literature profile ranges.
    - Within profile range: 30 points
    - Moderately outside profile range: 20 points
    - Strongly outside profile range: 10 points
    - Missing NPK: unavailable (None)
    """
    if nitrogen is None or phosphorus is None or potassium is None:
        return (None, 30, "unavailable", "Data unavailable — missing Nitrogen, Phosphorus, or Potassium inputs.")

    try:
        n_val = float(nitrogen)
        p_val = float(phosphorus)
        k_val = float(potassium)
    except (ValueError, TypeError):
        return (None, 30, "unavailable", "Data unavailable — NPK values must be numeric.")

    if n_val < 0 or p_val < 0 or k_val < 0:
        return (None, 30, "unavailable", "Data unavailable — NPK values cannot be negative.")

    target_n, target_p, target_k, resolved_crop = get_crop_reference_npk(crop)

    # Compute mean absolute relative deviation from literature reference
    dev_n = abs(n_val - target_n) / max(target_n, 20.0)
    dev_p = abs(p_val - target_p) / max(target_p, 15.0)
    dev_k = abs(k_val - target_k) / max(target_k, 15.0)
    mean_dev = (dev_n + dev_p + dev_k) / 3.0

    if mean_dev <= 0.35:
        score = 30
        desc = f"NPK inputs ({n_val:.0f}-{p_val:.0f}-{k_val:.0f}) are within literature profile range for {resolved_crop} (target: {target_n:.0f}-{target_p:.0f}-{target_k:.0f} kg/ha). Approximate profile-based indicator, not an agronomic prescription."
    elif mean_dev <= 0.75:
        score = 20
        desc = f"NPK inputs ({n_val:.0f}-{p_val:.0f}-{k_val:.0f}) are moderately outside literature profile range for {resolved_crop} (target: {target_n:.0f}-{target_p:.0f}-{target_k:.0f} kg/ha). Approximate profile-based indicator, not an agronomic prescription."
    else:
        score = 10
        desc = f"NPK inputs ({n_val:.0f}-{p_val:.0f}-{k_val:.0f}) are strongly outside literature profile range for {resolved_crop} (target: {target_n:.0f}-{target_p:.0f}-{target_k:.0f} kg/ha). Approximate profile-based indicator, not an agronomic prescription."

    return (score, 30, "available", desc)


def calculate_crop_health(
    disease: Optional[str],
    disease_confidence: Optional[float],
) -> Tuple[Optional[int], int, str, str]:
    """
    Component C: Crop Health (Max 30 points)
    Uses existing Disease Detection result:
    - Healthy with confidence >= 65%: 30 points
    - Disease detected with confidence >= 65%: 10 points
    - Confidence < 65% or missing: unavailable (None)
    """
    if disease is None or disease_confidence is None:
        return (None, 30, "unavailable", "Data unavailable — missing disease diagnosis or confidence score.")

    try:
        conf = float(disease_confidence)
    except (ValueError, TypeError):
        return (None, 30, "unavailable", "Data unavailable — disease confidence must be numeric.")

    # Normalize percentage to 0.0 - 1.0 if passed as 0 - 100
    if conf > 1.0:
        conf = conf / 100.0

    if conf < 0.65:
        return (None, 30, "unavailable", f"Confidence ({conf * 100:.1f}%) < 65% — Diagnosis undetermined; cannot reliably confirm crop health.")

    dis_lower = str(disease).strip().lower()
    is_healthy = "healthy" in dis_lower or dis_lower in ["none", "no disease", "optimal", "clean"]

    if is_healthy:
        score = 30
        desc = f"Healthy crop tissue confirmed with high diagnostic confidence ({conf * 100:.1f}%)."
    else:
        score = 10
        desc = f"Plant pathogen detected ({disease}) with high diagnostic confidence ({conf * 100:.1f}%)."

    return (score, 30, "available", desc)


def compute_sustainability_score(req: SustainabilityScoreRequest) -> SustainabilityScoreResponse:
    """
    Computes deterministic, explainable Sustainability Score (0-100).
    Normalizes across available components when partial data is submitted.
    """
    # 1. Compute each component
    w_score, w_max, w_status, w_desc = calculate_water_efficiency(
        req.irrigation_prediction,
        req.rain_probability,
        req.forecast_precipitation,
        req.weather_risk,
    )

    r_score, r_max, r_status, r_desc = calculate_resource_use(
        req.crop,
        req.nitrogen,
        req.phosphorus,
        req.potassium,
    )

    c_score, c_max, c_status, c_desc = calculate_crop_health(
        req.disease,
        req.disease_confidence,
    )

    components_dict = {
        "water_efficiency": w_score,
        "resource_use": r_score,
        "crop_health": c_score,
    }

    component_details = {
        "water_efficiency": ComponentDetail(
            score=w_score, max_points=w_max, status=w_status, description=w_desc
        ),
        "resource_use": ComponentDetail(
            score=r_score, max_points=r_max, status=r_status, description=r_desc
        ),
        "crop_health": ComponentDetail(
            score=c_score, max_points=c_max, status=c_status, description=c_desc
        ),
    }

    # 2. Check available points & calculate overall score
    available_earned = 0
    available_max = 0
    available_count = 0

    for score, max_pts in [(w_score, w_max), (r_score, r_max), (c_score, c_max)]:
        if score is not None:
            available_earned += score
            available_max += max_pts
            available_count += 1

    suggestions: List[str] = []

    # 3. Handle 0 components available
    if available_max == 0:
        return SustainabilityScoreResponse(
            status="success",
            sustainability_score=None,
            level="Data Unavailable",
            components=components_dict,
            component_details=component_details,
            available_data=False,
            is_normalized=False,
            data_note="Data unavailable — please provide irrigation, NPK soil nutrients, or leaf diagnosis to generate score.",
            suggestions=["Provide soil test, irrigation, or leaf diagnostic data to evaluate farm sustainability."],
        )

    # 4. Normalization across available components
    is_normalized = available_max < 100
    if is_normalized:
        final_score = int(round((available_earned / available_max) * 100.0))
        data_note = f"Score based on available data ({available_count} of 3 components evaluated and normalized to 100)."
    else:
        final_score = int(round(available_earned))
        data_note = "Score based on complete farm data (all 3 components evaluated)."

    # Clamp strictly between 0 and 100
    final_score = max(0, min(100, final_score))

    # 5. Score level classification
    if final_score >= 80:
        level = "Excellent"
    elif final_score >= 60:
        level = "Good"
    elif final_score >= 40:
        level = "Moderate"
    else:
        level = "Needs Improvement"

    # 6. Generate targeted improvement suggestions ONLY for actual low-scoring components
    if w_score is not None and w_score <= 25:
        suggestions.append("Review irrigation timing and consider forecast rainfall before irrigating.")

    if r_score is not None and r_score <= 20:
        suggestions.append("Review NPK inputs against the selected crop profile.")

    if c_score is not None and c_score <= 10:
        suggestions.append("Monitor crop health and inspect affected leaves.")

    if not suggestions and final_score >= 80:
        suggestions.append("Maintain current balanced irrigation, nutrient management, and crop monitoring.")

    return SustainabilityScoreResponse(
        status="success",
        sustainability_score=final_score,
        level=level,
        components=components_dict,
        component_details=component_details,
        available_data=True,
        is_normalized=is_normalized,
        data_note=data_note,
        suggestions=suggestions,
    )
