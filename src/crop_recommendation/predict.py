"""
AgriSmart AI – Root Crop Recommendation Predict Forwarder (95 Crops Supported)
"""
from ai.src.crop_recommendation.predict import (
    predict_crop,
    resolve_crop_alias,
    get_crop_profile_metadata,
    get_crop_model_artifacts
)

__all__ = [
    "predict_crop",
    "resolve_crop_alias",
    "get_crop_profile_metadata",
    "get_crop_model_artifacts"
]
