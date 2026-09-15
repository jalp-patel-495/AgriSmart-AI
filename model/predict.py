"""
AgriSmart AI – Core Predict Interface (Section 4.1 / Section 7.1)

Usage via Python API:
    from model.predict import predict
    result = predict("path/to/leaf.jpg")

Usage via CLI:
    python model/predict.py <path_to_leaf_image.jpg>
"""
import sys
import json
from pathlib import Path
from typing import Dict, Any, Union

# Ensure repository root is on sys.path
root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))
if str(root / "ai") not in sys.path:
    sys.path.insert(0, str(root / "ai"))

from ai.src.pipeline.image_analysis import analyze_image


def predict(image_input: Union[str, Path]) -> Dict[str, Any]:
    """
    Standard model predict interface conforming to Section 4.1.
    
    Args:
        image_input: Path to crop leaf image (str or Path)
        
    Returns:
        dict containing:
            - status: "success" or "error"
            - crop: Name of detected crop
            - disease: Detected disease name or "Healthy"
            - confidence: Confidence score (0.0 to 1.0)
            - class: Exact canonical class name
            - top_predictions: List of top candidate classes with scores
            - pathogen: Causal pathogen if diseased
            - symptoms: Biological symptoms description
            - prevention: Cultural precautions & preventative steps
            - management: Recommended curative agronomic treatments
            - is_ood: Out-of-distribution / non-leaf detection flag
    """
    return analyze_image(str(image_input))


def main():
    if len(sys.argv) < 2:
        print("Usage: python model/predict.py <path_to_leaf_image.jpg>")
        print("Example: python model/predict.py dataset/sample.jpg")
        sys.exit(1)

    img_path = sys.argv[1]
    result = predict(img_path)
    print(json.dumps(result, indent=4))


if __name__ == "__main__":
    main()
