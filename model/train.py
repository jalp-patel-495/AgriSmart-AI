"""
AgriSmart AI – Training Pipeline Interface (Section 7.1)

Usage:
    python model/train.py [--epochs-stage1 8] [--epochs-stage2 20] [--batch-size 32]
"""
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from scripts.train_plantvillage import main

if __name__ == "__main__":
    main()
