"""
AgriSmart AI – Root Master Training Wrapper
Forwards execution directly to ai/train_all.py
"""
import sys
from pathlib import Path

# Add project root and ai/ to sys.path
root_dir = Path(__file__).resolve().parent
ai_dir = root_dir / "ai"
for p in [str(root_dir), str(ai_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.train_all import main

if __name__ == "__main__":
    main()
