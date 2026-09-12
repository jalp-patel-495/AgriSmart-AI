"""
AgriSmart AI – Smart Irrigation Inference Engine
Loads serialized best_model.pkl and preprocessor.pkl to predict real-time irrigation requirements.
"""
import json
from pathlib import Path
from typing import Dict, Any, Union, List, Tuple
import numpy as np
import pandas as pd
import joblib

_CACHED_MODEL = None
_CACHED_PREPROCESSOR = None
_CACHED_FEATURE_CONFIG = None


def get_irrigation_artifacts() -> Tuple[Any, Any, Dict[str, Any]]:
    """Singleton loader for model, preprocessor, and feature config."""
    global _CACHED_MODEL, _CACHED_PREPROCESSOR, _CACHED_FEATURE_CONFIG
    if _CACHED_MODEL is not None and _CACHED_PREPROCESSOR is not None:
        return _CACHED_MODEL, _CACHED_PREPROCESSOR, _CACHED_FEATURE_CONFIG

    ai_root = Path(__file__).resolve().parents[2]
    workspace_root = ai_root.parent

    candidate_dirs = [
        workspace_root / "models" / "irrigation",
        ai_root / "models" / "irrigation"
    ]

    for model_dir in candidate_dirs:
        model_path = model_dir / "best_model.pkl"
        scaler_path = model_dir / "preprocessor.pkl"
        cfg_path = model_dir / "feature_config.json"

        if model_path.exists() and scaler_path.exists():
            try:
                _CACHED_MODEL = joblib.load(model_path)
                _CACHED_PREPROCESSOR = joblib.load(scaler_path)
                if cfg_path.exists():
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        _CACHED_FEATURE_CONFIG = json.load(f)
                else:
                    _CACHED_FEATURE_CONFIG = {
                        "features": ["soil_moisture", "temperature", "humidity"]
                    }
                return _CACHED_MODEL, _CACHED_PREPROCESSOR, _CACHED_FEATURE_CONFIG
            except Exception:
                pass

    return None, None, {}


def calculate_irrigation_priority(prediction_yes: bool, confidence: float) -> str:
    """
    Transparent Priority Mapping Rule:
    - Prediction == YES:
        - High Confidence (>= 0.85) -> HIGH
        - Medium Confidence (0.65 to 0.84) -> MEDIUM
        - Low Confidence (< 0.65) -> LOW / REVIEW
    - Prediction == NO:
        - Moisture adequate -> NONE
    """
    if not prediction_yes:
        return "NONE"

    if confidence >= 0.85:
        return "HIGH"
    elif confidence >= 0.65:
        return "MEDIUM"
    else:
        return "LOW / REVIEW"


def predict_irrigation(
    features: Union[Dict[str, Any], List[float], Tuple[float, ...]]
) -> Dict[str, Any]:
    """
    Predicts whether irrigation is required based on IoT soil and environmental telemetry.

    Parameters:
        features: Dict with keys 'soil_moisture', 'temperature', 'humidity'
                  (Accepts case-insensitive and alternative sensor aliases, e.g., 'Moisture(%)')
                  Or List/Tuple in feature order: [soil_moisture, temperature, humidity]

    Returns:
        JSON-compatible dictionary:
        {
            "irrigation_required": bool,
            "prediction": "YES" | "NO",
            "confidence": float,
            "priority": "HIGH" | "MEDIUM" | "LOW / REVIEW" | "NONE",
            "status": "success"
        }
    """
    model, preprocessor, cfg = get_irrigation_artifacts()

    if model is None or preprocessor is None:
        return {
            "status": "error",
            "message": "Irrigation model artifacts not found. Please train model using 'python train_irrigation.py'.",
            "irrigation_required": None,
            "prediction": None,
            "confidence": 0.0,
            "priority": "UNKNOWN"
        }

    expected_features = cfg.get("features", ["soil_moisture", "temperature", "humidity"])

    # Extract input values into structured vector
    if isinstance(features, dict):
        # Alias map for flexible sensor naming
        alias_map = {
            "soil_moisture": ["soil_moisture", "moisture", "moisture(%)", "soilmoist", "soilmiosture", "sm"],
            "temperature": ["temperature", "temperature(c)", "temp", "ambient_temp", "t"],
            "humidity": ["humidity", "humidity(%)", "humid", "rh", "h"]
        }

        feature_values = []
        for feat in expected_features:
            val = None
            # Direct match
            if feat in features:
                val = features[feat]
            else:
                # Check aliases
                possible_aliases = alias_map.get(feat, [feat])
                for alias in possible_aliases:
                    for k, v in features.items():
                        if k.lower().replace(" ", "_") == alias:
                            val = v
                            break
                    if val is not None:
                        break

            if val is None:
                # Fallback to 0.0 if missing
                val = 0.0
            feature_values.append(float(val))

        vector = np.array([feature_values], dtype=float)
    elif isinstance(features, (list, tuple)):
        vector = np.array([features[:len(expected_features)]], dtype=float)
    else:
        return {
            "status": "error",
            "message": f"Unsupported features input type: {type(features)}",
            "irrigation_required": None,
            "prediction": None,
            "confidence": 0.0,
            "priority": "UNKNOWN"
        }

    try:
        # Scale inputs using preprocessor fitted on training set
        df_input = pd.DataFrame([feature_values], columns=expected_features)
        vector_scaled = preprocessor.transform(df_input)

        # Model inference
        pred_class = int(model.predict(vector_scaled)[0])
        prediction_str = "YES" if pred_class == 1 else "NO"
        is_required = bool(pred_class == 1)

        # Calibrated confidence computation via predict_proba
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(vector_scaled)[0]
            confidence = float(probs[pred_class])
        else:
            confidence = 1.0

        priority = calculate_irrigation_priority(is_required, confidence)

        return {
            "irrigation_required": is_required,
            "prediction": prediction_str,
            "confidence": round(confidence, 4),
            "priority": priority,
            "status": "success"
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Prediction inference error: {str(e)}",
            "irrigation_required": None,
            "prediction": None,
            "confidence": 0.0,
            "priority": "UNKNOWN"
        }


if __name__ == "__main__":
    # Test dry soil case
    dry_test = {"soil_moisture": 25.0, "temperature": 32.0, "humidity": 45.0}
    res1 = predict_irrigation(dry_test)
    print("Dry Soil Test Result:", res1)

    # Test moist soil case
    wet_test = {"soil_moisture": 75.0, "temperature": 24.0, "humidity": 80.0}
    res2 = predict_irrigation(wet_test)
    print("Moist Soil Test Result:", res2)
