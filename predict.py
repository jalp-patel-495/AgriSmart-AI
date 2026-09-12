"""
AgriSmart AI – Root CLI Wrapper for predict.py
Usage:
    python predict.py <path_to_leaf_image.jpg>
"""
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
sys.path.insert(0, str(root))
sys.path.insert(0, str(root / "ai"))

from ai.predict import main

if __name__ == "__main__":
    main()
