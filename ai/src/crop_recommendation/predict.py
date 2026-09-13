"""
AgriSmart AI – Crop Recommendation Inference Engine (95 Crops Supported)
Loads serialized model, scaler, and label encoder to predict optimal crops from soil & weather data.
Supports literature agronomy profiles from data/global_crops.json and aliases from data/crop_aliases.json.
"""
import os
import json
from pathlib import Path
from typing import Dict, Any, List, Union, Optional, Tuple
import numpy as np
import joblib
import pandas as pd

_CACHED_MODEL_95 = None
_CACHED_SCALER_95 = None
_CACHED_ENCODER_95 = None
_CACHED_CLASSES_95 = None

_CACHED_MODEL_22 = None
_CACHED_SCALER_22 = None
_CACHED_ENCODER_22 = None
_CACHED_CLASSES_22 = None

_CACHED_GLOBAL_PROFILES = None
_CACHED_ALIASES = None


def _load_global_crop_profiles_and_aliases():
    """Loads agronomic profile knowledge base and alias mapping from dataset."""
    global _CACHED_GLOBAL_PROFILES, _CACHED_ALIASES
    if _CACHED_GLOBAL_PROFILES is not None:
        return _CACHED_GLOBAL_PROFILES, _CACHED_ALIASES

    ai_root = Path(__file__).resolve().parents[2]
    workspace_root = ai_root.parent

    candidate_data_dirs = [
        workspace_root / "data",
        ai_root / "data"
    ]

    profiles = {}
    aliases = {}

    for d in candidate_data_dirs:
        json_path = d / "global_crops.json"
        csv_path = d / "global_crops.csv"
        alias_path = d / "crop_aliases.json"

        if json_path.exists() and not profiles:
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    crops_list = raw_data.get("crops", []) if isinstance(raw_data, dict) else raw_data
                    for item in crops_list:
                        if isinstance(item, dict):
                            flat_item = dict(item)
                            if "climate" in item and isinstance(item["climate"], dict):
                                flat_item.update(item["climate"])
                            if "soil" in item and isinstance(item["soil"], dict):
                                flat_item.update(item["soil"])
                                if isinstance(flat_item.get("soil_types"), list):
                                    flat_item["soil_types"] = " | ".join(flat_item["soil_types"])
                            if "india_specific" in item and isinstance(item["india_specific"], dict):
                                flat_item.update(item["india_specific"])
                            c_name = item.get("crop_name", "")
                            if c_name:
                                profiles[c_name.lower()] = flat_item
                            sci = item.get("scientific_name", "")
                            if sci:
                                profiles[sci.lower()] = flat_item
            except Exception as e:
                print(f"[!] Error loading global_crops.json: {e}")

        # Fallback to csv if json had issues
        if csv_path.exists() and not profiles:
            try:
                df_csv = pd.read_csv(csv_path)
                for _, row in df_csv.iterrows():
                    c_dict = row.to_dict()
                    c_name = str(c_dict.get("crop_name", ""))
                    profiles[c_name.lower()] = c_dict
            except Exception as e:
                print(f"[!] Error loading global_crops.csv: {e}")

        if alias_path.exists() and not aliases:
            try:
                with open(alias_path, "r", encoding="utf-8") as f:
                    aliases = json.load(f)
            except Exception as e:
                print(f"[!] Error loading crop_aliases.json: {e}")

    _CACHED_GLOBAL_PROFILES = profiles
    _CACHED_ALIASES = aliases
    return _CACHED_GLOBAL_PROFILES, _CACHED_ALIASES


