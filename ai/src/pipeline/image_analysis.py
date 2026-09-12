"""
AgriSmart AI – High-Level Image Analysis Pipeline
Serves as the primary Python entry point for backend integration.
Usage:
    from ai.src.pipeline.image_analysis import analyze_image
    result = analyze_image("leaf.jpg")
"""
from pathlib import Path
from typing import Dict, Any, Optional
from ai.src.disease.predict import predict_disease


def analyze_image(
    image_path: str,
    confidence_threshold: float = 0.60,
    top_k: int = 3
) -> Dict[str, Any]:
    """
    Unified end-to-end crop and disease image analysis pipeline:
    1. Validates input image file format and integrity.
    2. Runs deep learning inference via cached model singleton.
    3. Dynamically extracts crop and disease identities.
    4. Computes true aggregated crop probability across all same-crop classes.
    5. Applies configurable confidence threshold.
    6. Attaches verified agricultural symptoms, pathogen, and prevention advice.
    """
    path = Path(image_path)
    if not path.exists():
        return {
            "status": "error",
            "message": f"Image file not found: {image_path}",
            "crop": None,
            "crop_confidence": 0.0,
            "disease": None,
            "disease_confidence": 0.0,
            "class": None,
            "top_predictions": [],
            "advice": "Please provide a valid image file path."
        }

    return predict_disease(
        image_path=str(path),
        confidence_threshold=confidence_threshold,
        top_k=top_k
    )
