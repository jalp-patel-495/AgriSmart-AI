"""
AgriSmart AI – Crop Recommendation Predictor
Predicts best suited crop based on Soil (N, P, K, pH) and Weather (Temperature, Humidity, Rainfall).
"""
from pathlib import Path
from typing import Dict, Any, Optional
import joblib
import numpy as np

_CACHED_CROP_MODEL = None


def load_crop_model(model_path: Optional[str] = None):
    global _CACHED_CROP_MODEL
    if _CACHED_CROP_MODEL is not None:
        return _CACHED_CROP_MODEL

    root = Path(__file__).resolve().parents[3]
    ai_root = Path(__file__).resolve().parents[2]
    candidates = [
        Path(model_path) if model_path else None,
        ai_root / "models" / "crop_recommendation" / "best_model.pkl",
        root / "ai" / "models" / "crop_recommendation" / "best_model.pkl",
        root / "models" / "crop_recommendation" / "best_model.pkl",
        root / "ai_model" / "models" / "crop_recommender.joblib"
    ]
    for c in candidates:
        if c and c.exists():
            try:
                _CACHED_CROP_MODEL = joblib.load(c)
                return _CACHED_CROP_MODEL
            except Exception:
                pass
    return None


def predict_crop(features: Dict[str, float], model_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Predicts optimal crop for given field conditions:
    features: {"N": 80, "P": 45, "K": 40, "temperature": 25.0, "humidity": 75.0, "ph": 6.5, "rainfall": 150.0}
    """
    model = load_crop_model(model_path)
    if model is None:
        return {
            "status": "not_trained",
            "message": "Crop recommendation model not trained yet (Real dataset required).",
            "recommended_crop": None,
            "confidence": 0.0
        }

    # Extract standard 7 agronomic inputs
    feature_order = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    vec = []
    for f in feature_order:
        # Support various casing
        val = features.get(f, features.get(f.lower(), features.get(f.upper(), 0.0)))
        vec.append(float(val))

    X = np.array([vec])
    try:
        pred_crop = str(model.predict(X)[0])
        conf = 1.0
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X)[0]
            conf = float(np.max(probs))

        return {
            "status": "success",
            "recommended_crop": pred_crop,
            "confidence": round(conf, 4),
            "inputs": features
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Prediction error: {str(e)}",
            "recommended_crop": None,
            "confidence": 0.0
        }
