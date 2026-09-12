"""
AgriSmart AI – Crop Yield Inference Engine
Loads serialized best_model.pkl and preprocessor.pkl to predict agricultural yield.
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


def get_yield_artifacts() -> Tuple[Any, Any, Dict[str, Any]]:
    """Singleton loader for yield model, preprocessor, and configuration."""
    global _CACHED_MODEL, _CACHED_PREPROCESSOR, _CACHED_CONFIG
    if _CACHED_MODEL is not None and _CACHED_PREPROCESSOR is not None:
        return _CACHED_MODEL, _CACHED_PREPROCESSOR, _CACHED_CONFIG

    ai_root = Path(__file__).resolve().parents[2]
    workspace_root = ai_root.parent

    candidate_dirs = [
        workspace_root / "models" / "yield",
        ai_root / "models" / "yield"
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


def predict_yield(
    features: Union[Dict[str, Any], pd.DataFrame]
) -> Dict[str, Any]:
    """
    Predicts agricultural crop yield based on environmental and input parameters.

    Parameters:
        features: Dict containing the exact training features:
            - 'Crop': str (e.g. 'Rice', 'Wheat', 'Maize', 'Sugarcane')
            - 'Season': str (e.g. 'Kharif', 'Rabi', 'Whole Year', 'Summer', 'Autumn', 'Winter')
            - 'State': str (e.g. 'Assam', 'Karnataka', 'Punjab', 'Uttar Pradesh')
            - 'Area': float (Cultivated land area in hectares)
            - 'Annual_Rainfall': float (Annual precipitation in mm)
            - 'Fertilizer': float (Fertilizer application in kg)
            - 'Pesticide': float (Pesticide application in kg)

    Returns:
        JSON-compatible dictionary:
        {
            "predicted_yield": float,
            "unit": "Tonnes/Ha" | "Nuts/Ha",
            "status": "success"
        }
    """
    model, preprocessor, cfg = get_yield_artifacts()

    if model is None or preprocessor is None:
        return {
            "status": "error",
            "message": "Crop yield model artifacts not found. Please train model using 'python train_yield.py'.",
            "predicted_yield": None,
            "unit": None
        }

    # Standardize input format
    required_keys = ["Crop", "Season", "State", "Area", "Annual_Rainfall", "Fertilizer", "Pesticide"]

    if isinstance(features, dict):
        # Case-insensitive mapping for convenience
        cleaned = {}
        for rk in required_keys:
            val = features.get(rk)
            if val is None:
                # Try lower case and snake_case aliases
                for k, v in features.items():
                    if k.lower().replace("_", "") == rk.lower().replace("_", ""):
                        val = v
                        break
            if val is None:
                return {
                    "status": "error",
                    "message": f"Missing required feature: '{rk}'. Expected features: {required_keys}",
                    "predicted_yield": None,
                    "unit": None
                }
            cleaned[rk] = val

        # Clean string whitespace
        cleaned["Crop"] = str(cleaned["Crop"]).strip()
        cleaned["Season"] = str(cleaned["Season"]).strip()
        cleaned["State"] = str(cleaned["State"]).strip()
        cleaned["Area"] = float(cleaned["Area"])
        cleaned["Annual_Rainfall"] = float(cleaned["Annual_Rainfall"])
        cleaned["Fertilizer"] = float(cleaned["Fertilizer"])
        cleaned["Pesticide"] = float(cleaned["Pesticide"])

        df_input = pd.DataFrame([cleaned])
    elif isinstance(features, pd.DataFrame):
        df_input = features.copy()
        for rk in required_keys:
            if rk not in df_input.columns:
                return {
                    "status": "error",
                    "message": f"Missing required column in DataFrame: '{rk}'",
                    "predicted_yield": None,
                    "unit": None
                }
    else:
        return {
            "status": "error",
            "message": f"Unsupported features type: {type(features)}",
            "predicted_yield": None,
            "unit": None
        }

    try:
        # Preprocess features (OneHotEncode categoricals, Scale numericals)
        X_proc = preprocessor.transform(df_input[required_keys])

        # Inference
        raw_pred = model.predict(X_proc)[0]
        pred_val = round(max(0.0, float(raw_pred)), 4)

        # Dynamic unit based on crop type (Coconut is measured in nuts/ha in Indian agricultural statistics)
        crop_name = str(df_input.iloc[0]["Crop"]).lower()
        unit = "Nuts/Ha" if "coconut" in crop_name else "Tonnes/Ha"

        return {
            "predicted_yield": pred_val,
            "unit": unit,
            "status": "success"
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Yield prediction error: {str(e)}",
            "predicted_yield": None,
            "unit": None
        }


if __name__ == "__main__":
    # Test sample: Rice in Assam during Kharif season
    test_sample = {
        "Crop": "Rice",
        "Season": "Kharif",
        "State": "Assam",
        "Area": 150000.0,
        "Annual_Rainfall": 2100.0,
        "Fertilizer": 12000000.0,
        "Pesticide": 35000.0
    }
    result = predict_yield(test_sample)
    print("Inference smoke test result:")
    print(json.dumps(result, indent=4))