def resolve_crop_alias(crop_name: str, canonical_crops: Optional[List[str]] = None) -> str:
    """
    Resolves any crop alias (e.g. Corn, Bell Pepper, Eggplant, Mustard, Hindi/Gujarati names)
    to the canonical 95-crop label.
    """
    if not crop_name:
        return "Rice"

    raw = str(crop_name).strip()
    low = raw.lower()

    if canonical_crops:
        # 1. Exact match in canonical crops
        for c in canonical_crops:
            if c.lower() == low:
                return c
        # 2. Check compound names with slashes (e.g. 'Maize / Corn', 'Capsicum / Bell Pepper')
        for c in canonical_crops:
            if "/" in c:
                parts = [p.strip().lower() for p in c.split("/")]
                if low in parts:
                    return c

    _, aliases = _load_global_crop_profiles_and_aliases()

    # 3. Check alias dictionary mapping to scientific name
    if aliases and low in aliases:
        sci = aliases[low]
        # Map scientific name back to canonical crop
        profiles, _ = _load_global_crop_profiles_and_aliases()
        if profiles and sci.lower() in profiles:
            return profiles[sci.lower()].get("crop_name", raw)

    # 4. Partial / fuzzy match in canonical crops
    if canonical_crops:
        for c in canonical_crops:
            if low in c.lower() or c.lower() in low:
                return c

    return raw


def get_crop_model_artifacts(model_version: str = "95class"):
    """
    Singleton loader for crop recommendation model, scaler, and label encoder.
    Supports '95class' (default) with automatic fallback to '22class' if needed.
    """
    global _CACHED_MODEL_95, _CACHED_SCALER_95, _CACHED_ENCODER_95, _CACHED_CLASSES_95
    global _CACHED_MODEL_22, _CACHED_SCALER_22, _CACHED_ENCODER_22, _CACHED_CLASSES_22

    ai_root = Path(__file__).resolve().parents[2]
    workspace_root = ai_root.parent

    candidate_dirs = [
        ai_root / "models" / "crop_recommendation",
        workspace_root / "models" / "crop_recommendation"
    ]

    # Check 95-class cache
    if model_version == "95class" and _CACHED_MODEL_95 is not None:
        return _CACHED_MODEL_95, _CACHED_SCALER_95, _CACHED_ENCODER_95, _CACHED_CLASSES_95, "95class"

    # Check 22-class cache
    if model_version in ["22class", "production"] and _CACHED_MODEL_22 is not None:
        return _CACHED_MODEL_22, _CACHED_SCALER_22, _CACHED_ENCODER_22, _CACHED_CLASSES_22, "22class"

    # Try loading 95-class model first if requested
    if model_version == "95class":
        for model_dir in candidate_dirs:
            model_path = model_dir / "best_model_95class.pkl"
            scaler_path = model_dir / "scaler_95class.pkl"
            encoder_path = model_dir / "label_encoder_95class.pkl"
            classes_path = model_dir / "95_class_names.json"

            if model_path.exists():
                try:
                    _CACHED_MODEL_95 = joblib.load(model_path)
                    _CACHED_SCALER_95 = joblib.load(scaler_path) if scaler_path.exists() else None
                    _CACHED_ENCODER_95 = joblib.load(encoder_path) if encoder_path.exists() else None
                    if classes_path.exists():
                        with open(classes_path, "r", encoding="utf-8") as f:
                            _CACHED_CLASSES_95 = json.load(f)
                    elif _CACHED_ENCODER_95 is not None:
                        _CACHED_CLASSES_95 = list(_CACHED_ENCODER_95.classes_)
                    return _CACHED_MODEL_95, _CACHED_SCALER_95, _CACHED_ENCODER_95, _CACHED_CLASSES_95, "95class"
                except Exception as e:
                    print(f"[!] Warning: Failed loading 95-class crop model: {e}")

    # Fallback to loading 22-class model
    for model_dir in candidate_dirs:
        model_path = model_dir / "best_model.pkl"
        scaler_path = model_dir / "scaler.pkl"
        encoder_path = model_dir / "label_encoder.pkl"
        classes_path = model_dir / "classes.json"

        if model_path.exists() and scaler_path.exists():
            try:
                _CACHED_MODEL_22 = joblib.load(model_path)
                _CACHED_SCALER_22 = joblib.load(scaler_path)
                if encoder_path.exists():
                    _CACHED_ENCODER_22 = joblib.load(encoder_path)
                if classes_path.exists():
                    with open(classes_path, "r", encoding="utf-8") as f:
                        _CACHED_CLASSES_22 = json.load(f)
                return _CACHED_MODEL_22, _CACHED_SCALER_22, _CACHED_ENCODER_22, _CACHED_CLASSES_22, "22class"
            except Exception as e:
                print(f"[!] Warning: Failed loading 22-class crop model: {e}")

    return None, None, None, None, None


