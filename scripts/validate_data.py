"""
AgriSmart AI – Root Wrapper for scripts/validate_data.py
Invokes ai.scripts.validate_data
"""
import sys
from pathlib import Path

# Add project root and ai root to path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
sys.path.insert(0, str(root / "ai"))

from ai.scripts.validate_data import run_data_validation

if __name__ == "__main__":
    run_data_validation()
