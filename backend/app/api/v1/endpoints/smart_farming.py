"""
FastAPI Endpoints for Phase 8: Smart Irrigation and Crop Recommendation
"""
import json
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.db.database import get_db, init_db
from backend.app.db.models import IrrigationLog, CropRecommendationRecord, IoTSensorReading
from backend.app.schemas.smart_farming import (
    IrrigationRequest,
    IrrigationAdvisoryResponse,
    IoTTelemetryFeed,
    CropRecommendationRequest,
    CropRecommendationResponse,
    SoilPreset,
)
from backend.app.services.irrigation_service import (
    calculate_smart_irrigation,
    get_simulated_iot_feed,
)
from backend.app.services.crop_recommender_service import (
    predict_top_crops,
    SOIL_PRESETS,
    get_crops_catalog_service,
    load_recommender_model,
)

router = APIRouter(prefix="/smart-farming", tags=["Smart Farming & Irrigation"])

# Ensure DB schema and model are initialized
init_db()
load_recommender_model()


@router.post("/irrigation-advisory", response_model=IrrigationAdvisoryResponse)
def get_irrigation_advisory(
    req: IrrigationRequest,
    db: Session = Depends(get_db)
):
    """
    Computes physics-based crop water deficit and irrigation recommendation (FAO-56).
    Persists decision record to the database.
    """
    advisory = calculate_smart_irrigation(req)

    # Persist log to DB
    try:
        log_entry = IrrigationLog(
            crop_name=req.crop,
            soil_type=req.soil_type,
            field_size_hectares=req.field_size_hectares,
            moisture_15cm=req.moisture_15cm,
            moisture_30cm=req.moisture_30cm,
            ambient_temp=req.ambient_temp,
            relative_humidity=req.humidity,
            rain_forecast_mm=req.rain_forecast_mm,
            status=advisory.status,
            water_amount_litres_per_ha=advisory.water_amount_litres_per_ha,
            drip_duration_mins=advisory.drip_duration_minutes,
            explanation=advisory.action_required,
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[!] Warning: Failed to persist irrigation log to DB: {e}")

    return advisory


@router.get("/iot-telemetry", response_model=IoTTelemetryFeed)
def get_iot_telemetry(
    scenario: str = Query("normal", description="'normal', 'drought', or 'waterlogged'")
):
    """
    Retrieves live simulated IoT field sensor telemetry and 24-hour time-series trends.
    """
    return get_simulated_iot_feed(scenario)


@router.post("/recommend-crop", response_model=CropRecommendationResponse)
def get_crop_recommendations(
    req: CropRecommendationRequest,
    db: Session = Depends(get_db)
):
    """
    Predicts optimal crops based on soil N-P-K, pH, temperature, humidity, and rainfall
    using the trained Random Forest Classifier. Persists record to the database.
    """
    recommendations = predict_top_crops(req)

    # Persist log to DB
    try:
        top1 = recommendations.top_recommendations[0].crop if len(recommendations.top_recommendations) > 0 else "None"
        conf1 = recommendations.top_recommendations[0].confidence_score if len(recommendations.top_recommendations) > 0 else 0.0
        top2 = recommendations.top_recommendations[1].crop if len(recommendations.top_recommendations) > 1 else None
        conf2 = recommendations.top_recommendations[1].confidence_score if len(recommendations.top_recommendations) > 1 else None
        top3 = recommendations.top_recommendations[2].crop if len(recommendations.top_recommendations) > 2 else None
        conf3 = recommendations.top_recommendations[2].confidence_score if len(recommendations.top_recommendations) > 2 else None

        rec_entry = CropRecommendationRecord(
            nitrogen=req.nitrogen,
            phosphorus=req.phosphorus,
            potassium=req.potassium,
            ph=req.ph,
            temperature=req.temperature,
            humidity=req.humidity,
            rainfall=req.rainfall,
            top_crop_1=top1,
            confidence_1=conf1,
            top_crop_2=top2,
            confidence_2=conf2,
            top_crop_3=top3,
            confidence_3=conf3,
        )
        db.add(rec_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[!] Warning: Failed to persist crop recommendation to DB: {e}")

    return recommendations


@router.get("/soil-presets", response_model=List[SoilPreset])
def get_soil_presets():
    """
    Returns pre-configured agro-climatic zones across agricultural regions.
    """
    return SOIL_PRESETS


@router.get("/crops-catalog")
def get_crops_catalog():
    """
    Returns the complete list of 95 supported crop classes and their literature profiles.
    """
    return get_crops_catalog_service()


@router.get("/history")
def get_advisory_history(db: Session = Depends(get_db)):
    """
    Returns recent irrigation logs and crop recommendations from PostgreSQL / SQLite.
    """
    try:
        irrigation_history = db.query(IrrigationLog).order_by(IrrigationLog.id.desc()).limit(10).all()
        crop_history = db.query(CropRecommendationRecord).order_by(CropRecommendationRecord.id.desc()).limit(10).all()

        return {
            "irrigation_logs": [
                {
                    "id": log.id,
                    "crop": log.crop_name,
                    "soil": log.soil_type,
                    "status": log.status,
                    "water_litres_per_ha": log.water_amount_litres_per_ha,
                    "drip_mins": log.drip_duration_mins,
                    "moisture_15cm": log.moisture_15cm,
                    "created_at": log.created_at.strftime("%Y-%m-%d %H:%M") if log.created_at else ""
                }
                for log in irrigation_history
            ],
            "crop_recommendations": [
                {
                    "id": r.id,
                    "top_crop": r.top_crop_1,
                    "confidence": f"{r.confidence_1 * 100:.1f}%",
                    "n_p_k": f"{r.nitrogen:.0f}-{r.phosphorus:.0f}-{r.potassium:.0f}",
                    "ph": r.ph,
                    "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else ""
                }
                for r in crop_history
            ]
        }
    except Exception as e:
        print(f"[!] History query error: {e}")
        return {"irrigation_logs": [], "crop_recommendations": []}


@router.get("/crop-training-means")
def get_crop_training_means():
    """
    Returns training-data-derived mean feature values per crop (all 95 crops).
    These means are computed from the actual crop_training_data.csv used to train the 95-class model.
    Use these as representative 'Test This Crop' parameters — they reflect the actual
    feature distribution the model learned from, unlike crude catalog midpoints.
    """
    # Navigate 6 levels up from backend/app/api/v1/endpoints/smart_farming.py to project root
    curr = os.path.abspath(__file__)
    for _ in range(6):
        curr = os.path.dirname(curr)
    means_path = os.path.join(curr, "data", "crop_training_means.json")
    if not os.path.exists(means_path):
        means_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))), "data", "crop_training_means.json")
    if not os.path.exists(means_path):
        means_path = os.path.join(os.getcwd(), "data", "crop_training_means.json")

    if os.path.exists(means_path):
        try:
            with open(means_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[!] Error reading crop_training_means.json: {e}")
    return {}
