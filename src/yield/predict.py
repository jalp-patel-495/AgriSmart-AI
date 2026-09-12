"""
AgriSmart AI – Crop Yield Inference Engine
Direct forwarder and predictor for crop yield.
"""
import sys
from pathlib import Path

# Add project root and ai/ to sys.path
root_dir = Path(__file__).resolve().parents[2]
ai_dir = root_dir / "ai"
for p in [str(root_dir), str(ai_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.src.yield_prediction.predict import predict_yield

__all__ = ["predict_yield"]


if __name__ == "__main__":
    import json
    # Smoke test sample
    sample = {
        "Crop": "Rice",
        "Season": "Kharif",
        "State": "Assam",
        "Area": 150000.0,
        "Annual_Rainfall": 2100.0,
        "Fertilizer": 12000000.0,
        "Pesticide": 35000.0
    }
    res = predict_yield(sample)
    print("Inference smoke test:")
    print(json.dumps(res, indent=4))
