"""
AgriSmart AI – Crop Recommendation Inference Engine
Loads serialized model, scaler, and label encoder to predict optimal crops from soil & weather data.
"""
import json
from pathlib import Path
from typing import Dict, Any, List, Union, Optional, Tuple
import numpy as np
import joblib

_CACHED_MODEL = None
_CACHED_SCALER = None
_CACHED_ENCODER = None
_CACHED_FEATURES = None
_CACHED_CLASSES = None


def get_crop_model_artifacts():
    """Singleton loader for crop recommendation model, scaler, and encoder."""
    global _CACHED_MODEL, _CACHED_SCALER, _CACHED_ENCODER, _CACHED_FEATURES, _CACHED_CLASSES
    if _CACHED_MODEL is not None:
        return _CACHED_MODEL, _CACHED_SCALER, _CACHED_ENCODER, _CACHED_FEATURES, _CACHED_CLASSES

    ai_root = Path(__file__).resolve().parents[2]
    workspace_root = ai_root.parent

    candidate_dirs = [
        ai_root / "models" / "crop_recommendation",
        workspace_root / "models" / "crop_recommendation"
    ]

    for model_dir in candidate_dirs:
        model_path = model_dir / "best_model.pkl"
        scaler_path = model_dir / "scaler.pkl"
        encoder_path = model_dir / "label_encoder.pkl"
        features_path = model_dir / "features.json"
        classes_path = model_dir / "classes.json"

        if model_path.exists() and scaler_path.exists():
            try:
                _CACHED_MODEL = joblib.load(model_path)
                _CACHED_SCALER = joblib.load(scaler_path)
                if encoder_path.exists():
                    _CACHED_ENCODER = joblib.load(encoder_path)
                if features_path.exists():
                    with open(features_path, "r", encoding="utf-8") as f:
                        _CACHED_FEATURES = json.load(f)
                else:
                    _CACHED_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
                if classes_path.exists():
                    with open(classes_path, "r", encoding="utf-8") as f:
                        _CACHED_CLASSES = json.load(f)
                return _CACHED_MODEL, _CACHED_SCALER, _CACHED_ENCODER, _CACHED_FEATURES, _CACHED_CLASSES
            except Exception:
                pass

    return None, None, None, None, None


def predict_crop(
    features: Union[Dict[str, Any], List[float], Tuple[float, ...]]
) -> Dict[str, Any]:
    """
    Predicts best crop based on agricultural soil and environmental conditions.
    Accepts:
        Dict: {"N": 90, "P": 42, "K": 43, "temperature": 20.8, "humidity": 82.0, "ph": 6.5, "rainfall": 202.9}
        or List/Tuple in order: [N, P, K, temperature, humidity, ph, rainfall]
    Returns:
        {
            "recommended_crop": "rice",
            "confidence": 0.985,
            "top_3": [
                {"crop": "rice", "confidence": 0.985},
                ...
            ]
        }
    """
    model, scaler, encoder, feature_names, class_names = get_crop_model_artifacts()

    if model is None:
        return {
            "status": "error",
            "message": "Crop recommendation model artifacts not found. Please train model first.",
            "recommended_crop": None,
            "confidence": 0.0,
            "top_3": []
        }

    # Format vector
    if isinstance(features, dict):
        vec = []
        for fn in (feature_names or ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]):
            # Casing flexibility
            val = features.get(fn)
            if val is None:
                val = features.get(fn.lower())
            if val is None:
                val = features.get(fn.upper())
            if val is None:
                val = 0.0
            vec.append(float(val))
    elif isinstance(features, (list, tuple)):
        vec = [float(v) for v in features]
    else:
        return {
            "status": "error",
            "message": "Invalid features format. Must be dict or list.",
            "recommended_crop": None,
            "confidence": 0.0,
            "top_3": []
        }

    import pandas as pd
    cols = feature_names if feature_names else ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    X_df = pd.DataFrame([vec], columns=cols)
    if scaler is not None:
        X_scaled = scaler.transform(X_df)
    else:
        X_scaled = X_df.values

    # Predict Probabilities
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X_scaled)[0]
    else:
        pred_idx = model.predict(X_scaled)[0]
        probs = np.zeros(len(class_names))
        probs[pred_idx] = 1.0

    top_3_indices = np.argsort(probs)[::-1][:3]

    top_3_list = []
    for idx in top_3_indices:
        p = float(probs[idx])
        if encoder is not None:
            c_name = str(encoder.inverse_transform([idx])[0])
        elif class_names is not None:
            c_name = str(class_names[idx])
        else:
            c_name = f"Class_{idx}"

        top_3_list.append({
            "crop": c_name,
            "confidence": round(p, 4)
        })

    best_crop = top_3_list[0]["crop"]
    best_conf = top_3_list[0]["confidence"]

    return {
        "recommended_crop": best_crop,
        "confidence": best_conf,
        "top_3": top_3_list,
        "status": "success"
    }
