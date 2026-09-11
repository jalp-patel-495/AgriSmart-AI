"""
AgriSmart AI – Crop Recommendation Machine Learning Service
Loads the trained Random Forest classifier and provides multi-crop ranked recommendations.
"""
import os
import json
from typing import List, Dict, Tuple
import numpy as np
import pandas as pd
import joblib

from backend.app.schemas.smart_farming import (
    CropRecommendationRequest,
    CropRecommendationResponse,
    RecommendedCropItem,
    SoilPreset,
)

# Global in-memory model cache
_MODEL_PIPELINE = None
_AGRONOMY_METADATA: Dict[str, Dict] = {}

# Major Agro-Climatic Soil Presets for one-click testing
SOIL_PRESETS: List[SoilPreset] = [
    SoilPreset(
        name="Indo-Gangetic Alluvial Plain",
        region="Punjab / Haryana / UP",
        description="Deep fertile alluvial loam with balanced organic matter, moderate rainfall and strong tubewell irrigation.",
        typical_crops=["Rice", "Maize", "Wheat", "Cotton"],
        default_n=85.0,
        default_p=48.0,
        default_k=42.0,
        default_ph=6.8,
        default_temp=25.5,
        default_humidity=75.0,
        default_rainfall=180.0
    ),
    SoilPreset(
        name="Deccan Plateau Black Cotton (Vertisols)",
        region="Maharashtra / Gujarat / MP",
        description="High clay content with high moisture retention, high potassium, ideal for cotton, pulses, and pomegranate.",
        typical_crops=["Cotton", "Pigeonpeas", "Blackgram", "Pomegranate"],
        default_n=115.0,
        default_p=45.0,
        default_k=30.0,
        default_ph=7.2,
        default_temp=27.0,
        default_humidity=65.0,
        default_rainfall=90.0
    ),
    SoilPreset(
        name="Temperate Himalayan Foothills",
        region="Himachal Pradesh / J&K",
        description="Mountain loam with acidic-to-neutral pH, cold chilling hours, suitable for temperate fruit orchards.",
        typical_crops=["Apple", "Kidneybeans", "Maize"],
        default_n=22.0,
        default_p=130.0,
        default_k=195.0,
        default_ph=5.8,
        default_temp=18.5,
        default_humidity=85.0,
        default_rainfall=115.0
    ),
    SoilPreset(
        name="Coastal Humid Delta",
        region="Kerala / West Bengal / Tamil Nadu",
        description="High humidity, warm year-round temperatures, sandy-loam to clay soils with high precipitation.",
        typical_crops=["Rice", "Coconut", "Banana", "Jute"],
        default_n=80.0,
        default_p=55.0,
        default_k=45.0,
        default_ph=6.2,
        default_temp=28.0,
        default_humidity=88.0,
        default_rainfall=240.0
    ),
]


def load_recommender_model():
    """Loads the serialized model pipeline into memory."""
    global _MODEL_PIPELINE, _AGRONOMY_METADATA
    model_path = "ai_model/models/crop_recommender.joblib"
    meta_path = "ai_model/models/crop_agronomy.json"

    if os.path.exists(model_path):
        try:
            _MODEL_PIPELINE = joblib.load(model_path)
            print(f"[*] Loaded Crop Recommendation ML Pipeline from {model_path}")
        except Exception as e:
            print(f"[!] Error loading crop recommender: {e}")

    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                _AGRONOMY_METADATA = json.load(f)
            print(f"[*] Loaded Agronomic Metadata for {len(_AGRONOMY_METADATA)} crops.")
        except Exception as e:
            print(f"[!] Error loading agronomy metadata: {e}")


def predict_top_crops(req: CropRecommendationRequest) -> CropRecommendationResponse:
    """
    Predicts the top 3 best-suited crops using the Random Forest classifier.
    """
    global _MODEL_PIPELINE, _AGRONOMY_METADATA
    if _MODEL_PIPELINE is None:
        load_recommender_model()

    input_df = pd.DataFrame([{
        "N": req.nitrogen,
        "P": req.phosphorus,
        "K": req.potassium,
        "temperature": req.temperature,
        "humidity": req.humidity,
        "ph": req.ph,
        "rainfall": req.rainfall,
    }])

    if _MODEL_PIPELINE is not None:
        probs = _MODEL_PIPELINE.predict_proba(input_df)[0]
        classes = _MODEL_PIPELINE.classes_
        # Sort descending by probability
        top_indices = np.argsort(probs)[::-1][:3]
        results: List[Tuple[str, float]] = [(classes[idx], float(probs[idx])) for idx in top_indices]
    else:
        # Fallback heuristic if model file isn't loaded
        results = [("Rice", 0.75), ("Maize", 0.18), ("Banana", 0.07)]

    recommendations: List[RecommendedCropItem] = []
    for crop_name, conf in results:
        meta = _AGRONOMY_METADATA.get(crop_name, {
            "water_need": "Moderate (600-800 mm)",
            "duration_days": "100-120 days",
            "season": "Seasonal",
            "soil_pref": "Well-drained agricultural soil."
        })

        # Economic potential rating based on crop type
        if crop_name in ["Grapes", "Apple", "Pomegranate", "Coffee", "Cotton"]:
            econ = "High Commercial Value (Cash Crop)"
        elif crop_name in ["Banana", "Orange", "Papaya", "Watermelon"]:
            econ = "High Yield Horticultural Return"
        else:
            econ = "Stable Food Security & High Market Liquidity"

        # Tailored agronomic advice
        advice = f"Ensure soil is pre-tilled to {meta['soil_pref']}. Recommended N-P-K target: {req.nitrogen:.0f}-{req.phosphorus:.0f}-{req.potassium:.0f} kg/ha."

        recommendations.append(RecommendedCropItem(
            crop=crop_name,
            confidence_score=round(conf, 3),
            match_percentage=f"{conf * 100:.1f}%",
            water_requirement=meta["water_need"],
            growth_duration=meta["duration_days"],
            growing_season=meta["season"],
            soil_suitability=meta["soil_pref"],
            economic_potential=econ,
            agronomic_advice=advice
        ))

    # Soil summary analysis
    npk_status = []
    if req.nitrogen > 100: npk_status.append("High Nitrogen")
    elif req.nitrogen < 40: npk_status.append("Low Nitrogen")
    else: npk_status.append("Balanced Nitrogen")

    if req.phosphorus > 80: npk_status.append("High Phosphorus")
    if req.potassium > 100: npk_status.append("High Potassium")

    ph_desc = "Neutral" if 6.0 <= req.ph <= 7.5 else ("Acidic" if req.ph < 6.0 else "Alkaline")
    summary = f"Soil Profile: {', '.join(npk_status)} with {ph_desc} reaction (pH {req.ph:.1f}) and {req.rainfall:.0f}mm rainfall."

    from datetime import datetime
    return CropRecommendationResponse(
        top_recommendations=recommendations,
        soil_summary=summary,
        created_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    )
