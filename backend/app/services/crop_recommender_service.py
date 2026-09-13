"""
AgriSmart AI – Crop Recommendation Machine Learning Service
Provides 95-crop multi-recommendation modeling using trained ensemble classifier
and rich agronomic metadata from global_crops dataset.
"""
import os
import json
from typing import List, Dict, Tuple, Any
from datetime import datetime
import numpy as np
import pandas as pd
import joblib

from backend.app.schemas.smart_farming import (
    CropRecommendationRequest,
    CropRecommendationResponse,
    RecommendedCropItem,
    SoilPreset,
)
from ai.src.crop_recommendation.predict import (
    predict_crop,
    get_crop_profile_metadata,
    _load_global_crop_profiles_and_aliases,
)

def load_recommender_model():
    """Compatibility shim for legacy callers."""
    pass

# Major Agro-Climatic Soil Presets for one-click testing
SOIL_PRESETS: List[SoilPreset] = [
    SoilPreset(
        name="Indo-Gangetic Alluvial Plain",
        region="Punjab / Haryana / UP",
        description="Deep fertile alluvial loam with balanced organic matter, moderate rainfall and strong tubewell irrigation.",
        typical_crops=["Rice", "Maize / Corn", "Wheat", "Cotton"],
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
        typical_crops=["Cotton", "Pigeon Pea", "Black Gram", "Pomegranate"],
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
        typical_crops=["Apple", "Kidney Bean", "Maize / Corn", "Peach"],
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


def predict_top_crops(req: CropRecommendationRequest) -> CropRecommendationResponse:
    """
    Predicts the top 3 best-suited crops using the 95-class ensemble classifier,
    enriched with real model probability scores and literature crop profiles.
    """
    input_payload = {
        "N": req.nitrogen,
        "P": req.phosphorus,
        "K": req.potassium,
        "temperature": req.temperature,
        "humidity": req.humidity,
        "ph": req.ph,
        "rainfall": req.rainfall,
    }

    pred_res = predict_crop(input_payload, model_version="95class")

    top_3_items = pred_res.get("top_3", [])
    if not top_3_items and pred_res.get("recommended_crop"):
        top_3_items = [{"crop": pred_res["recommended_crop"], "confidence": pred_res.get("confidence", 0.75), "rank": 1}]

    recommendations: List[RecommendedCropItem] = []
    for item in top_3_items:
        crop_name = item.get("crop", "Rice")
        conf = float(item.get("confidence", 0.0))

        meta = get_crop_profile_metadata(crop_name)

        # Economic potential category
        cat = meta.get("crop_category", "")
        if "Commercial" in cat or "Plantation" in cat or "Spice" in cat or crop_name in ["Grape", "Apple", "Pomegranate", "Coffee (Arabica)", "Cotton", "Saffron", "Cardamom"]:
            econ = "High Commercial Value (Cash Crop / Export)"
        elif "Fruit" in cat or crop_name in ["Banana", "Orange", "Papaya", "Watermelon", "Mango"]:
            econ = "High Yield Horticultural Return"
        elif "Medicinal" in cat:
            econ = "High Value Ayurvedic & Herbal Market"
        else:
            econ = "Stable Food Security & High Market Liquidity"

        # Tailored agronomic advice based on user inputs
        water_req = meta.get("water_requirement", "Moderate")
        ph_range = meta.get("preferred_ph", "6.0 - 7.5")
        season = meta.get("growing_season", "Seasonal")

        advice = (
            f"Pre-till soil to {meta.get('soil_types', 'well-drained loam')}. "
            f"Growing season: {season}. Preferred pH: {ph_range}. "
            f"Water requirement: {water_req}. Recommended N-P-K target: "
            f"{req.nitrogen:.0f}-{req.phosphorus:.0f}-{req.potassium:.0f} kg/ha."
        )

        recommendations.append(RecommendedCropItem(
            crop=crop_name,
            confidence_score=round(conf, 4),
            match_percentage=f"{conf * 100:.1f}%",
            water_requirement=water_req,
            growth_duration=season,
            growing_season=season,
            soil_suitability=meta.get("soil_types", "Well-drained agricultural soil"),
            economic_potential=econ,
            agronomic_advice=advice,
            scientific_name=meta.get("scientific_name"),
            crop_category=meta.get("crop_category"),
            hindi_name=meta.get("hindi_name"),
            gujarati_name=meta.get("gujarati_name"),
            temperature_range=meta.get("temperature_range"),
            rainfall_range=meta.get("rainfall_range"),
            preferred_ph=ph_range,
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

    return CropRecommendationResponse(
        top_recommendations=recommendations,
        soil_summary=summary,
        created_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    )


def get_crops_catalog_service() -> List[Dict[str, Any]]:
    """
    Returns the complete list of 95 crops with literature metadata for dynamic frontend UI.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    csv_path = os.path.join(base_dir, "data", "global_crops.csv")

    if os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
            catalog = []
            for _, row in df.iterrows():
                catalog.append({
                    "crop_id": str(row.get("crop_id", "")),
                    "crop_name": str(row.get("crop_name", "")),
                    "scientific_name": str(row.get("scientific_name", "")),
                    "crop_category": str(row.get("crop_category", "")),
                    "sub_category": str(row.get("sub_category", "")),
                    "growing_season": str(row.get("growing_season", "")),
                    "ph_min": float(row.get("ph_min", 6.0)),
                    "ph_max": float(row.get("ph_max", 7.5)),
                    "temperature_min_c": float(row.get("temperature_min_c", 15.0)),
                    "temperature_max_c": float(row.get("temperature_max_c", 35.0)),
                    "rainfall_min_mm": float(row.get("rainfall_min_mm", 400.0)),
                    "rainfall_max_mm": float(row.get("rainfall_max_mm", 1200.0)),
                    "water_requirement": str(row.get("water_requirement", "Moderate")),
                    "hindi_name": str(row.get("hindi_name", "")),
                    "gujarati_name": str(row.get("gujarati_name", "")),
                    "data_confidence": str(row.get("data_confidence", "approximate_literature_typical")),
                })
            return catalog
        except Exception as e:
            print(f"[!] Error reading global_crops.csv: {e}")

    # Fallback to in-memory profile keys
    profiles, _ = _load_global_crop_profiles_and_aliases()
    return list(profiles.values()) if profiles else []
