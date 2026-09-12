"""
AgriSmart AI – Smart Irrigation Predictor
Predicts whether irrigation is required based on telemetry and weather parameters.
"""
from pathlib import Path
from typing import Dict, Any, Optional
import joblib
import numpy as np

_CACHED_IRRIGATION_MODEL = None


def load_irrigation_model(model_path: Optional[str] = None):
    global _CACHED_IRRIGATION_MODEL
    if _CACHED_IRRIGATION_MODEL is not None:
        return _CACHED_IRRIGATION_MODEL

    candidates = [
        Path(model_path) if model_path else None,
        Path("ai/models/irrigation/best_model.pkl"),
        Path("models/irrigation/best_model.pkl")
    ]
    for c in candidates:
        if c and c.exists():
            try:
                _CACHED_IRRIGATION_MODEL = joblib.load(c)
                return _CACHED_IRRIGATION_MODEL
            except Exception:
                pass
    return None


def predict_irrigation(features: Dict[str, float], model_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Evaluates field parameters to recommend irrigation action.
    features: {"soil_moisture": 25.0, "temperature": 28.0, "humidity": 65.0, "rainfall": 0.0, "rain_prob": 10.0}
    """
    model = load_irrigation_model(model_path)
    if model is None:
        # Transparent rule-based agronomical fallback
        sm = float(features.get("soil_moisture", 30.0))
        rain_prob = float(features.get("rain_prob", 0.0))
        temp = float(features.get("temperature", 25.0))

        irrigation_needed = bool(sm < 35.0 and rain_prob < 40.0)
        return {
            "status": "rule_based_advisory",
            "message": "ML model not trained yet (Real dataset required). Utilizing agronomical soil telemetry heuristic.",
            "irrigation_required": irrigation_needed,
            "confidence": 0.85,
            "soil_moisture": sm,
            "reason": "Soil moisture below threshold with low probability of rain." if irrigation_needed else "Sufficient moisture or imminent rainfall."
        }

    vec = [
        float(features.get("soil_moisture", 30.0)),
        float(features.get("temperature", 25.0)),
        float(features.get("humidity", 60.0)),
        float(features.get("rainfall", 0.0)),
        float(features.get("rain_prob", 0.0))
    ]
    X = np.array([vec])
    try:
        pred = bool(model.predict(X)[0])
        conf = 1.0
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X)[0]
            conf = float(np.max(probs))

        return {
            "status": "success",
            "irrigation_required": pred,
            "confidence": round(conf, 4),
            "inputs": features
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Irrigation inference failed: {str(e)}",
            "irrigation_required": False,
            "confidence": 0.0
        }
