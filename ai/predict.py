"""
AgriSmart AI – Standalone Image Inference CLI & Entry Point
Usage:
    python predict.py path/to/leaf_image.jpg
"""
import sys
import json
from pathlib import Path

# Add paths
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
sys.path.insert(0, str(root / "ai"))

from ai.src.pipeline.image_analysis import analyze_image


def main():
    if len(sys.argv) < 2:
        print("Usage: python predict.py <path_to_leaf_image.jpg>")
        print("Example: python predict.py dataset/raw/Tomato___Early_blight/sample.jpg")
        sys.exit(1)

    img_path = sys.argv[1]
    result = analyze_image(img_path)
    print(json.dumps(result, indent=4))


if __name__ == "__main__":
    main()
