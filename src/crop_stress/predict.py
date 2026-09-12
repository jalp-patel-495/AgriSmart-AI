"""
AgriSmart AI – Crop Stress Inference Engine
Direct forwarder and predictor for crop stress.
"""
import sys
from pathlib import Path

# Add project root and ai/ to sys.path
root_dir = Path(__file__).resolve().parents[2]
ai_dir = root_dir / "ai"
for p in [str(root_dir), str(ai_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.src.crop_stress.predict import predict_crop_stress

__all__ = ["predict_crop_stress"]


if __name__ == "__main__":
    import json
    sample = {
        "Crop_Type": "Wheat",
        "Crop_Growth_Stage": 2,
        "Field_Boundaries": 1,
        "NDVI": 0.65,
        "Temperature": 24.5,
        "Humidity": 65.0,
        "Soil_Moisture": 28.5,
        "Pest_Damage": 15
    }
    res = predict_crop_stress(sample)
    print("Inference smoke test:")
    print(json.dumps(res, indent=4))
