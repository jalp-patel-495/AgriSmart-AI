"""
AgriSmart AI – Crop Stress / Health Inference Engine
Loads serialized best_model.pkl and preprocessor.pkl to predict crop health and stress conditions.
"""
import json
from pathlib import Path
from typing import Dict, Any, Union, List, Tuple
import numpy as np
import pandas as pd
import joblib

_CACHED_MODEL = None
_CACHED_PREPROCESSOR = None
_CACHED_CONFIG = None


def get_crop_stress_artifacts() -> Tuple[Any, Any, Dict[str, Any]]:
    """Singleton loader for crop stress model, preprocessor, and configuration."""
    global _CACHED_MODEL, _CACHED_PREPROCESSOR, _CACHED_CONFIG
    if _CACHED_MODEL is not None and _CACHED_PREPROCESSOR is not None:
        return _CACHED_MODEL, _CACHED_PREPROCESSOR, _CACHED_CONFIG

    ai_root = Path(__file__).resolve().parents[2]
    workspace_root = ai_root.parent

    candidate_dirs = [
        workspace_root / "models" / "crop_stress",
        ai_root / "models" / "crop_stress"
    ]

    for model_dir in candidate_dirs:
        model_path = model_dir / "best_model.pkl"
        preprocessor_path = model_dir / "preprocessor.pkl"
        cfg_path = model_dir / "feature_config.json"

        if model_path.exists() and preprocessor_path.exists():
            try:
                _CACHED_MODEL = joblib.load(model_path)
                _CACHED_PREPROCESSOR = joblib.load(preprocessor_path)
                if cfg_path.exists():
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        _CACHED_CONFIG = json.load(f)
                else:
                    _CACHED_CONFIG = {}
                return _CACHED_MODEL, _CACHED_PREPROCESSOR, _CACHED_CONFIG
            except Exception:
                pass

    return None, None, {}


def predict_crop_stress(
    features: Union[Dict[str, Any], pd.DataFrame]
) -> Dict[str, Any]:
    """
    Predicts whether a crop is stressed/unhealthy or healthy based on environmental,
    soil, and remote sensing telemetry.

    Parameters:
        features: Dict or pd.DataFrame containing the features used during training.
                  (Missing non-critical features are gracefully handled with defaults).

    Returns:
        JSON-compatible dictionary:
        {
            "stress_level": "Unhealthy / Stressed" | "Healthy",
            "prediction": "Unhealthy / Stressed" | "Healthy",
            "confidence": float,
            "status": "success" | "low_confidence" | "error"
        }
    """
    model, preprocessor, cfg = get_crop_stress_artifacts()

    if model is None or preprocessor is None:
        return {
            "status": "error",
            "message": "Crop stress model artifacts not found. Please train model using 'python train_crop_stress.py'.",
            "stress_level": None,
            "prediction": None,
            "confidence": 0.0
        }

    all_expected = cfg.get("all_features", [])
    cat_features = cfg.get("categorical_features", ["Crop_Type", "Crop_Growth_Stage", "Field_Boundaries"])
    num_features = cfg.get("numerical_features", [])

    if isinstance(features, dict):
        cleaned = {}
        for feat in all_expected:
            val = features.get(feat)
            if val is None:
                # Case-insensitive / snake-case fallback
                for k, v in features.items():
                    if k.lower().replace("_", "") == feat.lower().replace("_", ""):
                        val = v
                        break

            if val is None:
                # Defaults for missing non-critical telemetry
                if feat in cat_features:
                    val = "Wheat" if feat == "Crop_Type" else "2"
                else:
                    val = 0.0

            if feat in cat_features:
                cleaned[feat] = str(val).strip()
            else:
                cleaned[feat] = float(val)

        df_input = pd.DataFrame([cleaned])
    elif isinstance(features, pd.DataFrame):
        df_input = features.copy()
        for feat in all_expected:
            if feat not in df_input.columns:
                if feat in cat_features:
                    df_input[feat] = "Wheat"
                else:
                    df_input[feat] = 0.0
    else:
        return {
            "status": "error",
            "message": f"Unsupported features type: {type(features)}",
            "stress_level": None,
            "prediction": None,
            "confidence": 0.0
        }

    try:
        # Preprocess features
        X_proc = preprocessor.transform(df_input[all_expected])

        # Inference
        pred_class = int(model.predict(X_proc)[0])
        class_map = {0: "Unhealthy / Stressed", 1: "Healthy"}
        pred_label = class_map.get(pred_class, str(pred_class))

        # Real calibrated confidence calculation via predict_proba()
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X_proc)[0]
            confidence = round(float(probs[pred_class]), 4)
        else:
            confidence = 1.0

        status = "success"
        if confidence < 0.55:
            status = "low_confidence"

        return {
            "stress_level": pred_label,
            "prediction": pred_label,
            "confidence": confidence,
            "status": status
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Inference error: {str(e)}",
            "stress_level": None,
            "prediction": None,
            "confidence": 0.0
        }


if __name__ == "__main__":
    # Test sample
    test_sample = {
        "Crop_Type": "Wheat",
        "Crop_Growth_Stage": 2,
        "Field_Boundaries": 1,
        "Elevation_Data": 25.0,
        "Canopy_Coverage": 45.0,
        "NDVI": 0.65,
        "SAVI": 0.42,
        "Chlorophyll_Content": 0.75,
        "Leaf_Area_Index": 2.8,
        "Temperature": 24.5,
        "Humidity": 65.0,
        "Rainfall": 12.0,
        "Wind_Speed": 3.2,
        "Soil_Moisture": 28.5,
        "Soil_pH": 6.5,
        "Organic_Matter": 2.1,
        "Pest_Hotspots": 0,
        "Weed_Coverage": 3.5,
        "Pest_Damage": 15,
        "Expected_Yield": 3200.0,
        "Water_Flow": 35.0,
        "Drainage_Features": 0,
        "High_Resolution_RGB": 1,
        "Multispectral_Images": 1,
        "Thermal_Images": 0,
        "Temporal_Images": 0,
        "Spatial_Resolution": 1.0
    }
    result = predict_crop_stress(test_sample)
    print("Inference smoke test result:")
    print(json.dumps(result, indent=4))