def get_crop_profile_metadata(crop_name: str) -> Dict[str, Any]:
    """Retrieves literature agronomic profile metadata for a given crop."""
    profiles, _ = _load_global_crop_profiles_and_aliases()
    if not profiles or not crop_name:
        return {}

    key = crop_name.lower().strip()
    profile = profiles.get(key, {})
    if not profile:
        # Check partial match
        for k, v in profiles.items():
            if key in k or k in key:
                profile = v
                break

    if not profile:
        return {}

    # Standardize output format
    return {
        "crop_name": profile.get("crop_name", crop_name),
        "scientific_name": profile.get("scientific_name", "N/A"),
        "crop_category": profile.get("crop_category", "Field Crop"),
        "sub_category": profile.get("sub_category", "N/A"),
        "growing_season": profile.get("growing_season", "Seasonal"),
        "preferred_ph": f"{profile.get('ph_min', 6.0)} - {profile.get('ph_max', 7.5)}",
        "temperature_range": f"{profile.get('temperature_min_c', 15)} - {profile.get('temperature_max_c', 35)}°C",
        "rainfall_range": f"{profile.get('rainfall_min_mm', 400)} - {profile.get('rainfall_max_mm', 1200)} mm",
        "water_requirement": profile.get("water_requirement", "Moderate"),
        "soil_types": profile.get("soil_types", "Loamy | Well-drained"),
        "hindi_name": profile.get("hindi_name", ""),
        "gujarati_name": profile.get("gujarati_name", ""),
        "data_confidence": profile.get("data_confidence", "approximate_literature_typical"),
        "provenance_note": "Literature-typical approximation from FAO Ecocrop / ICAR package-of-practices reference data."
    }


