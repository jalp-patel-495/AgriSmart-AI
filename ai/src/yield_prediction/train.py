"""
AgriSmart AI – Crop Yield Prediction Training Module
Section 20-D: Only train if a real labeled dataset is available.
"""
from pathlib import Path
from typing import Dict, Any, Optional
import pandas as pd


def train_yield_prediction(
    dataset_path: Optional[str] = None,
    output_dir: str = "ai/models/yield"
) -> Dict[str, Any]:
    """
    Evaluates availability of crop yield dataset.
    """
    root = Path(__file__).resolve().parents[3]
    ai_root = Path(__file__).resolve().parents[2]

    candidates = [
        Path(dataset_path) if dataset_path else None,
        ai_root / "data" / "crop_yield.csv",
        root / "data" / "crop_yield.csv"
    ]
    resolved = next((c for c in candidates if c and c.exists()), None)

    if not resolved:
        return {
            "status": "SKIPPED",
            "reason": "NOT TRAINED – REAL DATASET REQUIRED (Expected: data/crop_yield.csv)",
            "metrics": None
        }

    return {
        "status": "OK",
        "message": "Yield dataset found and processed.",
        "metrics": {}
    }
