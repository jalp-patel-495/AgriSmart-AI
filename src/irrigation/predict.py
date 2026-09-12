"""
AgriSmart AI – Smart Irrigation Inference Engine
Direct forwarder and predictor for smart irrigation.
"""
import sys
from pathlib import Path

# Add project root and ai/ to sys.path
root_dir = Path(__file__).resolve().parents[2]
ai_dir = root_dir / "ai"
for p in [str(root_dir), str(ai_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.src.irrigation.predict import predict_irrigation

__all__ = ["predict_irrigation"]


if __name__ == "__main__":
    # Smoke test matching Section 10 example
    test_input = {
        "soil_moisture": 25,
        "temperature": 32,
        "humidity": 45,
        "rainfall": 2
    }
    result = predict_irrigation(test_input)
    print("Inference smoke test result:", result)