def predict_crop(
    features: Union[Dict[str, Any], List[float], Tuple[float, ...]],
    model_version: str = "95class"
) -> Dict[str, Any]:
    """
    Predicts best crop based on agricultural soil macronutrients and environmental conditions.
    Accepts:
        Dict: {"N": 90, "P": 42, "K": 43, "temperature": 20.8, "humidity": 82.0, "ph": 6.5, "rainfall": 202.9}
        or List/Tuple in order: [N, P, K, temperature, humidity, ph, rainfall]
    Returns:
        {
            "status": "success",
            "recommended_crop": "Tomato",
            "confidence": 0.42,
            "top_3": [
                {"crop": "Tomato", "confidence": 0.42, "rank": 1},
                {"crop": "Brinjal / Eggplant", "confidence": 0.28, "rank": 2},
                {"crop": "Chilli", "confidence": 0.15, "rank": 3}
            ],
            "crop_profile": {...}
        }
    """
    model, scaler, encoder, class_names, loaded_version = get_crop_model_artifacts(model_version=model_version)

    if model is None:
        return {
            "status": "error",
            "message": "Crop recommendation model artifacts not found. Please train model first.",
            "recommended_crop": None,
            "confidence": 0.0,
            "top_3": []
        }

    # Standard 7 features
    standard_features = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

    # Format feature vector
    if isinstance(features, dict):
        vec = []
        for fn in standard_features:
            # Flexible key lookup
            val = (
                features.get(fn)
                if features.get(fn) is not None
                else features.get(fn.lower())
                if features.get(fn.lower()) is not None
                else features.get(fn.upper())
            )
            # Support long names
            if val is None:
                if fn == "N":
                    val = features.get("nitrogen")
                elif fn == "P":
                    val = features.get("phosphorus")
                elif fn == "K":
                    val = features.get("potassium")

            if val is None:
                return {
                    "status": "error",
                    "message": f"Missing required feature: {fn}",
                    "recommended_crop": None,
                    "confidence": 0.0,
                    "top_3": []
                }
            try:
                vec.append(float(val))
            except (ValueError, TypeError):
                return {
                    "status": "error",
                    "message": f"Invalid numeric value for feature {fn}: {val}",
                    "recommended_crop": None,
                    "confidence": 0.0,
                    "top_3": []
                }
    elif isinstance(features, (list, tuple)):
        if len(features) < 7:
            return {
                "status": "error",
                "message": f"Feature vector must contain at least 7 values [N, P, K, temp, humidity, ph, rainfall], got {len(features)}",
                "recommended_crop": None,
                "confidence": 0.0,
                "top_3": []
            }
        try:
            vec = [float(v) for v in features[:7]]
        except (ValueError, TypeError) as e:
            return {
                "status": "error",
                "message": f"Invalid feature values: {e}",
                "recommended_crop": None,
                "confidence": 0.0,
                "top_3": []
            }
    else:
        return {
            "status": "error",
            "message": "Invalid features format. Must be dict or list.",
            "recommended_crop": None,
            "confidence": 0.0,
            "top_3": []
        }

    # Range and sanity validation
    # vec order is: [N, P, K, temperature, humidity, ph, rainfall]
    n_val, p_val, k_val, temp_val, hum_val, ph_val, rain_val = vec[:7]
    if n_val < 0 or p_val < 0 or k_val < 0:
        return {
            "status": "error",
            "message": "NPK values cannot be negative.",
            "recommended_crop": None,
            "confidence": 0.0,
            "top_3": []
        }
    if not (0.0 <= ph_val <= 14.0):
        return {
            "status": "error",
            "message": f"Soil pH must be between 0.0 and 14.0, got {ph_val}.",
            "recommended_crop": None,
            "confidence": 0.0,
            "top_3": []
        }
    if not (0.0 <= hum_val <= 100.0):
        return {
            "status": "error",
            "message": f"Relative humidity must be between 0% and 100%, got {hum_val}%.",
            "recommended_crop": None,
            "confidence": 0.0,
            "top_3": []
        }
    if rain_val < 0:
        return {
            "status": "error",
            "message": "Rainfall cannot be negative.",
            "recommended_crop": None,
            "confidence": 0.0,
            "top_3": []
        }

    # Prepare DataFrame and scale
    if loaded_version == "95class":
        # Model trained on numeric_features order: temperature, rainfall, humidity, ph, nitrogen, phosphorus, potassium
        # Map [N, P, K, temp, hum, ph, rain] -> [temp, rain, hum, ph, N, P, K]
        ordered_vec = [vec[3], vec[6], vec[4], vec[5], vec[0], vec[1], vec[2]]
        cols = ["temperature", "rainfall", "humidity", "ph", "nitrogen", "phosphorus", "potassium"]
        X_df = pd.DataFrame([ordered_vec], columns=cols)
    else:
        # 22-class model uses N, P, K, temperature, humidity, ph, rainfall
        cols = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
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
        probs = np.zeros(len(class_names) if class_names else 95)
        probs[pred_idx] = 1.0

    top_3_indices = np.argsort(probs)[::-1][:3]

    top_3_list = []
    for rank, idx in enumerate(top_3_indices, start=1):
        p = float(probs[idx])
        if encoder is not None and hasattr(encoder, "inverse_transform"):
            c_name = str(encoder.inverse_transform([idx])[0])
        elif class_names is not None and idx < len(class_names):
            c_name = str(class_names[idx])
        else:
            c_name = f"Class_{idx}"

        top_3_list.append({
            "crop": c_name,
            "confidence": round(p, 4),
            "rank": rank
        })

    best_crop = top_3_list[0]["crop"]
    best_conf = top_3_list[0]["confidence"]

    # Enrich with agronomic metadata from global_crops.json
    profile = get_crop_profile_metadata(best_crop)

    return {
        "status": "success",
        "recommended_crop": best_crop,
        "confidence": best_conf,
        "top_3": top_3_list,
        "crop_profile": profile,
        "model_version": loaded_version
    }
